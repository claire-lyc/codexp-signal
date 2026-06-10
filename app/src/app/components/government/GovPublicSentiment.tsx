import {
  AlertTriangle,
  CheckCircle,
  EyeOff,
  Flag,
  Image as ImageIcon,
  MessageSquare,
  Reply,
  Search,
  Shield,
  ThumbsDown,
  ThumbsUp,
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { API_REFRESH_INTERVAL_MS, fetchWithAuth, useApi } from '../../lib/api';

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
};

type ForumModerationState = 'live' | 'under_review' | 'verified' | 'hidden' | 'misleading' | 'resolved';

type ForumPost = {
  id: string;
  author: string;
  content: string;
  createdAt: string;
  verified: boolean;
  aiFlag: boolean;
  likes: number;
  dislikes?: number;
  reports: number;
  moderationState: ForumModerationState;
  replies: ForumReply[];
  images?: ForumImage[];
  category: string;
  similarReports?: number;
  sourceReportId?: string | null;
};

type SentimentPayload = {
  stats: {
    overallScore: number;
    misinformationFlagged: number;
    pendingVerification: number;
    publicAnxietyLevel: string;
  };
  crisisTopicSets: Record<string, Array<{ topic: string; sentiment: string; score: number; trend: string; source: string }>>;
  misinfoQueue: Array<{ id: string | number; claim: string; status: string; priority: string; source: string; crisisType: string; reports: number }>;
  socialSources: Array<{ platform: string; posts: number; sentiment: string; trending: string }>;
  crisisFilters: Array<{ id: string; label: string }>;
  summary: { body: string; confidence: number; sources: string };
};

const categories = ['All', 'Health', 'Weather', 'Infrastructure', 'Supply', 'Community'];
const moderationFilters = ['All', 'Reported', 'AI Flagged', 'Under Review', 'Hidden', 'Misleading', 'Resolved'];

