import {
  AlertTriangle,
  CheckCircle,
  Flag,
  Image as ImageIcon,
  MessageSquare,
  Plus,
  Reply,
  Search,
  Send,
  Shield,
  ThumbsDown,
  ThumbsUp,
  X,
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

type ForumImage = {
  id?: string;
  filename: string | null;
  mimeType: string | null;
  previewUrl: string;
};

type ForumPost = {
  id: string;
  author: string;
  content: string;
  createdAt: string;
  verified: boolean;
  aiFlag: boolean;
  likes: number;
  dislikes?: number;
  reports?: number;
  moderationState?: 'live' | 'under_review' | 'verified' | 'hidden' | 'misleading' | 'resolved';
  replies: ForumReply[];
  images?: ForumImage[];
  category: string;
};

const storageKey = 'signal-forum-posts';
const cooldownStorageKey = 'signal-forum-post-cooldown-until';
const likedPostsStorageKey = 'signal-forum-liked-posts';
const dislikedPostsStorageKey = 'signal-forum-disliked-posts';
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
    dislikes: 0,
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
    id: 'forum-3',
    author: 'John L.',
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    content: 'Flood waters receding in East Coast area. Roads are passable now but still be careful.',
    verified: false,
    aiFlag: false,
    likes: 8,
    dislikes: 0,
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
    replies: [],
    category: 'Health',
  },
];

