import {
  AlertTriangle,
  CheckCircle,
  Flag,
  Image as ImageIcon,
  MapPin,
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
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { API_REFRESH_INTERVAL_MS, apiUrl } from '../../lib/api';
import { authHeaders } from '../../lib/auth';
import { floodDemoUpdatedEvent } from '../FloodDemoController';

type ForumReply = {
  id: string;
  author: string;
  content: string;
  createdAt: string;
  official?: boolean;
  similarReport?: boolean;
  sourceReportId?: string | null;
};

type ForumImage = {
  id?: string;
  filename: string | null;
  mimeType: string | null;
  previewUrl: string;
  byteSize?: number | null;
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
  crisisTag?: string | null;
  topicTag?: string | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  sourceReportId?: string | null;
  similarReports?: number;
  distanceKm?: number | null;
};

type AuthUser = {
  displayName: string | null;
  email: string | null;
  username: string | null;
};

const storageKey = 'signal-forum-posts';
const cooldownStorageKey = 'signal-forum-post-cooldown-until';
const likedPostsStorageKey = 'signal-forum-liked-posts';
const dislikedPostsStorageKey = 'signal-forum-disliked-posts';
const forumCooldownMs = Number(import.meta.env.VITE_FORUM_POST_COOLDOWN_MS ?? 60_000);
const categories = ['All', 'Health', 'Weather', 'Infrastructure', 'Supply', 'Community'];
const reportTypes = [
  { value: 'health', label: 'Health' },
  { value: 'environment', label: 'Weather & Environment' },
  { value: 'supply', label: 'Supply Shortage' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'transport', label: 'Transport' },
  { value: 'other', label: 'Other' },
];
const reportIssues: Record<string, string[]> = {
  health: ['COVID-19', 'Hantavirus', 'Dengue', 'Other health issue'],
  environment: ['Flash flood', 'Drain overflow', 'Rising water level', 'Haze', 'Air pollution', 'Water pollution', 'Other weather or environment issue'],
  supply: ['Medicine shortage', 'Food shortage', 'Essential goods shortage', 'Fuel shortage'],
  infrastructure: ['Power outage', 'Water supply disruption', 'Building or road damage', 'Telecommunications outage'],
  transport: ['Train disruption', 'Bus disruption', 'Traffic incident', 'Road obstruction'],
  other: ['Community safety issue', 'Public facility issue', 'Noise or nuisance', 'Other issue'],
};

const welcomePost: ForumPost = {
  id: 'signal-welcome-post',
  author: 'SiGnal Team',
  createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  content:
    'Welcome to the SiGnal community forum. Like this post to confirm you have found the official welcome thread, and use reports for urgent on-ground issues.',
  verified: true,
  aiFlag: false,
  likes: 24,
  dislikes: 0,
  reports: 0,
  replies: [
    {
      id: 'signal-welcome-reply',
      author: 'SiGnal Team',
      content: 'Helpful local updates are welcome. Report suspicious or harmful claims so moderators can review them quickly.',
      createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      official: true,
    },
  ],
  category: 'Community',
};

const seedPosts: ForumPost[] = [welcomePost];

export default function PublicForum() {
  const [posts, setPosts] = useState<ForumPost[]>(() => loadLocalPosts());
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [newPost, setNewPost] = useState('');
  const [postImages, setPostImages] = useState<ForumImage[]>([]);
  const [category, setCategory] = useState('Community');
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeTopic, setActiveTopic] = useState('All');
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [status, setStatus] = useState<{ tone: 'success' | 'warning' | 'error'; message: string } | null>(null);
  const [, setUsingBackend] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postCooldownUntil, setPostCooldownUntil] = useState(() => loadCooldownUntil());
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(() => loadLikedPostIds());
  const [dislikedPostIds, setDislikedPostIds] = useState<Set<string>>(() => loadDislikedPostIds());
  const [selectedImageOpen, setSelectedImageOpen] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [location, setLocation] = useState('');
  const [postAsReport, setPostAsReport] = useState(false);
  const [reportType, setReportType] = useState('other');
  const [specificIssue, setSpecificIssue] = useState('Other issue');
  const [viewerLocation, setViewerLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const communityUpdatesRef = useRef<HTMLDivElement | null>(null);
  const author = authUser?.username ?? authUser?.displayName ?? authUser?.email ?? 'Citizen';

  useEffect(() => {
    fetch(apiUrl('/api/auth/me'), { headers: authHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load signed-in user');
        return response.json() as Promise<{ user: AuthUser }>;
      })
      .then((data) => setAuthUser(data.user))
      .catch(() => setAuthUser(null));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setSelectedImageOpen(true);
  }, [expandedPostId]);

  useEffect(() => {
    const clearSelectedPost = (event: MouseEvent) => {
      if (!expandedPostId) return;
      const target = event.target as Node;
      if (communityUpdatesRef.current && !communityUpdatesRef.current.contains(target)) {
        setExpandedPostId(null);
      }
    };

    document.addEventListener('mousedown', clearSelectedPost);
    return () => document.removeEventListener('mousedown', clearSelectedPost);
  }, [expandedPostId]);

  useEffect(() => {
    let active = true;

    const loadForumPosts = () => {
      const params = viewerLocation
        ? `?latitude=${viewerLocation.latitude}&longitude=${viewerLocation.longitude}`
        : '';
      fetch(apiUrl(`/api/forum/posts${params}`))
        .then((response) => {
          if (!response.ok) throw new Error('Forum API unavailable');
          return response.json() as Promise<{ items: ForumPost[] }>;
        })
        .then((data) => {
          if (!active) return;
          setUsingBackend(true);
          setPosts(withWelcomePost(sanitizeForumPosts(data.items)));
        })
        .catch(() => {
          if (!active) return;
          setUsingBackend(false);
          setPosts(loadLocalPosts());
        });
    };

    loadForumPosts();
    const timer = window.setInterval(loadForumPosts, API_REFRESH_INTERVAL_MS);
    window.addEventListener(floodDemoUpdatedEvent, loadForumPosts);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener(floodDemoUpdatedEvent, loadForumPosts);
    };
  }, [viewerLocation]);

  const filteredPosts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return posts.filter((post) => {
      const categoryMatch = activeCategory === 'All' || post.category === activeCategory;
      const topicMatch = activeTopic === 'All' || post.topicTag === activeTopic;
      const textMatch =
        !normalizedQuery ||
        post.content.toLowerCase().includes(normalizedQuery) ||
        post.author.toLowerCase().includes(normalizedQuery);
      return categoryMatch && topicMatch && textMatch;
    });
  }, [activeCategory, activeTopic, posts, query]);
  const topicTags = useMemo(
    () => [...new Set(posts.map((post) => post.topicTag).filter((tag): tag is string => Boolean(tag)))].sort(),
    [posts],
  );
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
    if (postAsReport && (!reportType || !specificIssue)) {
      setStatus({ tone: 'error', message: 'Choose a report type and specific issue.' });
      return;
    }

    setPosting(true);
    setNewPost('');
    startPostCooldown(forumCooldownMs, setPostCooldownUntil);

    const optimisticPost = createLocalPost({
      author,
      content,
      category,
      images: postImages,
    });

    try {
      const data = await postJson<{
        item: ForumPost;
        merged?: boolean;
        linkedReportId?: string | null;
      }>('/api/forum/posts', {
        content,
        category,
        images: postImages,
        location,
        latitude: viewerLocation?.latitude ?? null,
        longitude: viewerLocation?.longitude ?? null,
        createReport: postAsReport,
        reportType,
        title: specificIssue,
      });
      setPosts((current) => [data.item, ...current.filter((post) => post.id !== data.item.id)]);
      setExpandedPostId(data.item.id);
      setPostImages([]);
      setComposerOpen(false);
      setLocation('');
      setReportType('other');
      setSpecificIssue('Other issue');
      setUsingBackend(true);
      setStatus({
        tone: data.item.aiFlag || data.merged ? 'warning' : 'success',
        message: data.merged
          ? `This was very similar to a recent post, so it was added beneath the original and automatically upvoted it.${data.linkedReportId ? ` Government report ${data.linkedReportId} was also created.` : ''}`
          : data.item.aiFlag
          ? 'Post submitted, but it was flagged for moderator review.'
          : `Post published to the community forum.${data.linkedReportId ? ` Government report ${data.linkedReportId} was also created.` : ''}`,
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

      if (postAsReport) {
        setNewPost(content);
        setStatus({
          tone: 'error',
          message: error instanceof Error ? error.message : 'Unable to create the linked government report.',
        });
        return;
      }

      setUsingBackend(false);
      updateLocalPosts((current) => [optimisticPost, ...current], setPosts);
      setExpandedPostId(optimisticPost.id);
      setPostImages([]);
      setComposerOpen(false);
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
        content,
      });
      replacePost(data.item);
      setUsingBackend(true);
    } catch {
      setUsingBackend(false);
      const reply: ForumReply = {
        id: crypto.randomUUID(),
        author,
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mb-2 text-3xl font-bold">Community Forum</h1>
          <p className="text-zinc-400">Share updates, ask for help, reply, and flag suspicious posts</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigator.geolocation?.getCurrentPosition((position) => {
              setViewerLocation({
                latitude: Number(position.coords.latitude.toFixed(6)),
                longitude: Number(position.coords.longitude.toFixed(6)),
              });
              setStatus({ tone: 'success', message: 'Nearby posts are now weighted more heavily in your feed.' });
            })}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            <MapPin className="h-4 w-4" />
            {viewerLocation ? 'Nearby ranking on' : 'Prioritize nearby'}
          </button>
          <button
            type="button"
            data-tour="compose-post"
            onClick={() => setComposerOpen((open) => !open)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            {composerOpen ? 'Close Compose' : 'Compose Post'}
          </button>
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

      {composerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <MessageSquare className="h-5 w-5 text-blue-600" />
                Create a Post
              </h2>
              <button
                type="button"
                data-tour="close-compose"
                onClick={() => setComposerOpen(false)}
                className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                aria-label="Close compose post"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_180px]">
              <div className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300">
                Posting as <span className="font-semibold text-zinc-100">{author}</span>
              </div>
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

              <input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Location or landmark, optional"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-blue-900/60 bg-blue-950/20 p-3">
                <input
                  type="checkbox"
                  checked={postAsReport}
                  onChange={(event) => setPostAsReport(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-blue-600"
                />
                <span>
                  <span className="block text-sm font-medium text-zinc-200">Link this to currently relevant government tag</span>
                  <span className="block text-xs text-zinc-500">You must be signed in. The forum post and ticket will be linked.</span>
                </span>
              </label>

              {postAsReport ? (
                <div className="grid gap-3 rounded-lg border border-zinc-700 bg-zinc-950/40 p-4 sm:grid-cols-2">
                  <label className="text-sm text-zinc-300">
                    Report type
                    <select
                      value={reportType}
                      onChange={(event) => {
                        const nextType = event.target.value;
                        setReportType(nextType);
                        setSpecificIssue(reportIssues[nextType]?.[0] ?? '');
                      }}
                      className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
                    >
                      {reportTypes.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm text-zinc-300">
                    Specific issue
                    <select
                      value={specificIssue}
                      onChange={(event) => setSpecificIssue(event.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
                    >
                      {(reportIssues[reportType] ?? []).map((issue) => (
                        <option key={issue} value={issue}>{issue}</option>
                      ))}
                    </select>
                  </label>
                  <div className="text-xs text-zinc-500 sm:col-span-2">
                    The government report stores the selected issue, description, location, coordinates, reporter, images, severity, agency, triage status, and subject grouping.
                  </div>
                </div>
              ) : null}

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

              <div className="flex flex-wrap items-center justify-between gap-2">
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
        </div>
      )}

      <div ref={communityUpdatesRef} className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
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

        {topicTags.length > 0 ? (
          <div className="mb-4 flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-3">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Topics</span>
            <button
              type="button"
              onClick={() => setActiveTopic('All')}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                activeTopic === 'All'
                  ? 'border-violet-500 bg-violet-600 text-white'
                  : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              All topics
            </button>
            {topicTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTopic(tag)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  activeTopic === tag
                    ? 'border-violet-500 bg-violet-600 text-white'
                    : 'border-violet-900/70 bg-violet-950/30 text-violet-300 hover:bg-violet-950/60'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        ) : null}

        <div className="grid min-h-[560px] gap-4 lg:h-[min(72vh,720px)] lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.25fr)]">
          <div className="min-h-0 space-y-3 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 [scrollbar-color:#3f3f46_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-700/70">
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
                  data-tour={post.id === welcomePost.id ? 'welcome-post' : undefined}
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
                        <span className="text-xs font-medium text-zinc-500">{post.author}</span>
                        {post.verified && <CheckCircle className="h-3.5 w-3.5 text-green-400" />}
                        {post.aiFlag && <AlertTriangle className="h-3.5 w-3.5 text-red-400" />}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                        <span className="rounded bg-zinc-800 px-2 py-0.5">{post.category}</span>
                        {post.topicTag ? <TopicTag text={post.topicTag} /> : null}
                        {post.crisisTag ? <CrisisTag text={post.crisisTag} compact /> : null}
                        <span>{relativeTime(post.createdAt)}</span>
                        {post.distanceKm != null && <span>{post.distanceKm.toFixed(1)} km away</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400">
                      <MessageSquare className="h-3.5 w-3.5" />
                      {post.replies.length}
                    </div>
                  </div>
                  <p className={`line-clamp-2 text-base font-medium leading-6 ${post.aiFlag ? 'text-red-200/70 blur-[2px]' : 'text-zinc-100'}`}>
                    {post.content}
                  </p>
                  {post.sourceReportId ? <TicketBadge ticketId={post.sourceReportId} compact /> : null}
                  {post.images?.[0] && (
                    <div className="mt-3 h-20 w-20 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-800">
                      <img src={post.images[0].previewUrl} alt={post.images[0].filename ?? 'Forum attachment'} className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div className="mt-3 flex items-center gap-3 text-xs text-zinc-500">
                    <span className={`inline-flex items-center gap-1 ${likedPostIds.has(post.id) ? 'text-blue-400' : ''}`}><ThumbsUp className="h-3.5 w-3.5" />{post.likes}</span>
                    <span className={`inline-flex items-center gap-1 ${dislikedPostIds.has(post.id) ? 'text-red-400' : ''}`}><ThumbsDown className="h-3.5 w-3.5" />{post.dislikes ?? 0}</span>
                    {post.reports ? <span className="inline-flex items-center gap-1 text-red-400"><Flag className="h-3.5 w-3.5" />{post.reports}</span> : null}
                    {post.similarReports ? <span>{post.similarReports} similar reports</span> : null}
                  </div>
                </button>
              );
            })}
          </div>

          <aside className="hidden min-h-0 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 lg:block">
            {selectedPost ? (
              <div className="flex h-full flex-col">
                <div className="border-b border-zinc-800 px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">{selectedPost.category}</span>
                        {selectedPost.topicTag ? <TopicTag text={selectedPost.topicTag} /> : null}
                        {selectedPost.crisisTag ? <CrisisTag text={selectedPost.crisisTag} /> : null}
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
                        data-tour={selectedPost.id === welcomePost.id ? 'welcome-like' : undefined}
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
                      {!selectedPost.verified && (
                        <button type="button" onClick={() => handleReport(selectedPost.id)} className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-red-400" aria-label="Report post">
                          <Flag className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setExpandedPostId(null)}
                        className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                        aria-label="Close discussion"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto p-5">
                  <div className={`rounded-lg border p-4 ${selectedPost.aiFlag ? 'border-red-900/70 bg-red-950/20' : 'border-zinc-800 bg-zinc-900'}`}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-xs font-medium text-zinc-500">{selectedPost.author}</span>
                      <span className="text-xs text-zinc-600">{new Date(selectedPost.createdAt).toLocaleString()}</span>
                    </div>
                    <p className={`whitespace-pre-wrap text-base font-medium leading-7 ${selectedPost.aiFlag ? 'select-none blur-sm' : 'text-zinc-100'}`}>
                      {selectedPost.content}
                    </p>
                    {selectedPost.sourceReportId ? <TicketBadge ticketId={selectedPost.sourceReportId} /> : null}
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
                          <span className={`text-xs font-medium ${reply.official ? 'text-blue-300' : 'text-zinc-500'}`}>{reply.author}</span>
                          <span className="text-xs text-zinc-600">{relativeTime(reply.createdAt)}</span>
                        </div>
                        <p className="text-base font-medium leading-7 text-zinc-100">{reply.content}</p>
                        {reply.sourceReportId || reply.similarReport ? (
                          <GroupedEntryBadge ticketId={reply.sourceReportId} entryId={reply.id} />
                        ) : null}
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

        {selectedPost && (
          <div className="fixed inset-0 z-50 flex items-end bg-zinc-950/70 p-0 backdrop-blur-sm lg:hidden">
            <section className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-xl border border-zinc-700 bg-zinc-950 shadow-2xl">
              <div className="border-b border-zinc-800 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">{selectedPost.category}</span>
                      {selectedPost.topicTag ? <TopicTag text={selectedPost.topicTag} /> : null}
                      {selectedPost.crisisTag ? <CrisisTag text={selectedPost.crisisTag} /> : null}
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
                    <h3 className="text-lg font-semibold leading-6">{threadTitle(selectedPost.content)}</h3>
                    <div className="mt-1 text-xs text-zinc-500">Started by {selectedPost.author} - {relativeTime(selectedPost.createdAt)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedPostId(null)}
                    className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                    aria-label="Close discussion"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleLike(selectedPost.id)}
                    disabled={likedPostIds.has(selectedPost.id)}
                    data-tour={selectedPost.id === welcomePost.id ? 'welcome-like' : undefined}
                    className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-blue-400 disabled:cursor-not-allowed disabled:text-blue-500"
                    aria-label="Like post"
                  >
                    <ThumbsUp className="h-4 w-4" />
                    Like
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDislike(selectedPost.id)}
                    disabled={dislikedPostIds.has(selectedPost.id)}
                    className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-red-400 disabled:cursor-not-allowed disabled:text-red-500"
                    aria-label="Dislike post"
                  >
                    <ThumbsDown className="h-4 w-4" />
                    Dislike
                  </button>
                  {!selectedPost.verified && (
                    <button
                      type="button"
                      onClick={() => handleReport(selectedPost.id)}
                      className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-red-400"
                      aria-label="Report post"
                    >
                      <Flag className="h-4 w-4" />
                      Report
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                <div className={`rounded-lg border p-4 ${selectedPost.aiFlag ? 'border-red-900/70 bg-red-950/20' : 'border-zinc-800 bg-zinc-900'}`}>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium text-zinc-500">{selectedPost.author}</span>
                    <span className="text-xs text-zinc-600">{new Date(selectedPost.createdAt).toLocaleString()}</span>
                  </div>
                  <p className={`whitespace-pre-wrap text-base font-medium leading-7 ${selectedPost.aiFlag ? 'select-none blur-sm' : 'text-zinc-100'}`}>
                    {selectedPost.content}
                  </p>
                  {selectedPost.sourceReportId ? <TicketBadge ticketId={selectedPost.sourceReportId} /> : null}
                </div>

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
                        <span className={`text-xs font-medium ${reply.official ? 'text-blue-300' : 'text-zinc-500'}`}>{reply.author}</span>
                        <span className="text-xs text-zinc-600">{relativeTime(reply.createdAt)}</span>
                      </div>
                      <p className="text-base font-medium leading-7 text-zinc-100">{reply.content}</p>
                      {reply.sourceReportId || reply.similarReport ? (
                        <GroupedEntryBadge ticketId={reply.sourceReportId} entryId={reply.id} />
                      ) : null}
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
                    className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <button type="button" onClick={() => handleReply(selectedPost.id)} className="rounded-lg bg-blue-600 px-3 py-2 text-sm transition-colors hover:bg-blue-700">
                    Reply
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}
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
              Data mode: Connected to backend forum API
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
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
    return Array.isArray(parsed) ? withWelcomePost(sanitizeForumPosts(parsed)) : seedPosts;
  } catch {
    return seedPosts;
  }
}

function sanitizeForumPosts(posts: ForumPost[]) {
  const removedSeedPostIds = new Set(['forum-1', 'forum-3', 'forum-4']);
  return posts
    .filter((post) => post.author !== 'MOH Official' && !removedSeedPostIds.has(post.id))
    .map((post) => ({ ...post, dislikes: post.dislikes ?? 0, images: post.images ?? [] }));
}

function withWelcomePost(posts: ForumPost[]) {
  const existing = posts.find((post) => post.id === welcomePost.id);
  return [
    existing ? { ...welcomePost, ...existing, verified: true, aiFlag: false } : welcomePost,
    ...posts.filter((post) => post.id !== welcomePost.id),
  ];
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
      byteSize: file.size,
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

function TicketBadge({ ticketId, compact = false }: { ticketId: string; compact?: boolean }) {
  return (
    <span className={`mt-2 inline-flex rounded-md border border-blue-900 bg-blue-950/40 font-mono text-blue-300 ${compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'}`}>
      Ticket {ticketId}
    </span>
  );
}

function CrisisTag({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <span className={`inline-flex rounded-md border border-red-900/70 bg-red-950/40 font-medium text-red-200 ${compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'}`}>
      Crisis: {text}
    </span>
  );
}

function TopicTag({ text }: { text: string }) {
  return (
    <span className="inline-flex rounded-md border border-violet-900/70 bg-violet-950/30 px-1.5 py-0.5 text-[10px] font-medium text-violet-300">
      #{text}
    </span>
  );
}

function GroupedEntryBadge({ ticketId, entryId }: { ticketId?: string | null; entryId: string }) {
  if (ticketId) return <TicketBadge ticketId={ticketId} />;
  return (
    <span className="mt-2 inline-flex rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-xs text-zinc-400">
      Ticket {fallbackTicketId(entryId)}
    </span>
  );
}

function fallbackTicketId(value: string) {
  return `TKT-${value.replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase()}`;
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
