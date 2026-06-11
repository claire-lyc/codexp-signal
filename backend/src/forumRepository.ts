import { randomUUID } from 'node:crypto';

export type ForumReply = {
  id: string;
  author: string;
  content: string;
  createdAt: string;
  official?: boolean;
  similarReport?: boolean;
  sourceReportId?: string | null;
};

export type ForumImage = {
  id: string;
  filename: string | null;
  mimeType: string | null;
  previewUrl: string;
};

export type ForumModerationState = 'live' | 'under_review' | 'verified' | 'hidden' | 'misleading' | 'resolved';

export type ForumPost = {
  id: string;
  author: string;
  content: string;
  createdAt: string;
  verified: boolean;
  aiFlag: boolean;
  likes: number;
  dislikes: number;
  reports: number;
  moderationState: ForumModerationState;
  replies: ForumReply[];
  images: ForumImage[];
  category: string;
  crisisTag: string | null;
  topicTag: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  sourceReportId: string | null;
  similarReports: number;
  distanceKm?: number | null;
  rankingScore?: number;
};

const forumPosts: ForumPost[] = [];

const forumLikes = new Map<string, Set<string>>();
const forumDislikes = new Map<string, Set<string>>();
const bannedForumAuthors = new Set<string>();

export function upsertDemoForumPost(post: ForumPost) {
  const existingIndex = forumPosts.findIndex((item) => item.id === post.id);
  const nextPost = {
    ...post,
    replies: [...post.replies],
    images: [...post.images],
  };
  if (existingIndex >= 0) {
    forumPosts[existingIndex] = nextPost;
  } else {
    forumPosts.unshift(nextPost);
  }
  return nextPost;
}

export function appendDemoForumReply(postId: string, reply: ForumReply) {
  const post = forumPosts.find((item) => item.id === postId);
  if (!post || post.replies.some((item) => item.id === reply.id)) return post ?? null;
  post.replies.push({ ...reply });
  return post;
}

export function clearDemoForumPosts(postIds: Iterable<string>) {
  const ids = new Set(postIds);
  for (let index = forumPosts.length - 1; index >= 0; index -= 1) {
    if (!ids.has(forumPosts[index].id)) continue;
    forumLikes.delete(forumPosts[index].id);
    forumDislikes.delete(forumPosts[index].id);
    forumPosts.splice(index, 1);
  }
}

export function clearForumPostsMatching(predicate: (post: ForumPost) => boolean) {
  for (let index = forumPosts.length - 1; index >= 0; index -= 1) {
    if (!predicate(forumPosts[index])) continue;
    forumLikes.delete(forumPosts[index].id);
    forumDislikes.delete(forumPosts[index].id);
    forumPosts.splice(index, 1);
  }
}

export function listForumPosts(options: {
  includeHidden?: boolean;
  latitude?: number | null;
  longitude?: number | null;
} = {}) {
  seedDefaultForumPosts();
  consolidateExactDuplicateThreads();
  return [...forumPosts].filter((post) => {
    if (options.includeHidden) return true;
    return post.moderationState !== 'hidden' && post.moderationState !== 'misleading' && !bannedForumAuthors.has(normalizeAuthor(post.author));
  }).map((post) => rankForumPost(post, options.latitude, options.longitude))
    .sort(compareForumFeedOrder);
}

function seedDefaultForumPosts() {
  const existing = new Set(forumPosts.map((post) => post.id));
  for (const post of defaultForumSeedPosts()) {
    if (existing.has(post.id)) continue;
    forumPosts.push(post);
  }
}

type SeedForumPost = Omit<ForumPost, 'createdAt' | 'images' | 'sourceReportId' | 'similarReports' | 'moderationState' | 'replies'> & {
  minutesAgo: number;
  moderationState?: ForumModerationState;
  replies?: Array<Omit<ForumReply, 'createdAt'> & { minutesAgo: number }>;
};