export default function GovPublicSentiment() {
  const location = useLocation();
  const linkedPostId = new URLSearchParams(location.search).get('post');
  const linkedTicketId = new URLSearchParams(location.search).get('ticket');
  const { data: sentimentData } = useApi<SentimentPayload>('/api/gov/sentiment');
  const [activeTab, setActiveTab] = useState<'overview' | 'forum'>(location.pathname.endsWith('/forum') ? 'forum' : 'overview');
  const [forumPosts, setForumPosts] = useState<ForumPost[]>([]);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeModeration, setActiveModeration] = useState('All');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(linkedPostId);
  const [selectedImageOpen, setSelectedImageOpen] = useState(true);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [postAnalyticsMetric, setPostAnalyticsMetric] = useState<'rate' | 'upvotes' | 'engagement'>('rate');
  const [postAnalyticsVisible, setPostAnalyticsVisible] = useState(false);

  useEffect(() => {
    setActiveTab(location.pathname.endsWith('/forum') ? 'forum' : 'overview');
  }, [location.pathname]);

  useEffect(() => {
    if (linkedPostId) {
      setActiveTab('forum');
      setSelectedPostId(linkedPostId);
      setActiveCategory('All');
      setActiveModeration('All');
      setQuery('');
    }
  }, [linkedPostId]);

  useEffect(() => {
    setSelectedImageOpen(true);
    setPostAnalyticsVisible(false);
  }, [selectedPostId]);

  useEffect(() => {
    let active = true;

    const loadForumPosts = () => {
      fetchWithAuth('/api/forum/posts/moderation')
        .then((response) => {
          if (!response.ok) throw new Error('Unable to load forum moderation feed');
          return response.json() as Promise<{ items: ForumPost[] }>;
        })
        .then((data) => {
          if (!active) return;
          setForumPosts(data.items.map(normalizePost));
          setError('');
        })
        .catch((caught: unknown) => {
          if (!active) return;
          setError(caught instanceof Error ? caught.message : 'Unable to load forum moderation feed');
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

    return forumPosts.filter((post) => {
      const categoryMatch = activeCategory === 'All' || post.category === activeCategory;
      const textMatch =
        !normalizedQuery ||
        post.content.toLowerCase().includes(normalizedQuery) ||
        post.author.toLowerCase().includes(normalizedQuery) ||
        post.category.toLowerCase().includes(normalizedQuery);
      const moderationMatch = matchesModerationFilter(post, activeModeration);
      return categoryMatch && textMatch && moderationMatch;
    });
  }, [activeCategory, activeModeration, forumPosts, query]);

  const selectedPost = filteredPosts.find((post) => post.id === selectedPostId) ?? filteredPosts[0] ?? null;

  useEffect(() => {
    if (!selectedPostId && filteredPosts[0]) {
      setSelectedPostId(filteredPosts[0].id);
    }
    if (selectedPostId && filteredPosts.length > 0 && !filteredPosts.some((post) => post.id === selectedPostId)) {
      setSelectedPostId(filteredPosts[0]?.id ?? null);
    }
  }, [filteredPosts, selectedPostId]);

  const replacePost = (updatedPost: ForumPost) => {
    setForumPosts((current) => current.map((post) => (post.id === updatedPost.id ? normalizePost(updatedPost) : post)));
  };

  const forumQueueItems = useMemo(
    () =>
      forumPosts
        .filter((post) => post.reports > 0 || post.aiFlag)
        .slice(0, 6)
        .map((post) => ({
          id: `forum-${post.id}`,
          claim: threadTitle(post.content),
          status:
            post.moderationState === 'misleading' || post.moderationState === 'hidden'
              ? 'verified-false'
              : post.moderationState === 'under_review'
                ? 'under-review'
                : 'flagged',
          priority: post.aiFlag || post.reports > 2 ? 'high' : 'medium',
          source: 'Community Forum',
          crisisType: post.category.toLowerCase(),
          reports: post.reports ?? 0,
          postId: post.id,
        })),
    [forumPosts],
  );

  const combinedMisinfoQueue = useMemo(() => {
    const queue = sentimentData?.misinfoQueue ?? [];
    return [...forumQueueItems, ...queue].filter(
      (item, index, all) => all.findIndex((candidate) => candidate.claim === item.claim) === index,
    );
  }, [forumQueueItems, sentimentData]);

  const runModerationAction = async (postId: string, action: 'hide' | 'review' | 'misleading' | 'resolve') => {
    setBusy(`${action}-${postId}`);
    setError('');
    try {
      const response = await fetchWithAuth(`/api/forum/posts/${postId}/moderation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Unable to update post moderation');
      }
      replacePost(data.item as ForumPost);
      setStatus(moderationMessage(action));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Unable to update post moderation');
    } finally {
      setBusy(null);
    }
  };

  const banForumAuthor = async (postId: string) => {
    setBusy(`ban-${postId}`);
    setError('');
    try {
      const response = await fetchWithAuth(`/api/forum/posts/${postId}/ban-author`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: 'Author banned by government moderation team.' }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Unable to ban author');
      }
      setForumPosts((current) =>
        current.map((post) =>
          post.author === data.bannedAuthor ? { ...post, aiFlag: true, moderationState: 'hidden' } : post,
        ),
      );
      setStatus(`${data.bannedAuthor ?? 'Author'} banned. Their forum posts are hidden from citizens.`);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Unable to ban author');
    } finally {
      setBusy(null);
    }
  };

  const sendOfficialReply = async (postId: string) => {
    const content = replyDrafts[postId]?.trim();
    if (!content) return;

    setBusy(`reply-${postId}`);
    setError('');
    try {
      const response = await fetchWithAuth(`/api/forum/posts/${postId}/official-replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Unable to send reply');
      }
      replacePost(data.item as ForumPost);
      setReplyDrafts((current) => ({ ...current, [postId]: '' }));
      setStatus('Reply sent to the forum discussion.');
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Unable to send reply');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2 text-3xl font-bold">Public Sentiment Analysis</h1>
        <p className="text-zinc-400">Social monitoring, misinformation detection, and community forum moderation in one workspace.</p>
      </div>

      {error ? <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-sm text-red-300">{error}</div> : null}
      {status ? <div className="rounded-lg border border-blue-800 bg-blue-950/40 p-4 text-sm text-blue-300">{status}</div> : null}

      <div className="inline-flex rounded-xl border border-zinc-800 bg-zinc-900 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`rounded-lg px-4 py-2 text-sm transition-colors ${activeTab === 'overview' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'}`}
        >
          Sentiment Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('forum')}
          className={`rounded-lg px-4 py-2 text-sm transition-colors ${activeTab === 'forum' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'}`}
        >
          Forum Moderation
        </button>
      </div>

      {activeTab === 'overview' ? (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <SentimentStatCard label="Overall Sentiment Score" value={`${sentimentData?.stats?.overallScore ?? 0}%`} tone="green" />
            <SentimentStatCard
              label="Misinformation Flagged"
              value={String((sentimentData?.stats?.misinformationFlagged ?? 0) + forumQueueItems.length)}
              tone="red"
            />
            <SentimentStatCard label="Pending Verification" value={String(sentimentData?.stats?.pendingVerification ?? 0)} tone="yellow" />
            <SentimentStatCard label="Public Anxiety Level" value={sentimentData?.stats?.publicAnxietyLevel ?? 'Unknown'} tone="blue" />
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Shield className="h-5 w-5 text-blue-400" />
              Social Media & Citizen Report Sources
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(sentimentData?.socialSources ?? []).map((source) => (
                <div key={source.platform} className="rounded-lg bg-zinc-800 p-4">
                  <div className="mb-2 text-sm font-medium">{source.platform}</div>
                  <div className="text-2xl font-bold">{source.posts.toLocaleString()}</div>
                  <div className="mt-1 text-xs text-zinc-500">posts / reports</div>
                  <div className="mt-2 text-xs text-zinc-500">Sentiment: <span className="text-zinc-300">{source.sentiment}</span></div>
                  <div className="mt-1 text-xs text-zinc-500">Trending: <span className="text-zinc-300">{source.trending}</span></div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Topic Sentiment by Crisis</h2>
                <div className="flex gap-1">
                  {(sentimentData?.crisisFilters ?? []).map((filter) => (
                    <span key={filter.id} className="rounded bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300">
                      {filter.label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                {Object.entries(sentimentData?.crisisTopicSets ?? {}).flatMap(([group, items]) =>
                  items.map((item) => (
                    <div key={`${group}-${item.topic}`}>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm">{item.topic}</div>
                          <div className="text-xs text-zinc-500">{item.source}</div>
                        </div>
                        <div className="text-sm font-semibold">{item.score}%</div>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-800">
                        <div
                          className={`h-2 rounded-full ${item.sentiment === 'positive' ? 'bg-green-600' : item.sentiment === 'neutral' ? 'bg-yellow-600' : 'bg-red-600'}`}
                          style={{ width: `${item.score}%` }}
                        />
                      </div>
                    </div>
                  )),
                )}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Misinformation Queue</h2>
                <Link to="/gov/form-handling" className="text-xs text-blue-400 hover:text-blue-300">
                  View in Form Handling
                </Link>
              </div>
              <div className="space-y-3">
                {combinedMisinfoQueue.map((item) => (
                  <div key={item.id} className={`rounded-lg border p-4 ${item.priority === 'high' ? 'border-red-800 bg-red-950/30' : 'border-yellow-800 bg-yellow-950/30'}`}>
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">{item.claim}</div>
                        <div className="text-xs text-zinc-400">Source: {item.source} · {item.reports.toLocaleString()} reports</div>
                      </div>
                      <span className={`rounded px-2 py-1 text-xs ${
                        item.status === 'flagged'
                          ? 'bg-red-900 text-red-300'
                          : item.status === 'verified-false'
                            ? 'bg-green-900 text-green-300'
                            : 'bg-yellow-900 text-yellow-300'
                      }`}>
                        {item.status === 'flagged' ? 'AI FLAGGED' : item.status === 'verified-false' ? 'VERIFIED FALSE' : 'UNDER REVIEW'}
                      </span>
                    </div>
                    {'postId' in item ? (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('forum');
                          setSelectedPostId(item.postId);
                        }}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        Open linked forum thread
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-purple-900/50 bg-gradient-to-r from-purple-950/50 to-pink-950/50 p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-purple-900/50 p-3">
                <AlertTriangle className="h-6 w-6 text-purple-400" />
              </div>
              <div className="flex-1">
                <h3 className="mb-2 font-semibold">Analyst-Supported Sentiment Summary</h3>
                <p className="text-sm text-zinc-300">{sentimentData?.summary?.body ?? 'No summary available.'}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-400">
                  <span className="rounded bg-zinc-800 px-2 py-1">Confidence: {sentimentData?.summary?.confidence ?? 0}%</span>
                  <span className="rounded bg-zinc-800 px-2 py-1">Sources: {sentimentData?.summary?.sources ?? 'None'}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="rounded-xl border border-purple-900/50 bg-gradient-to-r from-purple-950/50 to-blue-950/50 p-5">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-purple-900/50 p-3">
                <Shield className="h-6 w-6 text-purple-400" />
              </div>
              <div className="flex-1">
                <h3 className="mb-2 font-semibold">Forum Moderation Queue</h3>
                <p className="text-sm text-zinc-300">
                  Review citizen posts, verify claims, send official replies, and route suspicious discussions into the misinformation queue.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900">
            <div className="border-b border-zinc-800 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-[260px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search posts, authors, or categories"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <MiniStat label="Posts" value={String(forumPosts.length)} />
                <MiniStat label="Reported" value={String(forumPosts.filter((post) => post.reports > 0).length)} />
                <MiniStat label="Hidden" value={String(forumPosts.filter((post) => ['hidden', 'misleading'].includes(post.moderationState)).length)} />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {categories.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setActiveCategory(item)}
                    className={`rounded-full px-3 py-1 text-xs transition-colors ${activeCategory === item ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {moderationFilters.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setActiveModeration(item)}
                    className={`rounded-full px-3 py-1 text-xs transition-colors ${activeModeration === item ? 'bg-zinc-200 text-zinc-950' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid min-h-[660px] lg:grid-cols-[minmax(360px,0.9fr)_minmax(520px,1.2fr)]">
              <div className="space-y-3 overflow-y-auto border-r border-zinc-800 bg-zinc-950/40 p-3">
                {filteredPosts.length === 0 && (
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-500">
                    No forum posts match these filters.
                  </div>
                )}
                {filteredPosts.map((post) => (
                  <ForumPostButton
                    key={post.id}
                    post={post}
                    selected={selectedPost?.id === post.id}
                    onClick={() => setSelectedPostId(post.id)}
                  />
                ))}
              </div>

              <aside className="min-h-[660px] bg-zinc-950">
                {selectedPost ? (
                  <div className="flex h-full flex-col">
                    <div className="border-b border-zinc-800 px-5 py-4">
                      {linkedTicketId && selectedPost.id === linkedPostId ? (
                        <div className="mb-3 rounded-lg border border-blue-800 bg-blue-950/30 px-3 py-2 text-xs text-blue-200">
                          Opened from ticket <span className="font-mono font-semibold">{linkedTicketId}</span>. This ticket is grouped under this forum thread.
                        </div>
                      ) : null}
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <Badge text={selectedPost.category} icon={<MessageSquare className="h-3.5 w-3.5" />} />
                            <ModerationBadges post={selectedPost} />
                          </div>
                          <h2 className="text-xl font-semibold leading-7">{threadTitle(selectedPost.content)}</h2>
                          <div className="mt-1 text-xs text-zinc-500">
                            Started by {selectedPost.author} - {relativeTime(selectedPost.createdAt)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedPostId(null)}
                          className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                          aria-label="Close discussion"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 space-y-4 overflow-y-auto p-5">
                      <div className={`rounded-lg border p-4 ${selectedPost.aiFlag ? 'border-red-900/70 bg-red-950/20' : 'border-zinc-800 bg-zinc-900'}`}>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="text-xs font-medium text-zinc-500">{selectedPost.author}</span>
                          <span className="text-xs text-zinc-600">{new Date(selectedPost.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="whitespace-pre-wrap text-base font-medium leading-7 text-zinc-100">{selectedPost.content}</p>
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
                          {selectedImageOpen ? (
                            <div className="grid gap-3 border-t border-zinc-800 p-3 sm:grid-cols-2">
                              {selectedPost.images.map((image) => (
                                <a key={image.id ?? image.previewUrl} href={image.previewUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950">
                                  <img src={image.previewUrl} alt={image.filename ?? 'Forum attachment'} className="max-h-72 w-full object-contain" />
                                </a>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="flex flex-wrap items-center gap-3 border-y border-zinc-800 py-3 text-xs text-zinc-500">
                        <span className="inline-flex items-center gap-1"><ThumbsUp className="h-3.5 w-3.5" />{selectedPost.likes} likes</span>
                        <span className="inline-flex items-center gap-1"><ThumbsDown className="h-3.5 w-3.5" />{selectedPost.dislikes ?? 0} dislikes</span>
                        <span className="inline-flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />{selectedPost.replies.length} replies</span>
                        {selectedPost.reports ? <span className="inline-flex items-center gap-1 text-red-400"><Flag className="h-3.5 w-3.5" />{selectedPost.reports} reports</span> : null}
                      </div>

                      <div>
                        <button
                          type="button"
                          onClick={() => setPostAnalyticsVisible((visible) => !visible)}
                          className="inline-flex items-center gap-2 rounded-lg border border-blue-800 bg-blue-950/30 px-3 py-2 text-sm font-medium text-blue-200 transition-colors hover:bg-blue-900/40"
                          aria-expanded={postAnalyticsVisible}
                        >
                          <ThumbsUp className="h-4 w-4" />
                          {postAnalyticsVisible ? 'Hide analytics' : 'Show analytics'}
                        </button>
                        {postAnalyticsVisible ? (
                          <div className="mt-3">
                            <PostAnalytics
                              post={selectedPost}
                              metric={postAnalyticsMetric}
                              onMetricChange={setPostAnalyticsMetric}
                            />
                          </div>
                        ) : null}
                      </div>

                      <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
                        <div className="mb-3 text-sm font-medium text-zinc-200">Moderation</div>
                        <div className="flex flex-wrap gap-2">
                          <ModerationButton busy={busy} onClick={() => runModerationAction(selectedPost.id, 'resolve')} tone="green" icon={<CheckCircle className="h-4 w-4" />}>Resolve</ModerationButton>
                          <ModerationButton busy={busy} onClick={() => runModerationAction(selectedPost.id, 'review')} tone="yellow" icon={<Flag className="h-4 w-4" />}>Under review</ModerationButton>
                          <ModerationButton busy={busy} onClick={() => runModerationAction(selectedPost.id, 'misleading')} tone="red" icon={<EyeOff className="h-4 w-4" />}>Misleading</ModerationButton>
                          <ModerationButton busy={busy} onClick={() => runModerationAction(selectedPost.id, 'hide')} tone="zinc" icon={<EyeOff className="h-4 w-4" />}>Hide</ModerationButton>
                          <ModerationButton busy={busy} onClick={() => banForumAuthor(selectedPost.id)} tone="redDark" icon={<XCircle className="h-4 w-4" />}>Ban author</ModerationButton>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {selectedPost.replies.length === 0 ? (
                          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-500">
                            No replies yet.
                          </div>
                        ) : null}
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
                          value={replyDrafts[selectedPost.id] ?? ''}
                          onChange={(event) => setReplyDrafts((current) => ({ ...current, [selectedPost.id]: event.target.value }))}
                          placeholder={`Reply to ${selectedPost.author}...`}
                          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                        <button
                          type="button"
                          onClick={() => sendOfficialReply(selectedPost.id)}
                          disabled={Boolean(busy) || !replyDrafts[selectedPost.id]?.trim()}
                          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Reply className="h-4 w-4" />
                          Reply
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full min-h-[660px] items-center justify-center p-8 text-center">
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
        </>
      )}
    </div>
  );
}

function SentimentStatCard({ label, value, tone }: { label: string; value: string; tone: 'green' | 'red' | 'yellow' | 'blue' }) {
  const toneStyles = {
    green: 'bg-green-950 text-green-400',
    red: 'bg-red-950 text-red-400',
    yellow: 'bg-yellow-950 text-yellow-400',
    blue: 'bg-blue-950 text-blue-400',
  }[tone];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className={`mb-3 inline-flex rounded-lg px-2.5 py-1 text-xs ${toneStyles}`}>{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function PostAnalytics({
  post,
  metric,
  onMetricChange,
}: {
  post: ForumPost;
  metric: 'rate' | 'upvotes' | 'engagement';
  onMetricChange: (metric: 'rate' | 'upvotes' | 'engagement') => void;
}) {
  const dislikes = post.dislikes ?? 0;
  const voteCount = post.likes + dislikes;
  const upvoteRate = voteCount ? Math.round((post.likes / voteCount) * 100) : 0;
  const engagement = voteCount + post.replies.length + post.reports;
  const timeline = postEngagementTimeline(post);
  const values = {
    rate: { value: `${upvoteRate}%`, label: `${post.likes} of ${voteCount} votes were upvotes` },
    upvotes: { value: String(post.likes), label: `${post.similarReports ?? 0} came from similar reports` },
    engagement: { value: String(engagement), label: 'Votes, replies, and reports combined' },
  };
  const selected = values[metric];

  return (
    <div className="rounded-lg border border-blue-900/60 bg-blue-950/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-blue-300">Post analytics</div>
          <div className="mt-1 text-3xl font-bold text-zinc-100">{selected.value}</div>
          <div className="mt-1 text-xs text-zinc-400">{selected.label}</div>
        </div>
        <select
          value={metric}
          onChange={(event) => onMetricChange(event.target.value as 'rate' | 'upvotes' | 'engagement')}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
          aria-label="Post analytics metric"
        >
          <option value="rate">Upvote rate</option>
          <option value="upvotes">Total upvotes</option>
          <option value="engagement">Total engagement</option>
        </select>
      </div>
      <div className="mt-5 border-t border-blue-900/50 pt-4">
        <div className="mb-4 text-sm font-medium text-zinc-300">Engagement over time</div>
        <EngagementTimeChart points={timeline} />
      </div>
    </div>
  );
}

function EngagementTimeChart({ points }: { points: Array<{ timestamp: number; value: number; label: string }> }) {
  const width = 620;
  const height = 220;
  const padding = { top: 16, right: 18, bottom: 42, left: 44 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const minTime = points[0]?.timestamp ?? Date.now();
  const maxTime = points.at(-1)?.timestamp ?? minTime;
  const timeRange = Math.max(1, maxTime - minTime);
  const maxValue = Math.max(1, ...points.map((point) => point.value));
  const plotted = points.map((point) => ({
    ...point,
    x: padding.left + ((point.timestamp - minTime) / timeRange) * chartWidth,
    y: padding.top + chartHeight - (point.value / maxValue) * chartHeight,
  }));
  const path = plotted.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const yTicks = [0, Math.ceil(maxValue / 2), maxValue].filter((value, index, all) => all.indexOf(value) === index);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[520px] w-full" role="img" aria-label="Cumulative engagement against time">
        {yTicks.map((tick) => {
          const y = padding.top + chartHeight - (tick / maxValue) * chartHeight;
          return (
            <g key={tick}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#3f3f46" strokeDasharray="4 4" />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" fill="#a1a1aa" fontSize="11">{tick}</text>
            </g>
          );
        })}
        <line x1={padding.left} x2={padding.left} y1={padding.top} y2={padding.top + chartHeight} stroke="#71717a" />
        <line x1={padding.left} x2={width - padding.right} y1={padding.top + chartHeight} y2={padding.top + chartHeight} stroke="#71717a" />
        <path d={path} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {plotted.map((point) => (
          <g key={`${point.timestamp}-${point.label}`}>
            <circle cx={point.x} cy={point.y} r="4" fill="#60a5fa">
              <title>{`${point.label}: ${point.value} engagement`}</title>
            </circle>
          </g>
        ))}
        <text x={padding.left} y={height - 16} fill="#a1a1aa" fontSize="11">{formatChartTime(minTime)}</text>
        <text x={width - padding.right} y={height - 16} textAnchor="end" fill="#a1a1aa" fontSize="11">{formatChartTime(maxTime)}</text>
        <text x={width / 2} y={height - 2} textAnchor="middle" fill="#d4d4d8" fontSize="12">Time</text>
        <text transform={`translate(13 ${height / 2}) rotate(-90)`} textAnchor="middle" fill="#d4d4d8" fontSize="12">Cumulative engagement</text>
      </svg>
      <div className="mt-2 text-xs text-zinc-500">
        Timeline uses the post and reply timestamps; current votes and reports are reflected at the latest point.
      </div>
    </div>
  );
}

function postEngagementTimeline(post: ForumPost) {
  const startTime = new Date(post.createdAt).getTime();
  const safeStart = Number.isNaN(startTime) ? Date.now() : startTime;
  const replyEvents = post.replies
    .map((reply) => ({ timestamp: new Date(reply.createdAt).getTime(), label: 'Reply' }))
    .filter((event) => !Number.isNaN(event.timestamp))
    .sort((left, right) => left.timestamp - right.timestamp);
  let cumulative = 0;
  const points = [{ timestamp: safeStart, value: 0, label: 'Post created' }];
  for (const reply of replyEvents) {
    cumulative += 1;
    points.push({ timestamp: reply.timestamp, value: cumulative, label: reply.label });
  }
  cumulative += post.likes + (post.dislikes ?? 0) + post.reports;
  const latestTime = Math.max(Date.now(), points.at(-1)?.timestamp ?? safeStart);
  points.push({ timestamp: latestTime, value: cumulative, label: 'Current total' });
  return points;
}

function formatChartTime(timestamp: number) {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function ForumPostButton({ post, selected, onClick }: { post: ForumPost; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg border p-4 text-left transition-colors ${
        selected
          ? 'border-blue-600 bg-blue-950/30'
          : post.aiFlag || post.moderationState === 'misleading'
            ? 'border-red-900/70 bg-red-950/20 hover:bg-red-950/30'
            : 'border-zinc-800 bg-zinc-900 hover:bg-zinc-800'
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-zinc-500">{post.author}</span>
            <ModerationBadges post={post} compact />
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
      <p className="line-clamp-2 text-base font-medium leading-6 text-zinc-100">{post.content}</p>
      {post.sourceReportId ? <TicketBadge ticketId={post.sourceReportId} compact /> : null}
      {post.images?.[0] ? (
        <div className="mt-3 h-20 w-20 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-800">
          <img src={post.images[0].previewUrl} alt={post.images[0].filename ?? 'Forum attachment'} className="h-full w-full object-cover" />
        </div>
      ) : null}
      <div className="mt-3 flex items-center gap-3 text-xs text-zinc-500">
        <span className="inline-flex items-center gap-1"><ThumbsUp className="h-3.5 w-3.5" />{post.likes}</span>
        <span className="inline-flex items-center gap-1"><ThumbsDown className="h-3.5 w-3.5" />{post.dislikes ?? 0}</span>
        {post.reports ? <span className="inline-flex items-center gap-1 text-red-400"><Flag className="h-3.5 w-3.5" />{post.reports}</span> : null}
      </div>
    </button>
  );
}

function ModerationBadges({ post, compact = false }: { post: ForumPost; compact?: boolean }) {
  return (
    <>
      {post.verified ? <Badge text={compact ? '' : 'Verified'} icon={<CheckCircle className="h-3.5 w-3.5 text-green-400" />} green compact={compact} /> : null}
      {post.aiFlag ? <Badge text={compact ? '' : 'AI Flagged'} icon={<AlertTriangle className="h-3.5 w-3.5 text-red-400" />} red compact={compact} /> : null}
      {post.moderationState === 'under_review' ? <Badge text={compact ? '' : 'Under Review'} icon={<Flag className="h-3.5 w-3.5 text-yellow-300" />} yellow compact={compact} /> : null}
      {post.moderationState === 'hidden' ? <Badge text={compact ? '' : 'Hidden'} icon={<EyeOff className="h-3.5 w-3.5" />} yellow compact={compact} /> : null}
      {post.moderationState === 'misleading' ? <Badge text={compact ? '' : 'Misleading'} icon={<EyeOff className="h-3.5 w-3.5" />} red compact={compact} /> : null}
      {post.moderationState === 'resolved' ? <Badge text={compact ? '' : 'Resolved'} icon={<CheckCircle className="h-3.5 w-3.5" />} green compact={compact} /> : null}
    </>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2">
      <div className="text-sm font-semibold text-zinc-100">{value}</div>
      <div className="text-[11px] text-zinc-500">{label}</div>
    </div>
  );
}

function TicketBadge({ ticketId, compact = false }: { ticketId: string; compact?: boolean }) {
  return (
    <span className={`mt-2 inline-flex rounded-md border border-blue-900 bg-blue-950/40 font-mono text-blue-300 ${compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'}`}>
      Ticket {ticketId}
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

function Badge({
  text,
  icon,
  green = false,
  red = false,
  yellow = false,
  compact = false,
}: {
  text: string;
  icon: ReactNode;
  green?: boolean;
  red?: boolean;
  yellow?: boolean;
  compact?: boolean;
}) {
  const classes = green
    ? 'border-green-500 bg-green-600/20 text-green-200'
    : red
      ? 'border-red-500 bg-red-600/20 text-red-200'
      : yellow
        ? 'border-yellow-500 bg-yellow-600/20 text-yellow-200'
        : 'border-zinc-700 bg-zinc-800 text-zinc-300';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border text-xs font-medium ${compact ? 'px-1.5 py-1' : 'px-2.5 py-1'} ${classes}`}>
      {icon}
      {text ? <span>{text}</span> : null}
    </span>
  );
}

function ModerationButton({
  children,
  icon,
  tone,
  busy,
  onClick,
}: {
  children: ReactNode;
  icon: ReactNode;
  tone: 'green' | 'yellow' | 'red' | 'redDark' | 'zinc';
  busy: string | null;
  onClick: () => void;
}) {
  const classes = {
    green: 'bg-green-600 hover:bg-green-700',
    yellow: 'bg-yellow-700 hover:bg-yellow-600',
    red: 'bg-red-700 hover:bg-red-600',
    redDark: 'bg-red-950 text-red-200 hover:bg-red-900',
    zinc: 'bg-zinc-800 hover:bg-zinc-700',
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={Boolean(busy)}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${classes}`}
    >
      {icon}
      {children}
    </button>
  );
}

function matchesModerationFilter(post: ForumPost, filter: string) {
  if (filter === 'All') return true;
  if (filter === 'Reported') return post.reports > 0;
  if (filter === 'AI Flagged') return post.aiFlag;
  if (filter === 'Under Review') return post.moderationState === 'under_review';
  if (filter === 'Hidden') return post.moderationState === 'hidden';
  if (filter === 'Misleading') return post.moderationState === 'misleading';
  if (filter === 'Resolved') return post.moderationState === 'resolved';
  return true;
}

function normalizePost(post: ForumPost): ForumPost {
  return {
    ...post,
    dislikes: post.dislikes ?? 0,
    reports: post.reports ?? 0,
    images: post.images ?? [],
    replies: post.replies ?? [],
    moderationState: post.moderationState ?? 'live',
  };
}

function moderationMessage(action: 'hide' | 'review' | 'misleading' | 'resolve') {
  if (action === 'resolve') return 'Forum report resolved.';
  if (action === 'misleading') return 'Post marked misleading and hidden from citizens.';
  if (action === 'hide') return 'Post hidden from public view.';
  return 'Post marked for moderator review.';
}

function relativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return value;

  const deltaMinutes = Math.max(1, Math.round((Date.now() - timestamp) / 60000));
  if (deltaMinutes < 60) return `${deltaMinutes}m ago`;
  if (deltaMinutes < 1440) return `${Math.round(deltaMinutes / 60)}h ago`;
  return `${Math.round(deltaMinutes / 1440)}d ago`;
}

function threadTitle(content: string) {
  const firstLine = content.trim().split(/\r?\n/)[0] ?? 'Community discussion';
  return firstLine.length > 72 ? `${firstLine.slice(0, 69)}...` : firstLine;
}
