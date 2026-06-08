import {
  AlertTriangle,
  CheckCircle,
  Flag,
  MessageSquare,
  Reply,
  Search,
  Send,
  Shield,
  ThumbsUp,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { API_REFRESH_INTERVAL_MS, apiUrl } from '../../lib/api';

type ForumReply = {
  id: string;
  author: string;
  content: string;
  createdAt: string;
  official?: boolean;
};

type ForumPost = {
  id: string;
  author: string;
  content: string;
  createdAt: string;
  verified: boolean;
  aiFlag: boolean;
  likes: number;
  reports?: number;
  moderationState?: 'live' | 'under_review' | 'verified' | 'hidden';
  replies: ForumReply[];
  category: string;
};

const storageKey = 'signal-forum-posts';
const cooldownStorageKey = 'signal-forum-post-cooldown-until';
const forumCooldownMs = Number(import.meta.env.VITE_FORUM_POST_COOLDOWN_MS ?? 60_000);
const categories = ['All', 'Health', 'Weather', 'Infrastructure', 'Supply', 'Community'];

const seedPosts: ForumPost[] = [
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
        id: 'reply-2',
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

export default function PublicForum() {
  const [posts, setPosts] = useState<ForumPost[]>(() => loadLocalPosts());
  const [author, setAuthor] = useState('');
  const [newPost, setNewPost] = useState('');
  const [category, setCategory] = useState('Community');
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [status, setStatus] = useState<{ tone: 'success' | 'warning' | 'error'; message: string } | null>(null);
  const [usingBackend, setUsingBackend] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postCooldownUntil, setPostCooldownUntil] = useState(() => loadCooldownUntil());
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;

    const loadForumPosts = () => {
      fetch(apiUrl('/api/forum/posts'))
        .then((response) => {
          if (!response.ok) throw new Error('Forum API unavailable');
          return response.json() as Promise<{ items: ForumPost[] }>;
        })
        .then((data) => {
          if (!active) return;
          setUsingBackend(true);
          setPosts(data.items);
        })
        .catch(() => {
          if (!active) return;
          setUsingBackend(false);
          setPosts(loadLocalPosts());
        });
    };

    loadForumPosts();
    const timer = window.setInterval(loadForumPosts, API_REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const filteredPosts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return posts.filter((post) => {
      const categoryMatch = activeCategory === 'All' || post.category === activeCategory;
      const textMatch =
        !normalizedQuery ||
        post.content.toLowerCase().includes(normalizedQuery) ||
        post.author.toLowerCase().includes(normalizedQuery);
      return categoryMatch && textMatch;
    });
  }, [activeCategory, posts, query]);

  const postCooldownSeconds = Math.max(0, Math.ceil((postCooldownUntil - now) / 1000));

  const replacePost = (updatedPost: ForumPost) => {
    setPosts((current) => current.map((post) => (post.id === updatedPost.id ? updatedPost : post)));
  };

  const handleSubmitPost = async () => {
    if (posting) return;
    if (postCooldownSeconds > 0) {
      setStatus({
        tone: 'warning',
        message: `Please wait ${postCooldownSeconds} seconds before posting again.`,
      });
      return;
    }

    const content = newPost.trim();
    if (!content) {
      setStatus({ tone: 'error', message: 'Write something before posting.' });
      return;
    }

    setPosting(true);
    setNewPost('');
    startPostCooldown(forumCooldownMs, setPostCooldownUntil);

    const optimisticPost = createLocalPost({
      author: author.trim() || 'Anonymous User',
      content,
      category,
    });

    try {
      const data = await postJson<{ item: ForumPost }>('/api/forum/posts', {
        author: optimisticPost.author,
        content,
        category,
      });
      setPosts((current) => [data.item, ...current.filter((post) => post.id !== data.item.id)]);
      setUsingBackend(true);
      setStatus({
        tone: data.item.aiFlag ? 'warning' : 'success',
        message: data.item.aiFlag
          ? 'Post submitted, but it was flagged for moderator review.'
          : 'Post published to the community forum.',
      });
    } catch (error) {
      if (error instanceof CooldownError) {
        setUsingBackend(true);
        setNewPost(content);
        startPostCooldown(error.retryAfterSeconds * 1000, setPostCooldownUntil);
        setStatus({
          tone: 'warning',
          message: `Please wait ${error.retryAfterSeconds} seconds before posting again.`,
        });
        return;
      }

      setUsingBackend(false);
      updateLocalPosts((current) => [optimisticPost, ...current], setPosts);
      setStatus({
        tone: optimisticPost.aiFlag ? 'warning' : 'success',
        message: optimisticPost.aiFlag
          ? 'Saved locally and flagged for review. Start the backend to sync it later.'
          : 'Saved locally. Start the backend to share it across devices.',
      });
    } finally {
      setPosting(false);
    }
  };

  const handleLike = async (postId: string) => {
    try {
      const data = await postJson<{ item: ForumPost }>(`/api/forum/posts/${postId}/like`, {});
      replacePost(data.item);
      setUsingBackend(true);
    } catch {
      setUsingBackend(false);
      updateLocalPosts(
        (current) => current.map((post) => (post.id === postId ? { ...post, likes: post.likes + 1 } : post)),
        setPosts,
      );
    }
  };

  const handleReport = async (postId: string) => {
    try {
      const data = await postJson<{ item: ForumPost }>(`/api/forum/posts/${postId}/report`, {});
      replacePost(data.item);
      setUsingBackend(true);
    } catch {
      setUsingBackend(false);
      updateLocalPosts(
        (current) => current.map((post) => (post.id === postId ? { ...post, aiFlag: true } : post)),
        setPosts,
      );
    }
    setStatus({ tone: 'warning', message: 'Thanks. The post has been flagged for moderator review.' });
  };

  const handleReply = async (postId: string) => {
    const content = replyText.trim();
    if (!content) return;

    try {
      const data = await postJson<{ item: ForumPost }>(`/api/forum/posts/${postId}/replies`, {
        author: author.trim() || 'Anonymous User',
        content,
      });
      replacePost(data.item);
      setUsingBackend(true);
    } catch {
      setUsingBackend(false);
      const reply: ForumReply = {
        id: crypto.randomUUID(),
        author: author.trim() || 'Anonymous User',
        content,
        createdAt: new Date().toISOString(),
      };
      updateLocalPosts(
        (current) =>
          current.map((post) =>
            post.id === postId ? { ...post, replies: [...post.replies, reply] } : post,
          ),
        setPosts,
      );
    }

    setReplyText('');
    setExpandedPostId(postId);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2 text-3xl font-bold">Community Forum</h1>
        <p className="text-zinc-400">Share updates, ask for help, reply, and flag suspicious posts</p>
      </div>

      <div className="rounded-xl border border-purple-900/50 bg-gradient-to-r from-purple-950/50 to-blue-950/50 p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-purple-900/50 p-3">
            <Shield className="h-6 w-6 text-purple-400" />
          </div>
          <div className="flex-1">
            <h3 className="mb-2 font-semibold">Content Moderation & Safety</h3>
            <p className="text-sm text-zinc-300">
              Posts with risky misinformation patterns are hidden behind a review warning. Official government accounts are marked with a verified badge.
            </p>
            <div className="mt-2 text-xs text-zinc-500">
              Data mode: {usingBackend ? 'Connected to backend forum API' : 'Website-only local mode'}
            </div>
          </div>
        </div>
      </div>

      {status && (
        <div className={`rounded-xl border p-5 ${statusClass(status.tone)}`}>
          <div className="flex items-center gap-3">
            {status.tone === 'success' ? (
              <CheckCircle className="h-6 w-6 text-green-500" />
            ) : (
              <AlertTriangle className="h-6 w-6 text-yellow-500" />
            )}
            <div className="text-sm text-zinc-200">{status.message}</div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <MessageSquare className="h-5 w-5 text-blue-600" />
          Create a Post
        </h2>

        <div className="grid gap-3 md:grid-cols-[1fr_180px]">
          <input
            value={author}
            onChange={(event) => setAuthor(event.target.value)}
            placeholder="Your name, optional"
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            {categories.filter((item) => item !== 'All').map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>

        <div className="mt-4 space-y-4">
          <textarea
            value={newPost}
            onChange={(event) => setNewPost(event.target.value)}
            placeholder="Share an update or ask for help from your community..."
            rows={4}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />

          <button
            type="button"
            onClick={handleSubmitPost}
            disabled={posting || postCooldownSeconds > 0 || !newPost.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            <Send className="h-4 w-4" />
            {posting
              ? 'Posting...'
              : postCooldownSeconds > 0
                ? `Wait ${postCooldownSeconds}s`
                : 'Post to Community'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Community Updates</h2>
          <div className="relative min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search posts"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setActiveCategory(item)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                activeCategory === item ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {filteredPosts.map((post) => {
            const expanded = expandedPostId === post.id;

            return (
              <article
                key={post.id}
                className={`rounded-lg border p-5 ${
                  post.aiFlag
                    ? 'border-red-800 bg-red-950/20'
                    : post.verified
                      ? 'border-green-900/30 bg-green-950/10'
                      : 'border-zinc-700 bg-zinc-800'
                }`}
              >
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{post.author}</span>
                    <span className="rounded bg-zinc-900 px-2 py-0.5 text-xs text-zinc-400">{post.category}</span>
                    {post.verified && (
                      <div className="flex items-center gap-1 rounded bg-green-950 px-2 py-0.5 text-xs text-green-400">
                        <CheckCircle className="h-3 w-3" />
                        <span>Official</span>
                      </div>
                    )}
                    {post.aiFlag && (
                      <div className="flex items-center gap-1 rounded bg-red-950 px-2 py-0.5 text-xs text-red-400">
                        <AlertTriangle className="h-3 w-3" />
                        <span>Flagged - under review</span>
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-zinc-500">{relativeTime(post.createdAt)}</span>
                </div>

                <p className={`mb-3 text-sm ${post.aiFlag ? 'blur-sm select-none' : 'text-zinc-300'}`}>
                  {post.content}
                </p>

                {post.aiFlag && (
                  <div className="mb-3 rounded border border-red-800 bg-red-950/30 p-3">
                    <div className="flex items-start gap-2 text-xs text-red-400">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <strong>{post.moderationState === 'hidden' ? 'Content hidden:' : 'Content flagged:'}</strong>{' '}
                        {post.moderationState === 'hidden'
                          ? 'this post was removed from normal view while moderators investigate it.'
                          : 'this post is hidden while a moderator verifies the claim.'}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-500">
                  <button type="button" onClick={() => handleLike(post.id)} className="flex items-center gap-1 transition-colors hover:text-blue-400">
                    <ThumbsUp className="h-4 w-4" />
                    <span>{post.likes}</span>
                  </button>
                  <button type="button" onClick={() => setExpandedPostId(expanded ? null : post.id)} className="flex items-center gap-1 transition-colors hover:text-blue-400">
                    <Reply className="h-4 w-4" />
                    <span>{post.replies.length} replies</span>
                  </button>
                  {!post.verified && (
                    <button type="button" onClick={() => handleReport(post.id)} className="flex items-center gap-1 transition-colors hover:text-red-400">
                      <Flag className="h-4 w-4" />
                      <span>Report</span>
                    </button>
                  )}
                </div>

                {expanded && (
                  <div className="mt-4 space-y-3 border-t border-zinc-700 pt-4">
                    {post.replies.map((reply) => (
                      <div key={reply.id} className={`rounded-lg p-3 ${reply.official ? 'border border-blue-800 bg-blue-950/30' : 'bg-zinc-900/70'}`}>
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <span className={`text-sm font-medium ${reply.official ? 'text-blue-300' : ''}`}>{reply.author}</span>
                          <span className="text-xs text-zinc-600">{relativeTime(reply.createdAt)}</span>
                        </div>
                        <p className="text-sm text-zinc-300">{reply.content}</p>
                      </div>
                    ))}

                    <div className="flex gap-2">
                      <input
                        value={replyText}
                        onChange={(event) => setReplyText(event.target.value)}
                        placeholder="Write a reply..."
                        className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                      <button type="button" onClick={() => handleReply(post.id)} className="rounded-lg bg-blue-600 px-3 py-2 text-sm transition-colors hover:bg-blue-700">
                        Reply
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string; retryAfterSeconds?: number } | null;
    if (response.status === 429 && payload?.retryAfterSeconds) {
      throw new CooldownError(payload.error ?? 'Please wait before posting again.', payload.retryAfterSeconds);
    }
    throw new Error(payload?.error ?? `${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

class CooldownError extends Error {
  constructor(message: string, readonly retryAfterSeconds: number) {
    super(message);
  }
}

function loadLocalPosts() {
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return seedPosts;
    const parsed = JSON.parse(stored) as ForumPost[];
    return Array.isArray(parsed) ? parsed : seedPosts;
  } catch {
    return seedPosts;
  }
}

function loadCooldownUntil() {
  const stored = Number(localStorage.getItem(cooldownStorageKey));
  return Number.isFinite(stored) ? stored : 0;
}

function startPostCooldown(ms: number, setPostCooldownUntil: Dispatch<SetStateAction<number>>) {
  const until = Date.now() + ms;
  localStorage.setItem(cooldownStorageKey, String(until));
  setPostCooldownUntil(until);
}

function updateLocalPosts(
  updater: (current: ForumPost[]) => ForumPost[],
  setPosts: Dispatch<SetStateAction<ForumPost[]>>,
) {
  setPosts((current) => {
    const next = updater(current.length ? current : loadLocalPosts());
    localStorage.setItem(storageKey, JSON.stringify(next));
    return next;
  });
}

function createLocalPost(input: { author: string; content: string; category: string }): ForumPost {
  return {
    id: crypto.randomUUID(),
    author: input.author,
    content: input.content,
    createdAt: new Date().toISOString(),
    verified: false,
    aiFlag: shouldFlag(input.content),
    likes: 0,
    replies: [],
    category: input.category,
  };
}

function shouldFlag(content: string) {
  const normalized = content.toLowerCase();
  return ['breaking:', 'all hospitals', 'secret', 'cover up', 'confirmed cure', '!!!'].some((term) =>
    normalized.includes(term),
  );
}

function relativeTime(timestamp: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(timestamp).getTime()) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} days ago`;
}

function statusClass(tone: 'success' | 'warning' | 'error') {
  if (tone === 'success') return 'border-green-800 bg-green-950/50';
  if (tone === 'warning') return 'border-yellow-800 bg-yellow-950/40';
  return 'border-red-800 bg-red-950/40';
}