function defaultForumSeedPosts(): ForumPost[] {
  const seeds: SeedForumPost[] = [
    {
      id: 'signal-welcome-post',
      author: 'SiGnal Team',
      content: 'Welcome to the SiGnal community forum. Like this post to confirm you have found the official welcome thread, and use reports for urgent on-ground issues.',
      minutesAgo: 15,
      verified: true,
      aiFlag: false,
      likes: 24,
      dislikes: 0,
      reports: 0,
      replies: [{ id: 'signal-welcome-reply', author: 'SiGnal Team', content: 'Helpful local updates are welcome. Report suspicious or harmful claims so moderators can review them quickly.', minutesAgo: 10, official: true }],
      category: 'Community',
      crisisTag: null,
      topicTag: null,
      location: null,
      latitude: null,
      longitude: null,
    },
    { id: 'covid-watch-bedok-symptoms', author: 'Nadia - Bedok North', content: 'My dad and I both developed fever and sore throat after visiting Bedok market. We tested negative once but symptoms are getting worse, so we are isolating and checking again tonight.', minutesAgo: 18, verified: false, aiFlag: false, likes: 18, dislikes: 1, reports: 0, replies: [{ id: 'covid-watch-bedok-reply', author: 'Community volunteer', content: 'Thanks for isolating. If breathing worsens or fever remains high, call a clinic before heading down.', minutesAgo: 11, official: false }], category: 'Health', topicTag: 'covid-watch', crisisTag: 'Covid-19 Watch', location: 'Bedok North', latitude: 1.324, longitude: 103.93 },
    { id: 'covid-watch-jurong-clinic', author: 'Jurong West GP Clinic', content: 'We are seeing a clear increase in respiratory cases today. Most are mild, but seniors with breathlessness should seek care early instead of waiting overnight.', minutesAgo: 28, verified: true, aiFlag: false, likes: 42, dislikes: 0, reports: 0, category: 'Health', topicTag: 'covid-watch', crisisTag: 'Covid-19 Watch', location: 'Jurong West', latitude: 1.3404, longitude: 103.7058 },
    { id: 'covid-watch-tampines-school', author: 'TampinesParent92', content: 'Several kids in my child care centre are coughing. Not sure if it is Covid but the centre asked parents to monitor temperature and keep sick children home.', minutesAgo: 43, verified: false, aiFlag: false, likes: 13, dislikes: 2, reports: 0, category: 'Health', topicTag: 'covid-watch', crisisTag: 'Covid-19 Watch', location: 'Tampines', latitude: 1.3547, longitude: 103.9436 },
    { id: 'covid-watch-woodlands', author: 'Woodlands Resident', content: 'Block group chat has a few families reporting fever and body aches. We are not sure if linked, but masks are back on for lift/common areas.', minutesAgo: 56, verified: false, aiFlag: false, likes: 9, dislikes: 0, reports: 0, category: 'Health', topicTag: 'covid-watch', crisisTag: 'Covid-19 Watch', location: 'Woodlands', latitude: 1.436, longitude: 103.786 },
    { id: 'covid-watch-bishan-pharmacy', author: 'Bishan Pharmacy Counter', content: 'More people buying ART kits and cough medicine this afternoon. Stock is still available but moving faster than usual.', minutesAgo: 72, verified: true, aiFlag: false, likes: 21, dislikes: 1, reports: 0, category: 'Health', topicTag: 'covid-watch', crisisTag: 'Covid-19 Watch', location: 'Bishan', latitude: 1.3508, longitude: 103.8485 },
    { id: 'covid-watch-queenstown', author: 'QueenstownCaregiver', content: 'My mum has mild fever after a clinic visit. Doctor said monitor symptoms and avoid crowded places. Posting in case others nearby are seeing the same.', minutesAgo: 84, verified: false, aiFlag: false, likes: 7, dislikes: 0, reports: 0, category: 'Health', topicTag: 'covid-watch', crisisTag: 'Covid-19 Watch', location: 'Queenstown', latitude: 1.2942, longitude: 103.7861 },
    { id: 'covid-watch-low-confidence', author: 'AnonymousForward', content: 'Breaking: heard every clinic in the west is full and nobody should go out!!! Can anyone confirm?', minutesAgo: 96, verified: false, aiFlag: true, likes: 2, dislikes: 15, reports: 5, replies: [{ id: 'covid-watch-low-confidence-reply', author: 'SiGnal Team', content: 'This claim is not verified. Please rely on official advisories and report exact locations only.', minutesAgo: 88, official: true }], moderationState: 'under_review', category: 'Health', topicTag: 'covid-watch', crisisTag: 'Covid-19 Watch', location: 'Jurong West', latitude: 1.3404, longitude: 103.7058 },
    { id: 'flood-risk-orchard', author: 'Orchard Commuter', content: 'Water is pooling quickly near the underpass entrance. Still passable but ankle-deep in parts. Please slow down if driving through.', minutesAgo: 14, verified: false, aiFlag: false, likes: 31, dislikes: 0, reports: 0, category: 'Weather', topicTag: 'rainfall-risk', crisisTag: 'Elevated Flood Risk', location: 'Orchard underpass', latitude: 1.3048, longitude: 103.8318 },
    { id: 'flood-risk-east-coast', author: 'East Coast Cyclist', content: 'Heavy rain around East Coast. Park connector has several puddles and one low point is almost overflowing.', minutesAgo: 32, verified: false, aiFlag: false, likes: 17, dislikes: 1, reports: 0, category: 'Weather', topicTag: 'rainfall-risk', crisisTag: 'Elevated Flood Risk', location: 'East Coast', latitude: 1.305, longitude: 103.912 },
    { id: 'flood-risk-bedok', author: 'Bedok Shopowner', content: 'Drain outside our row is backing up again. We moved goods away from the entrance just in case.', minutesAgo: 49, verified: false, aiFlag: false, likes: 12, dislikes: 0, reports: 0, category: 'Weather', topicTag: 'rainfall-risk', crisisTag: 'Elevated Flood Risk', location: 'Bedok', latitude: 1.324, longitude: 103.93 },
    { id: 'flood-risk-bishan', author: 'Bishan MRT Staff', content: 'Crowd control is normal, but rainwater is gathering near the sheltered walkway. Cleaning team has been informed.', minutesAgo: 63, verified: true, aiFlag: false, likes: 24, dislikes: 0, reports: 0, category: 'Weather', topicTag: 'rainfall-risk', crisisTag: 'Elevated Flood Risk', location: 'Bishan', latitude: 1.3508, longitude: 103.8485 },
    { id: 'flood-risk-jurong', author: 'Jurong West Resident', content: 'Rain has eased here but roadside drains are still fast-flowing. Parents should watch kids around open drains.', minutesAgo: 77, verified: false, aiFlag: false, likes: 8, dislikes: 0, reports: 0, category: 'Weather', topicTag: 'rainfall-risk', crisisTag: 'Elevated Flood Risk', location: 'Jurong West', latitude: 1.3404, longitude: 103.7058 },
    { id: 'flood-risk-unverified', author: 'RoadWatchSG', content: 'Someone said cars are floating near East Coast already. I cannot verify, but avoid the area if possible.', minutesAgo: 93, verified: false, aiFlag: true, likes: 4, dislikes: 10, reports: 3, moderationState: 'under_review', category: 'Weather', topicTag: 'rainfall-risk', crisisTag: 'Elevated Flood Risk', location: 'East Coast', latitude: 1.305, longitude: 103.912 },
    { id: 'air-quality-west', author: 'Westside Runner', content: 'Air smells smoky near the stadium. I stopped my run because my throat felt scratchy after 15 minutes.', minutesAgo: 21, verified: false, aiFlag: false, likes: 15, dislikes: 0, reports: 0, category: 'Weather', topicTag: 'air-quality', crisisTag: 'Air Quality Advisory', location: 'West', latitude: 1.357, longitude: 103.7 },
    { id: 'air-quality-north', author: 'Sembawang Parent', content: 'My child has asthma and coughed more than usual after recess. We are keeping inhaler nearby and avoiding outdoor play.', minutesAgo: 38, verified: false, aiFlag: false, likes: 19, dislikes: 0, reports: 0, category: 'Weather', topicTag: 'air-quality', crisisTag: 'Air Quality Advisory', location: 'North', latitude: 1.418, longitude: 103.82 },
    { id: 'air-quality-central', author: 'Central Clinic Nurse', content: 'We have seen a small rise in throat irritation complaints. Most are mild, but sensitive groups should reduce long outdoor exposure.', minutesAgo: 54, verified: true, aiFlag: false, likes: 33, dislikes: 0, reports: 0, category: 'Weather', topicTag: 'air-quality', crisisTag: 'Air Quality Advisory', location: 'Central', latitude: 1.357, longitude: 103.82 },
    { id: 'air-quality-east', author: 'East Resident', content: 'Visibility looks normal here, but I can smell haze when windows are open. Anyone else in Tampines noticing this?', minutesAgo: 69, verified: false, aiFlag: false, likes: 11, dislikes: 2, reports: 0, category: 'Weather', topicTag: 'air-quality', crisisTag: 'Air Quality Advisory', location: 'East', latitude: 1.357, longitude: 103.94 },
    { id: 'air-quality-rumour', author: 'ForwardedMessage', content: 'Heard the PSI is secretly over 300 but they are hiding it. Is that true?', minutesAgo: 86, verified: false, aiFlag: true, likes: 1, dislikes: 18, reports: 7, replies: [{ id: 'air-quality-rumour-reply', author: 'SiGnal Team', content: 'This is unverified. Please check official PSI readings and avoid spreading unsourced numbers.', minutesAgo: 80, official: true }], moderationState: 'under_review', category: 'Weather', topicTag: 'air-quality', crisisTag: 'Air Quality Advisory', location: 'South', latitude: 1.296, longitude: 103.82 },
  ];

  return seeds.map((post) => ({
    ...post,
    createdAt: minutesAgo(post.minutesAgo),
    moderationState: post.moderationState ?? (post.verified ? 'verified' : post.aiFlag ? 'under_review' : 'live'),
    replies: (post.replies ?? []).map((reply) => ({ ...reply, createdAt: minutesAgo(reply.minutesAgo) })),
    images: [],
    sourceReportId: null,
    similarReports: 0,
  }));
}

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