export default function PublicForum() {
  const [posts, setPosts] = useState<ForumPost[]>(() => loadLocalPosts());
  const [author, setAuthor] = useState('');
  const [newPost, setNewPost] = useState('');
  const [postImages, setPostImages] = useState<ForumImage[]>([]);
  const [category, setCategory] = useState('Community');
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [status, setStatus] = useState<{ tone: 'success' | 'warning' | 'error'; message: string } | null>(null);
  const [usingBackend, setUsingBackend] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postCooldownUntil, setPostCooldownUntil] = useState(() => loadCooldownUntil());
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(() => loadLikedPostIds());
  const [dislikedPostIds, setDislikedPostIds] = useState<Set<string>>(() => loadDislikedPostIds());
  const [selectedImageOpen, setSelectedImageOpen] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setSelectedImageOpen(true);
  }, [expandedPostId]);

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
          setPosts(sanitizeForumPosts(data.items));
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
  const selectedPost = filteredPosts.find((post) => post.id === expandedPostId) ?? null;

  const postCooldownSeconds = Math.max(0, Math.ceil((postCooldownUntil - now) / 1000));

  const replacePost = (updatedPost: ForumPost) => {
    setPosts((current) => current.map((post) => (post.id === updatedPost.id ? updatedPost : post)));
  };

  const rememberLikedPost = (postId: string) => {
    setLikedPostIds((current) => {
      const next = new Set(current);
      next.add(postId);
      localStorage.setItem(likedPostsStorageKey, JSON.stringify([...next]));
      return next;
    });
    setDislikedPostIds((current) => {
      const next = new Set(current);
      next.delete(postId);
      localStorage.setItem(dislikedPostsStorageKey, JSON.stringify([...next]));
      return next;
    });
  };

  const rememberDislikedPost = (postId: string) => {
    setDislikedPostIds((current) => {
      const next = new Set(current);
      next.add(postId);
      localStorage.setItem(dislikedPostsStorageKey, JSON.stringify([...next]));
      return next;
    });
    setLikedPostIds((current) => {
      const next = new Set(current);
      next.delete(postId);
      localStorage.setItem(likedPostsStorageKey, JSON.stringify([...next]));
      return next;
    });
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    const images = await Promise.all([...files].slice(0, 3).map(readForumImage));
    setPostImages(images);
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
      images: postImages,
    });

    try {
      const data = await postJson<{ item: ForumPost }>('/api/forum/posts', {
        author: optimisticPost.author,
        content,
        category,
        images: postImages,
      });
      setPosts((current) => [data.item, ...current.filter((post) => post.id !== data.item.id)]);
      setExpandedPostId(data.item.id);
      setPostImages([]);
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
      setExpandedPostId(optimisticPost.id);
      setPostImages([]);
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
    if (likedPostIds.has(postId)) {
      setStatus({ tone: 'warning', message: 'You have already liked this post.' });
      return;
    }

    try {
      const data = await postJson<{ item: ForumPost }>(`/api/forum/posts/${postId}/like`, {});
      replacePost(data.item);
      rememberLikedPost(postId);
      setUsingBackend(true);
    } catch {
      setUsingBackend(false);
      updateLocalPosts(
        (current) => current.map((post) => (post.id === postId ? {
          ...post,
          likes: post.likes + 1,
          dislikes: dislikedPostIds.has(postId) ? Math.max(0, (post.dislikes ?? 0) - 1) : post.dislikes ?? 0,
        } : post)),
        setPosts,
      );
      rememberLikedPost(postId);
    }
  };

  const handleDislike = async (postId: string) => {
    if (dislikedPostIds.has(postId)) {
      setStatus({ tone: 'warning', message: 'You have already disliked this post.' });
      return;
    }

    try {
      const data = await postJson<{ item: ForumPost }>(`/api/forum/posts/${postId}/dislike`, {});
      replacePost(data.item);
      rememberDislikedPost(postId);
      setUsingBackend(true);
    } catch {
      setUsingBackend(false);
      updateLocalPosts(
        (current) => current.map((post) => (post.id === postId ? {
          ...post,
          likes: likedPostIds.has(postId) ? Math.max(0, post.likes - 1) : post.likes,
          dislikes: (post.dislikes ?? 0) + 1,
        } : post)),
        setPosts,
      );
      rememberDislikedPost(postId);
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

          {postImages.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {postImages.map((image) => (
                <div key={image.previewUrl} className="relative h-20 w-20 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-800">
                  <img src={image.previewUrl} alt={image.filename ?? 'Forum upload'} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPostImages((current) => current.filter((item) => item.previewUrl !== image.previewUrl))}
                    className="absolute right-1 top-1 rounded bg-zinc-950/80 px-1.5 py-0.5 text-xs text-zinc-200 hover:bg-red-950"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 transition-colors hover:bg-zinc-700" title="Add photo">
              <Plus className="h-5 w-5" />
              <input type="file" accept="image/*" multiple className="hidden" onChange={(event) => void handleImageUpload(event.target.files)} />
            </label>
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

        <div className="grid min-h-[560px] gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.25fr)]">
          <div className="space-y-3 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
            {filteredPosts.length === 0 && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-500">
                No posts match this filter.
              </div>
            )}
            {filteredPosts.map((post) => {
              const selected = selectedPost?.id === post.id;
              return (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => setExpandedPostId(post.id)}
                  className={`w-full rounded-lg border p-4 text-left transition-colors ${
                    selected
                      ? 'border-blue-600 bg-blue-950/30'
                      : post.aiFlag
                        ? 'border-red-900/70 bg-red-950/20 hover:bg-red-950/30'
                        : 'border-zinc-800 bg-zinc-900 hover:bg-zinc-800'
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-zinc-100">{post.author}</span>
                        {post.verified && <CheckCircle className="h-3.5 w-3.5 text-green-400" />}
                        {post.aiFlag && <AlertTriangle className="h-3.5 w-3.5 text-red-400" />}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                        <span className="rounded bg-zinc-800 px-2 py-0.5">{post.category}</span>
                        <span>{relativeTime(post.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400">
                      <MessageSquare className="h-3.5 w-3.5" />
                      {post.replies.length}
                    </div>
                  </div>
                  <p className={`line-clamp-2 text-sm leading-6 ${post.aiFlag ? 'text-red-200/70 blur-[2px]' : 'text-zinc-300'}`}>
                    {post.content}
                  </p>
                  {post.images?.[0] && (
                    <div className="mt-3 h-20 w-20 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-800">
                      <img src={post.images[0].previewUrl} alt={post.images[0].filename ?? 'Forum attachment'} className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div className="mt-3 flex items-center gap-3 text-xs text-zinc-500">
                    <span className={`inline-flex items-center gap-1 ${likedPostIds.has(post.id) ? 'text-blue-400' : ''}`}><ThumbsUp className="h-3.5 w-3.5" />{post.likes}</span>
                    <span className={`inline-flex items-center gap-1 ${dislikedPostIds.has(post.id) ? 'text-red-400' : ''}`}><ThumbsDown className="h-3.5 w-3.5" />{post.dislikes ?? 0}</span>
                    {post.reports ? <span className="inline-flex items-center gap-1 text-red-400"><Flag className="h-3.5 w-3.5" />{post.reports}</span> : null}
                  </div>
                </button>
              );
            })}
          </div>

          <aside className="min-h-[560px] rounded-lg border border-zinc-800 bg-zinc-950">
            {selectedPost ? (
              <div className="flex h-full flex-col">
                <div className="border-b border-zinc-800 px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">{selectedPost.category}</span>
                        {selectedPost.verified && (
                          <span className="inline-flex items-center gap-1 rounded bg-green-950 px-2 py-0.5 text-xs text-green-400">
                            <CheckCircle className="h-3 w-3" />
                            Official
                          </span>
                        )}
                        {selectedPost.aiFlag && (
                          <span className="inline-flex items-center gap-1 rounded bg-red-950 px-2 py-0.5 text-xs text-red-400">
                            <AlertTriangle className="h-3 w-3" />
                            Under review
                          </span>
                        )}
                      </div>
                      <h3 className="text-xl font-semibold leading-7">{threadTitle(selectedPost.content)}</h3>
                      <div className="mt-1 text-xs text-zinc-500">Started by {selectedPost.author} - {relativeTime(selectedPost.createdAt)}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleLike(selectedPost.id)}
                        disabled={likedPostIds.has(selectedPost.id)}
                        className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-blue-400 disabled:cursor-not-allowed disabled:text-blue-500"
                        aria-label="Like post"
                      >
                        <ThumbsUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDislike(selectedPost.id)}
                        disabled={dislikedPostIds.has(selectedPost.id)}
                        className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-red-400 disabled:cursor-not-allowed disabled:text-red-500"
                        aria-label="Dislike post"
                      >
                        <ThumbsDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedPostId(null)}
                        className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                        aria-label="Close discussion"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      {!selectedPost.verified && (
                        <button type="button" onClick={() => handleReport(selectedPost.id)} className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-red-400" aria-label="Report post">
                          <Flag className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto p-5">
                  <div className={`rounded-lg border p-4 ${selectedPost.aiFlag ? 'border-red-900/70 bg-red-950/20' : 'border-zinc-800 bg-zinc-900'}`}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="font-medium">{selectedPost.author}</span>
                      <span className="text-xs text-zinc-600">{new Date(selectedPost.createdAt).toLocaleString()}</span>
                    </div>
                    <p className={`whitespace-pre-wrap text-sm leading-6 ${selectedPost.aiFlag ? 'select-none blur-sm' : 'text-zinc-300'}`}>
                      {selectedPost.content}
                    </p>
                  </div>

                  {selectedPost.images?.length ? (
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900">
                      <button
                        type="button"
                        onClick={() => setSelectedImageOpen((open) => !open)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-zinc-300 hover:bg-zinc-800"
                      >
                        <span className="inline-flex items-center gap-2">
                          <ImageIcon className="h-4 w-4 text-blue-400" />
                          {selectedPost.images.length} photo{selectedPost.images.length > 1 ? 's' : ''}
                        </span>
                        <span className="text-xs text-zinc-500">{selectedImageOpen ? 'Collapse' : 'Open'}</span>
                      </button>
                      {selectedImageOpen && (
                        <div className="grid gap-3 border-t border-zinc-800 p-3 sm:grid-cols-2">
                          {selectedPost.images.map((image) => (
                            <a key={image.id ?? image.previewUrl} href={image.previewUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950">
                              <img src={image.previewUrl} alt={image.filename ?? 'Forum attachment'} className="max-h-72 w-full object-contain" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}

                  {selectedPost.aiFlag && (
                    <div className="rounded-lg border border-red-800 bg-red-950/30 p-3">
                      <div className="flex items-start gap-2 text-xs text-red-400">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                          <strong>{selectedPost.moderationState === 'hidden' ? 'Content hidden:' : 'Content flagged:'}</strong>{' '}
                          {selectedPost.moderationState === 'hidden'
                            ? 'this post was removed from normal view while moderators investigate it.'
                            : 'this post is hidden while a moderator verifies the claim.'}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 border-y border-zinc-800 py-3 text-xs text-zinc-500">
                    <span>{selectedPost.likes} likes</span>
                    <span>{selectedPost.dislikes ?? 0} dislikes</span>
                    <span>{selectedPost.replies.length} replies</span>
                    {selectedPost.reports ? <span className="text-red-400">{selectedPost.reports} reports</span> : null}
                  </div>

                  <div className="space-y-3">
                    {selectedPost.replies.length === 0 && (
                      <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-500">
                        No replies yet.
                      </div>
                    )}
                    {selectedPost.replies.map((reply) => (
                      <div key={reply.id} className={`rounded-lg p-3 ${reply.official ? 'border border-blue-800 bg-blue-950/30' : 'bg-zinc-900/70'}`}>
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <span className={`text-sm font-medium ${reply.official ? 'text-blue-300' : ''}`}>{reply.author}</span>
                          <span className="text-xs text-zinc-600">{relativeTime(reply.createdAt)}</span>
                        </div>
                        <p className="text-sm leading-6 text-zinc-300">{reply.content}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-zinc-800 p-4">
                  <div className="flex gap-2">
                    <input
                      value={replyText}
                      onChange={(event) => setReplyText(event.target.value)}
                      placeholder={`Reply to ${selectedPost.author}...`}
                      className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <button type="button" onClick={() => handleReply(selectedPost.id)} className="rounded-lg bg-blue-600 px-3 py-2 text-sm transition-colors hover:bg-blue-700">
                      Reply
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[560px] items-center justify-center p-8 text-center">
                <div>
                  <MessageSquare className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
                  <div className="font-medium text-zinc-300">Select a post</div>
                  <div className="mt-1 text-sm text-zinc-500">Click a community update to open the discussion thread here.</div>
                </div>
              </div>
            )}
          </aside>
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
    return Array.isArray(parsed) ? sanitizeForumPosts(parsed) : seedPosts;
  } catch {
    return seedPosts;
  }
}

function sanitizeForumPosts(posts: ForumPost[]) {
  return posts
    .filter((post) => post.author !== 'MOH Official')
    .map((post) => ({ ...post, dislikes: post.dislikes ?? 0, images: post.images ?? [] }));
}

function loadLikedPostIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(likedPostsStorageKey) ?? '[]') as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []);
  } catch {
    return new Set<string>();
  }
}

function loadDislikedPostIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(dislikedPostsStorageKey) ?? '[]') as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []);
  } catch {
    return new Set<string>();
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

function createLocalPost(input: { author: string; content: string; category: string; images?: ForumImage[] }): ForumPost {
  return {
    id: crypto.randomUUID(),
    author: input.author,
    content: input.content,
    createdAt: new Date().toISOString(),
    verified: false,
    aiFlag: shouldFlag(input.content),
    likes: 0,
    dislikes: 0,
    replies: [],
    images: input.images ?? [],
    category: input.category,
  };
}

function readForumImage(file: File): Promise<ForumImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      filename: file.name,
      mimeType: file.type,
      previewUrl: String(reader.result),
    });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
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

function threadTitle(content: string) {
  const firstLine = content.trim().split(/\r?\n/)[0] ?? 'Community discussion';
  return firstLine.length > 72 ? `${firstLine.slice(0, 69)}...` : firstLine;
}

function statusClass(tone: 'success' | 'warning' | 'error') {
  if (tone === 'success') return 'border-green-800 bg-green-950/50';
  if (tone === 'warning') return 'border-yellow-800 bg-yellow-950/40';
  return 'border-red-800 bg-red-950/40';
}
