import { randomUUID } from 'node:crypto';

export type ForumReply = {
  id: string;
  author: string;
  content: string;
  createdAt: string;
  official?: boolean;
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
  },
];

const forumLikes = new Map<string, Set<string>>();
const forumDislikes = new Map<string, Set<string>>();
const bannedForumAuthors = new Set<string>();

export function listForumPosts(options: { includeHidden?: boolean } = {}) {
  return [...forumPosts].filter((post) => {
    if (options.includeHidden) return true;
    return post.moderationState !== 'hidden' && post.moderationState !== 'misleading' && !bannedForumAuthors.has(normalizeAuthor(post.author));
  }).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function createForumPost(input: {
  author?: string;
  content: string;
  category?: string;
  aiFlag?: boolean;
  verified?: boolean;
  moderationState?: ForumModerationState;
  images?: Array<{ filename?: string | null; mimeType?: string | null; previewUrl?: string | null }>;
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
  };
  forumPosts.unshift(post);
  return post;
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