export function createForumPost(input: {
  author?: string;
  content: string;
  category?: string;
  crisisTag?: string | null;
  topicTag?: string | null;
  aiFlag?: boolean;
  verified?: boolean;
  moderationState?: ForumModerationState;
  images?: Array<{ filename?: string | null; mimeType?: string | null; previewUrl?: string | null }>;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  sourceReportId?: string | null;
}) {
  const content = input.content.trim();
  const author = input.author?.trim() || 'Anonymous User';
  if (bannedForumAuthors.has(normalizeAuthor(author))) {
    throw new ForumAuthorBannedError(author);
  }
  const moderationState = input.moderationState ?? (input.verified ? 'verified' : input.aiFlag ? 'under_review' : 'live');
  const post: ForumPost = {
    id: randomUUID(),
    author,
    content,
    createdAt: new Date().toISOString(),
    verified: Boolean(input.verified),
    aiFlag: Boolean(input.aiFlag),
    likes: 0,
    dislikes: 0,
    reports: 0,
    moderationState,
    replies: [],
    images: (input.images ?? [])
      .filter((image) => image.previewUrl)
      .slice(0, 3)
      .map((image) => ({
        id: randomUUID(),
        filename: image.filename ?? null,
        mimeType: image.mimeType ?? null,
        previewUrl: image.previewUrl as string,
      })),
    category: input.category?.trim() || inferCategory(content),
    crisisTag: input.crisisTag?.trim() || null,
    topicTag: input.topicTag?.trim().toLowerCase() || inferTopicTag(content, input.crisisTag, input.location),
    location: input.location?.trim() || null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    sourceReportId: input.sourceReportId?.trim() || null,
    similarReports: 0,
  };
  forumPosts.unshift(post);
  return post;
}

