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

export function listForumPosts(options: {
  includeHidden?: boolean;
  latitude?: number | null;
  longitude?: number | null;
} = {}) {
  return [...forumPosts].filter((post) => {
    if (options.includeHidden) return true;
    return post.moderationState !== 'hidden' && post.moderationState !== 'misleading' && !bannedForumAuthors.has(normalizeAuthor(post.author));
  }).map((post) => rankForumPost(post, options.latitude, options.longitude))
    .sort((a, b) => (b.rankingScore ?? 0) - (a.rankingScore ?? 0));
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

  const area = inferAreaTag(location);
  return area ? `${baseTopic}-${area}` : baseTopic;
}

function inferBaseTopic(content: string, crisisTag?: string | null) {
  const specificTag = crisisTag?.split('/').at(-1)?.trim().toLowerCase();
  const normalized = normalizeContent(content);
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

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
