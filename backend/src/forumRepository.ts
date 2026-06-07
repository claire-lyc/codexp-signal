export type ForumReply = {
  id: string;
  author: string;
  content: string;
  createdAt: string;
};

export type ForumPost = {
  id: string;
  author: string;
  content: string;
  createdAt: string;
  verified: boolean;
  aiFlag: boolean;
  likes: number;
  replies: ForumReply[];
  category: string;
};

const misinformationTerms = [
  'all hospitals',
  'turning away',
  'confirmed cure',
  'secret',
  'cover up',
  'breaking:',
  '!!!',
];

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
    id: 'forum-2',
    author: 'MOH Official',
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    content:
      'Important reminder: all mask distribution points are listed on the official MOH website. Please check there for the latest information.',
    verified: true,
    aiFlag: false,
    likes: 45,
    replies: [
      {
        id: 'reply-3',
        author: 'Moderator',
        content: 'Pinned as verified guidance.',
        createdAt: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(),
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
    replies: [],
    category: 'Health',
  },
];

export function listForumPosts() {
  return [...forumPosts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function createForumPost(input: { author?: string; content: string; category?: string }) {
  const content = input.content.trim();
  const post: ForumPost = {
    id: crypto.randomUUID(),
    author: input.author?.trim() || 'Anonymous User',
    content,
    createdAt: new Date().toISOString(),
    verified: false,
    aiFlag: shouldFlag(content),
    likes: 0,
    replies: [],
    category: input.category?.trim() || inferCategory(content),
  };
  forumPosts.unshift(post);
  return post;
}

export function likeForumPost(id: string) {
  const post = forumPosts.find((item) => item.id === id);
  if (!post) return null;
  post.likes += 1;
  return post;
}

export function reportForumPost(id: string) {
  const post = forumPosts.find((item) => item.id === id);
  if (!post) return null;
  post.aiFlag = true;
  return post;
}

export function createForumReply(id: string, input: { author?: string; content: string }) {
  const post = forumPosts.find((item) => item.id === id);
  if (!post) return null;
  const reply: ForumReply = {
    id: crypto.randomUUID(),
    author: input.author?.trim() || 'Anonymous User',
    content: input.content.trim(),
    createdAt: new Date().toISOString(),
  };
  post.replies.push(reply);
  return post;
}

function shouldFlag(content: string) {
  const normalized = content.toLowerCase();
  return misinformationTerms.some((term) => normalized.includes(term));
}

function inferCategory(content: string) {
  const normalized = content.toLowerCase();
  if (normalized.includes('flood') || normalized.includes('rain') || normalized.includes('haze')) return 'Weather';
  if (normalized.includes('mask') || normalized.includes('hospital') || normalized.includes('dengue')) return 'Health';
  if (normalized.includes('mrt') || normalized.includes('road') || normalized.includes('traffic')) return 'Infrastructure';
  if (normalized.includes('stock') || normalized.includes('shortage') || normalized.includes('medicine')) return 'Supply';
  return 'Community';
}