export function createOrMergeForumPost(input: Parameters<typeof createForumPost>[0]) {
  const match = findSimilarForumPost(input);
  if (!match) {
    return { post: createForumPost(input), merged: false, similarityScore: 0 };
  }

  match.post.replies.push({
    id: randomUUID(),
    author: input.author?.trim() || 'Anonymous User',
    content: input.content.trim(),
    createdAt: new Date().toISOString(),
    similarReport: true,
    sourceReportId: input.sourceReportId?.trim() || null,
  });
  if (!match.post.crisisTag && input.crisisTag?.trim()) {
    match.post.crisisTag = input.crisisTag.trim();
  }
  if (!match.post.topicTag) {
    match.post.topicTag = input.topicTag?.trim().toLowerCase() || inferTopicTag(input.content, input.crisisTag, input.location);
  }
  match.post.similarReports += 1;
  likeForumPost(match.post.id, `similar:${normalizeAuthor(input.author ?? 'anonymous')}`);
  return { post: match.post, merged: true, similarityScore: match.score };
}

export function likeForumPost(id: string, likerKey = 'anonymous') {
  const post = forumPosts.find((item) => item.id === id);
  if (!post) return null;
  const likedBy = forumLikes.get(id) ?? new Set<string>();
  if (likedBy.has(likerKey)) return post;
  const dislikedBy = forumDislikes.get(id) ?? new Set<string>();
  if (dislikedBy.delete(likerKey)) {
    post.dislikes = Math.max(0, post.dislikes - 1);
    forumDislikes.set(id, dislikedBy);
  }
  likedBy.add(likerKey);
  forumLikes.set(id, likedBy);
  post.likes += 1;
  return post;
}

