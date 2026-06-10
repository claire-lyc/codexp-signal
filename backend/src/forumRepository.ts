import { randomUUID } from 'node:crypto';

export type ForumReply = {
  id: string;
  author: string;
  content: string;
  createdAt: string;
  official?: boolean;
  similarReport?: boolean;
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
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  sourceReportId: string | null;
  similarReports: number;
  distanceKm?: number | null;
  rankingScore?: number;
};

const forumPosts: ForumPost[] = [
  {
    id: 'forum-1',
    author: 'Sarah T.',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    content:
      'Does anyone know if Tampines community center is distributing N95 masks today? Need some for my elderly parents.',
    verified: false,
    aiFlag: false,
    likes: 12,
    dislikes: 0,
    reports: 0,
    moderationState: 'live',
    images: [],
    replies: [
      {
        id: 'reply-1',
        author: 'Community Volunteer',
        content: 'Tampines West CC posted that collection starts from 2 PM. Bring NRIC for each household member.',
        createdAt: new Date(Date.now() - 80 * 60 * 1000).toISOString(),
      },
      {
        id: 'reply-2',
        author: 'Priya N.',
        content: 'I collected mine there this morning. Queue was about 15 minutes.',
        createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
      },
    ],
    category: 'Health',
    location: 'Tampines',
    latitude: 1.3521,
    longitude: 103.9442,
    sourceReportId: null,
    similarReports: 0,
  },
  {
    id: 'forum-3',
    author: 'John L.',
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    content: 'Flood waters receding in East Coast area. Roads are passable now but still be careful.',
    verified: false,
    aiFlag: false,
    likes: 8,
    dislikes: 0,
    reports: 1,
    moderationState: 'live',
    images: [],
    replies: [],
    category: 'Weather',
    location: 'East Coast',
    latitude: 1.3008,
    longitude: 103.9122,
    sourceReportId: null,
    similarReports: 0,
  },
  {
    id: 'forum-4',
    author: 'Anonymous User',
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    content: 'BREAKING: All hospitals running out of beds and turning away patients!!!',
    verified: false,
    aiFlag: true,
    likes: 0,
    dislikes: 0,
    reports: 41,
    moderationState: 'under_review',
    images: [],
    replies: [],
    category: 'Health',
    location: null,
    latitude: null,
    longitude: null,
    sourceReportId: null,
    similarReports: 0,
  },
];

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
  });
  match.post.similarReports += 1;
  likeForumPost(match.post.id, `similar:${normalizeAuthor(input.author ?? 'anonymous')}:${match.post.similarReports}`);
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
  const inputLocation = normalizeLocation(input.location);

  return forumPosts
    .filter((post) => new Date(post.createdAt).getTime() >= cutoff && post.category === inputCategory)
    .map((post) => {
      const postTokens = normalizedTokens(post.content);
      const shared = [...inputTokens].filter((token) => postTokens.has(token)).length;
      const union = new Set([...inputTokens, ...postTokens]).size || 1;
      let score = shared / union;
      const postLocation = normalizeLocation(post.location);
      if (inputLocation && postLocation && (inputLocation.includes(postLocation) || postLocation.includes(inputLocation))) {
        score += 0.25;
      }
      return { post, score };
    })
    .filter((item) => item.score >= 0.42)
    .sort((left, right) =>
      new Date(left.post.createdAt).getTime() - new Date(right.post.createdAt).getTime() || right.score - left.score,
    )[0] ?? null;
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