export function dislikeForumPost(id: string, likerKey = 'anonymous') {
  const post = forumPosts.find((item) => item.id === id);
  if (!post) return null;
  const dislikedBy = forumDislikes.get(id) ?? new Set<string>();
  if (dislikedBy.has(likerKey)) return post;
  const likedBy = forumLikes.get(id) ?? new Set<string>();
  if (likedBy.delete(likerKey)) {
    post.likes = Math.max(0, post.likes - 1);
    forumLikes.set(id, likedBy);
  }
  dislikedBy.add(likerKey);
  forumDislikes.set(id, dislikedBy);
  post.dislikes += 1;
  return post;
}

export function reportForumPost(id: string) {
  const post = forumPosts.find((item) => item.id === id);
  if (!post) return null;
  post.aiFlag = true;
  post.reports += 1;
  if (post.moderationState === 'live') {
    post.moderationState = 'under_review';
  }
  return post;
}

export function createForumReply(id: string, input: { author?: string; content: string; official?: boolean }) {
  const post = forumPosts.find((item) => item.id === id);
  if (!post) return null;
  const author = input.author?.trim() || 'Anonymous User';
  if (!input.official && bannedForumAuthors.has(normalizeAuthor(author))) {
    throw new ForumAuthorBannedError(author);
  }
  const reply: ForumReply = {
    id: randomUUID(),
    author,
    content: input.content.trim(),
    createdAt: new Date().toISOString(),
    official: Boolean(input.official),
  };
  post.replies.push(reply);
  return post;
}

export function findForumPostByReportId(reportId: string) {
  const normalizedReportId = reportId.trim().toLowerCase();
  if (!normalizedReportId) return null;
  return forumPosts.find((post) =>
    post.sourceReportId?.toLowerCase() === normalizedReportId
    || post.replies.some((reply) => reply.sourceReportId?.toLowerCase() === normalizedReportId),
  ) ?? null;
}

export function moderateForumPost(
  id: string,
  input: { action: 'verify' | 'hide' | 'review' | 'misleading' | 'resolve'; moderator?: string; note?: string },
) {
  const post = forumPosts.find((item) => item.id === id);
  if (!post) return null;

  const moderator = input.moderator?.trim() || 'Government Moderator';
  if (input.action === 'verify') {
    post.verified = true;
    post.aiFlag = false;
    post.reports = 0;
    post.moderationState = 'verified';
    if (input.note?.trim()) {
      post.replies.push({
        id: randomUUID(),
        author: moderator,
        content: input.note.trim(),
        createdAt: new Date().toISOString(),
        official: true,
      });
    }
    return post;
  }

  if (input.action === 'resolve') {
    post.aiFlag = false;
    post.reports = 0;
    post.moderationState = 'resolved';
    if (input.note?.trim()) {
      post.replies.push({
        id: randomUUID(),
        author: moderator,
        content: input.note.trim(),
        createdAt: new Date().toISOString(),
        official: true,
      });
    }
    return post;
  }

  if (input.action === 'hide' || input.action === 'misleading') {
    post.aiFlag = true;
    post.moderationState = input.action === 'misleading' ? 'misleading' : 'hidden';
    if (input.note?.trim()) {
      post.replies.push({
        id: randomUUID(),
        author: moderator,
        content: input.note.trim(),
        createdAt: new Date().toISOString(),
        official: true,
      });
    }
    return post;
  }

  post.aiFlag = true;
  post.moderationState = 'under_review';
  if (input.note?.trim()) {
    post.replies.push({
      id: randomUUID(),
      author: moderator,
      content: input.note.trim(),
      createdAt: new Date().toISOString(),
      official: true,
    });
  }
  return post;
}

export function verifyForumPostsByTopicTag(topicTag: string, options: { moderator?: string; note?: string } = {}) {
  const normalizedTopicTag = topicTag.trim().toLowerCase();
  if (!normalizedTopicTag) return [];

  const verifiedPosts: ForumPost[] = [];
  for (const post of forumPosts) {
    if (post.topicTag?.toLowerCase() !== normalizedTopicTag) continue;
    const verified = moderateForumPost(post.id, {
      action: 'verify',
      moderator: options.moderator,
      note: options.note,
    });
    if (verified) verifiedPosts.push(verified);
  }
  return verifiedPosts;
}

export function banForumAuthor(id: string, input: { moderator?: string; note?: string } = {}) {
  const post = forumPosts.find((item) => item.id === id);
  if (!post) return null;
  bannedForumAuthors.add(normalizeAuthor(post.author));
  for (const item of forumPosts) {
    if (normalizeAuthor(item.author) === normalizeAuthor(post.author)) {
      item.aiFlag = true;
      item.moderationState = 'hidden';
      if (input.note?.trim()) {
        item.replies.push({
          id: randomUUID(),
          author: input.moderator?.trim() || 'Government Moderator',
          content: input.note.trim(),
          createdAt: new Date().toISOString(),
          official: true,
        });
      }
    }
  }
  return post;
}

export class ForumAuthorBannedError extends Error {
  constructor(author: string) {
    super(`${author} is banned from posting in the community forum.`);
    this.name = 'ForumAuthorBannedError';
  }
}

function inferCategory(content: string) {
  const normalized = content.toLowerCase();
  if (normalized.includes('flood') || normalized.includes('rain') || normalized.includes('haze')) return 'Weather';
  if (normalized.includes('mask') || normalized.includes('hospital') || normalized.includes('dengue')) return 'Health';
  if (normalized.includes('mrt') || normalized.includes('road') || normalized.includes('traffic')) return 'Infrastructure';
  if (normalized.includes('stock') || normalized.includes('shortage') || normalized.includes('medicine')) return 'Supply';
  return 'Community';
}

function normalizeAuthor(author: string) {
  return author.trim().toLowerCase();
}

function findSimilarForumPost(input: Parameters<typeof createForumPost>[0]) {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const inputCategory = input.category?.trim() || inferCategory(input.content);
  const inputTokens = normalizedTokens(input.content);
  const normalizedInput = normalizeContent(input.content);
  const inputLocation = normalizeLocation(input.location);
  const inputTopicTag = input.topicTag?.trim().toLowerCase() || inferTopicTag(input.content, input.crisisTag, input.location);
  const inputTopicFamily = inferBaseTopic(input.content, input.crisisTag);

  return forumPosts
    .filter((post) => new Date(post.createdAt).getTime() >= cutoff)
    .map((post) => {
      const postTopicTag = locationQualifiedTopic(post);
      const postTopicFamily = inferBaseTopic(post.content, post.crisisTag);
      if (inputTopicFamily && inputTopicFamily === postTopicFamily && inputTopicTag && postTopicTag && inputTopicTag !== postTopicTag) {
        return { post, score: -1 };
      }
      const postTokens = normalizedTokens(post.content);
      const shared = [...inputTokens].filter((token) => postTokens.has(token)).length;
      const union = new Set([...inputTokens, ...postTokens]).size || 1;
      let score = shared / union;
      const normalizedPost = normalizeContent(post.content);
      if (normalizedInput === normalizedPost) {
        score = 1;
      } else if (normalizedInput.includes(normalizedPost) || normalizedPost.includes(normalizedInput)) {
        score = Math.max(score, 0.82);
      }
      if (post.category === inputCategory) {
        score += 0.08;
      }
      if (inputTopicTag && postTopicTag === inputTopicTag) {
        score += 0.2;
      }
      const postLocation = normalizeLocation(post.location);
      if (inputLocation && postLocation && (inputLocation.includes(postLocation) || postLocation.includes(inputLocation))) {
        score += 0.25;
      }
      return { post, score };
    })
    .filter((item) => item.score >= 0.5)
    .sort((left, right) =>
      new Date(left.post.createdAt).getTime() - new Date(right.post.createdAt).getTime() || right.score - left.score,
    )[0] ?? null;
}

function consolidateExactDuplicateThreads() {
  const ordered = [...forumPosts].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
  const originals = new Map<string, ForumPost>();

  for (const post of ordered) {
    const topic = locationQualifiedTopic(post) ?? '';
    post.topicTag = topic || null;
    const key = `${topic}:${normalizeContent(post.content)}`;
    const original = originals.get(key);
    if (!original) {
      originals.set(key, post);
      continue;
    }

    original.replies.push({
      id: randomUUID(),
      author: post.author,
      content: post.content,
      createdAt: post.createdAt,
      similarReport: true,
      sourceReportId: post.sourceReportId,
    }, ...post.replies);
    original.likes += post.likes;
    original.dislikes += post.dislikes;
    original.reports += post.reports;
    original.similarReports += post.similarReports + 1;
    original.crisisTag ||= post.crisisTag;
    original.topicTag ||= post.topicTag;

    const duplicateIndex = forumPosts.findIndex((item) => item.id === post.id);
    if (duplicateIndex >= 0) forumPosts.splice(duplicateIndex, 1);
  }
}

function normalizedTokens(value: string) {
  const stopwords = new Set(['about', 'after', 'again', 'from', 'have', 'near', 'that', 'the', 'this', 'with']);
  return new Set(
    value.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 3 && !stopwords.has(token)),
  );
}

function normalizeContent(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function inferTopicTag(content: string, crisisTag?: string | null, location?: string | null) {
  const baseTopic = inferBaseTopic(content, crisisTag);
  if (!baseTopic) return null;
  if (baseTopic === 'boon-lay-flooding') return baseTopic;

  const area = inferAreaTag(location);
  return area ? `${baseTopic}-${area}` : baseTopic;
}

function inferBaseTopic(content: string, crisisTag?: string | null) {
  const specificTag = crisisTag?.split('/').at(-1)?.trim().toLowerCase();
  const normalized = normalizeContent(content);
  if ((specificTag === 'boon lay flooding' || normalized.includes('boon lay')) && ['flood', 'flooding', 'rising water', 'drain overflow', 'water'].some((phrase) => normalized.includes(phrase))) {
    return 'boon-lay-flooding';
  }
  const topics: Array<[string, string[]]> = [
    ['flood', ['flood', 'flooding', 'flash flood', 'rising water', 'drain overflow']],
    ['ebola', ['ebola']],
    ['dengue', ['dengue']],
    ['haze', ['haze', 'smoke', 'air pollution']],
    ['fire', ['fire', 'burning', 'on fire']],
    ['power-outage', ['power outage', 'blackout', 'electricity outage']],
    ['water-outage', ['water outage', 'water disruption', 'no water']],
    ['train-disruption', ['train disruption', 'mrt disruption', 'mrt delay']],
    ['medicine-shortage', ['medicine shortage', 'medication shortage']],
  ];
  const baseTopic = specificTag && !specificTag.startsWith('other')
    ? slugTopic(specificTag)
    : topics.find(([, phrases]) => phrases.some((phrase) => normalized.includes(phrase)))?.[0] ?? null;
  return baseTopic;
}

function slugTopic(value: string) {
  return value.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function locationQualifiedTopic(post: ForumPost) {
  const inferred = inferTopicTag(post.content, post.crisisTag, post.location);
  if (post.topicTag === 'boon-lay-flooding' || inferred === 'boon-lay-flooding') return 'boon-lay-flooding';
  if (!post.topicTag) return inferred;
  if (inferred && inferBaseTopic(post.content, post.crisisTag)) return inferred;
  return post.topicTag;
}

function inferAreaTag(location?: string | null) {
  const firstLocationPart = (location ?? '').split(',')[0] ?? '';
  const tokens = normalizeContent(firstLocationPart)
    .split(' ')
    .filter(Boolean)
    .filter((token) => !/^\d+[a-z]?$/.test(token))
    .filter((token) => !locationNoiseWords.has(token));
  if (!tokens.length) return null;
  return slugTopic(tokens.slice(0, 4).join(' '));
}

const locationNoiseWords = new Set([
  'blk', 'block', 'building', 'centre', 'center', 'community', 'near', 'opposite',
  'road', 'rd', 'street', 'st', 'avenue', 'ave', 'drive', 'dr', 'lane', 'ln',
  'walk', 'way', 'close', 'crescent', 'place', 'plaza', 'mall', 'station', 'mrt',
  'singapore',
]);

function normalizeLocation(value: string | null | undefined) {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function rankForumPost(post: ForumPost, latitude?: number | null, longitude?: number | null): ForumPost {
  const ageHours = Math.max(0, (Date.now() - new Date(post.createdAt).getTime()) / 3_600_000);
  const recencyScore = Math.max(0, 20 - ageHours / 6);
  const voteScore = Math.min(30, post.likes * 2 - post.dislikes);
  const hasViewerLocation = Number.isFinite(latitude) && Number.isFinite(longitude);
  const hasPostLocation = Number.isFinite(post.latitude) && Number.isFinite(post.longitude);
  const distanceKm = hasViewerLocation && hasPostLocation
    ? haversineKm(latitude as number, longitude as number, post.latitude as number, post.longitude as number)
    : null;
  const proximityScore = distanceKm === null ? 0 : Math.max(0, 70 - distanceKm * 3.5);
  return { ...post, distanceKm, rankingScore: proximityScore + voteScore + recencyScore };
}

function compareForumFeedOrder(a: ForumPost, b: ForumPost) {
  const activityDifference = forumActivityTime(b) - forumActivityTime(a);
  if (activityDifference !== 0) return activityDifference;
  const rankingDifference = (b.rankingScore ?? 0) - (a.rankingScore ?? 0);
  if (rankingDifference !== 0) return rankingDifference;
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function forumActivityTime(post: ForumPost) {
  return Math.max(
    new Date(post.createdAt).getTime(),
    ...post.replies.map((reply) => new Date(reply.createdAt).getTime()),
  );
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
