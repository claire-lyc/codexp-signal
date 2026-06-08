import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  EyeOff,
  Flag,
  MessageSquare,
  Radio,
  Reply,
  Search,
  Send,
  Shield,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router';
import { API_REFRESH_INTERVAL_MS, apiUrl, useApi } from '../../lib/api';
import { authHeaders } from '../../lib/auth';

type CrisisTopic = {
  topic: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  score: number;
  trend: 'up' | 'down' | 'stable';
  source: string;
};

type QueueItem = {
  id: string | number;
  claim: string;
  status: 'flagged' | 'verified-false' | 'under-review';
  priority: 'high' | 'medium' | 'low';
  source: string;
  crisisType: string;
  reports: number;
};

type SentimentResponse = {
  stats: {
    overallScore: number;
    misinformationFlagged: number;
    pendingVerification: number;
    publicAnxietyLevel: string;
  };
  crisisTopicSets?: Record<string, CrisisTopic[]>;
  misinfoQueue: QueueItem[];
  socialSources: { platform: string; posts: number; sentiment: string; trending: string }[];
  crisisFilters?: { id: string; label: string }[];
  summary: { body: string; confidence: number; sources: string };
};

type ForumReply = {
  id: string;
  author: string;
  content: string;
  createdAt: string;
  official?: boolean;
};

type ForumModerationState = 'live' | 'under_review' | 'verified' | 'hidden';

type ForumPost = {
  id: string;
  author: string;
  content: string;
  createdAt: string;
  verified: boolean;
  aiFlag: boolean;
  likes: number;
  reports: number;
  moderationState: ForumModerationState;
  replies: ForumReply[];
  category: string;
};

type TabKey = 'overview' | 'forum' | 'queue';

const crisisTopicSets: Record<string, CrisisTopic[]> = {
  health: [
    { topic: 'Covid-19 Response', sentiment: 'positive', score: 72, trend: 'up', source: 'Social Media / Forum' },
    { topic: 'Medicine Availability (Panadol)', sentiment: 'negative', score: 38, trend: 'down', source: 'Citizen Reports / Tweets' },
    { topic: 'Hospital Wait Times', sentiment: 'neutral', score: 52, trend: 'stable', source: 'Forum / Reviews' },
    { topic: 'Dengue Prevention Info', sentiment: 'positive', score: 68, trend: 'up', source: 'Social Media' },
  ],
  weather: [
    { topic: 'Flood Preparedness', sentiment: 'neutral', score: 60, trend: 'up', source: 'Social Media' },
    { topic: 'Haze Advisories', sentiment: 'positive', score: 74, trend: 'up', source: 'Forum' },
    { topic: 'Public Transport Disruption', sentiment: 'negative', score: 41, trend: 'down', source: 'Twitter / Citizen Reports' },
  ],
  supply: [
    { topic: 'Panadol Shortage Anxiety', sentiment: 'negative', score: 29, trend: 'down', source: 'Twitter / WhatsApp' },
    { topic: 'Government Communication', sentiment: 'neutral', score: 56, trend: 'stable', source: 'Forum / Survey' },
    { topic: 'Essential Supply Status', sentiment: 'positive', score: 71, trend: 'up', source: 'Official Channels' },
  ],
};

const fallbackQueue: QueueItem[] = [
  { id: 1, claim: 'Hospitals running out of beds', status: 'flagged', priority: 'high', source: 'Twitter', crisisType: 'health', reports: 347 },
  { id: 2, claim: 'Water supply contaminated in Jurong', status: 'verified-false', priority: 'high', source: 'WhatsApp', crisisType: 'health', reports: 892 },
  { id: 3, claim: 'Border closure imminent next week', status: 'under-review', priority: 'medium', source: 'Reddit', crisisType: 'health', reports: 124 },
  { id: 4, claim: 'Panadol shortage is permanent', status: 'flagged', priority: 'medium', source: 'Social Media', crisisType: 'supply', reports: 203 },
];

const fallbackSources = [
  { platform: 'Twitter / X', posts: 12450, sentiment: 'mixed', trending: '#Singapore #Dengue #Panadol' },
  { platform: 'Citizen Reports', posts: 3287, sentiment: 'concerned', trending: 'Supply, Flood, Health' },
  { platform: 'Community Forum (SiGnal)', posts: 876, sentiment: 'moderate', trending: 'Transport, Haze' },
  { platform: 'WhatsApp Forwarded', posts: 5100, sentiment: 'anxious', trending: 'Misinformation detected' },
];

const fallbackFilters = [
  { id: 'health', label: 'Health' },
  { id: 'weather', label: 'Weather' },
  { id: 'supply', label: 'Supply Chain' },
];

const tabs: { id: TabKey; label: string }[] = [
  { id: 'overview', label: 'Sentiment Overview' },
  { id: 'forum', label: 'Forum Operations' },
  { id: 'queue', label: 'Misinformation Queue' },
];

export default function GovPublicSentiment() {
  const { data: sentiment, loading, error } = useApi<SentimentResponse>('/api/gov/sentiment');
  const [activeCrisis, setActiveCrisis] = useState('health');
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [forumPosts, setForumPosts] = useState<ForumPost[]>([]);
  const [forumQuery, setForumQuery] = useState('');
  const [officialPost, setOfficialPost] = useState('');
  const [officialReplyDrafts, setOfficialReplyDrafts] = useState<Record<string, string>>({});
  const [forumStatus, setForumStatus] = useState<string>('');
  const [forumError, setForumError] = useState<string>('');
  const [forumBusy, setForumBusy] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadForumPosts = () => {
      fetch(apiUrl('/api/forum/posts/moderation'), { headers: authHeaders() })
        .then((response) => {
          if (!response.ok) throw new Error('Unable to load forum moderation feed');
          return response.json() as Promise<{ items: ForumPost[] }>;
        })
        .then((data) => {
          if (!active) return;
          setForumPosts(data.items);
          setForumError('');
        })
        .catch((caught: unknown) => {
          if (!active) return;
          setForumError(caught instanceof Error ? caught.message : 'Unable to load forum moderation feed');
        });
    };

    loadForumPosts();
    const timer = window.setInterval(loadForumPosts, API_REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const activeTopicSets = sentiment?.crisisTopicSets ?? crisisTopicSets;
  const sentimentData = activeTopicSets[activeCrisis as keyof typeof activeTopicSets] ?? [];
  const activeSocialSources = sentiment?.socialSources ?? fallbackSources;
  const activeCrisisFilters = sentiment?.crisisFilters ?? fallbackFilters;
  const externalQueue = sentiment?.misinfoQueue ?? fallbackQueue;

  const filteredForumPosts = useMemo(() => {
    const normalized = forumQuery.trim().toLowerCase();
    if (!normalized) return forumPosts;

    return forumPosts.filter((post) =>
      post.content.toLowerCase().includes(normalized) ||
      post.author.toLowerCase().includes(normalized) ||
      post.category.toLowerCase().includes(normalized),
    );
  }, [forumPosts, forumQuery]);

  const forumQueue: QueueItem[] = useMemo(
    () =>
      forumPosts
        .filter((post) => post.aiFlag || post.reports > 0 || post.moderationState === 'under_review' || post.moderationState === 'hidden')
        .map((post) => ({
          id: `forum-${post.id}`,
          claim: post.content,
          status:
            post.moderationState === 'verified'
              ? 'verified-false'
              : post.moderationState === 'under_review' || post.moderationState === 'hidden'
                ? 'under-review'
                : 'flagged',
          priority: post.reports >= 20 ? 'high' : post.reports >= 5 ? 'medium' : 'low',
          source: 'SiGnal Community Forum',
          crisisType: post.category.toLowerCase(),
          reports: post.reports,
        })),
    [forumPosts],
  );

  const combinedQueue = [...forumQueue, ...externalQueue];
  const liveForumCount = forumPosts.filter((post) => post.moderationState === 'live').length;
  const verifiedForumCount = forumPosts.filter((post) => post.verified).length;
  const moderatedForumCount = forumPosts.filter((post) => post.moderationState !== 'live').length;

  const replacePost = (updatedPost: ForumPost) => {
    setForumPosts((current) => current.map((post) => (post.id === updatedPost.id ? updatedPost : post)));
  };

  const createOfficialPost = async () => {
    const content = officialPost.trim();
    if (!content) return;

    setForumBusy('create-post');
    setForumError('');
    try {
      const response = await fetch(apiUrl('/api/forum/posts/official'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          content,
          category: activeCrisisFilters.find((item) => item.id === activeCrisis)?.label ?? 'Community',
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Unable to publish official post');
      }
      setForumPosts((current) => [data.item as ForumPost, ...current]);
      setOfficialPost('');
      setForumStatus('Official post published to the community forum.');
    } catch (caught: unknown) {
      setForumError(caught instanceof Error ? caught.message : 'Unable to publish official post');
    } finally {
      setForumBusy(null);
    }
  };

  const runModerationAction = async (postId: string, action: 'verify' | 'hide' | 'review') => {
    setForumBusy(`${action}-${postId}`);
    setForumError('');
    try {
      const response = await fetch(apiUrl(`/api/forum/posts/${postId}/moderation`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          action,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Unable to update post moderation');
      }
      replacePost(data.item as ForumPost);
      setForumStatus(
        action === 'verify'
          ? 'Post verified and cleared.'
          : action === 'hide'
            ? 'Post hidden from public view.'
            : 'Post marked for moderator review.',
      );
    } catch (caught: unknown) {
      setForumError(caught instanceof Error ? caught.message : 'Unable to update post moderation');
    } finally {
      setForumBusy(null);
    }
  };

  const sendOfficialReply = async (postId: string) => {
    const content = officialReplyDrafts[postId]?.trim();
    if (!content) return;

    setForumBusy(`reply-${postId}`);
    setForumError('');
    try {
      const response = await fetch(apiUrl(`/api/forum/posts/${postId}/official-replies`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ content }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Unable to send official reply');
      }
      replacePost(data.item as ForumPost);
      setOfficialReplyDrafts((current) => ({ ...current, [postId]: '' }));
      setForumStatus('Official reply sent.');
    } catch (caught: unknown) {
      setForumError(caught instanceof Error ? caught.message : 'Unable to send official reply');
    } finally {
      setForumBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2 text-3xl font-bold">Public Sentiment Analysis</h1>
        <p className="text-zinc-400">Sentiment monitoring, community forum moderation, and misinformation handling in one workspace</p>
      </div>

      {loading && <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">Loading sentiment data...</div>}
      {error && <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-sm text-red-300">Sentiment API unavailable: {error}</div>}
      {forumError ? <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-sm text-red-300">{forumError}</div> : null}
      {forumStatus ? <div className="rounded-lg border border-blue-800 bg-blue-950/40 p-4 text-sm text-blue-300">{forumStatus}</div> : null}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          icon={<MessageSquare className="h-5 w-5 text-green-500" />}
          badge={<TrendingUp className="h-5 w-5 text-green-500" />}
          value={`${sentiment?.stats.overallScore ?? 0}%`}
          label="Overall Sentiment Score"
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
          badge={<span className="rounded bg-red-950 px-2 py-1 text-xs text-red-400">Active</span>}
          value={`${sentiment?.stats.misinformationFlagged ?? 0}`}
          label="Misinformation Flagged"
        />
        <StatCard
          icon={<Shield className="h-5 w-5 text-yellow-500" />}
          badge={<span className="rounded bg-yellow-950 px-2 py-1 text-xs text-yellow-400">Review</span>}
          value={String(forumPosts.length)}
          label="Forum Posts in View"
        />
        <StatCard
          icon={<Users className="h-5 w-5 text-blue-500" />}
          badge={<CheckCircle className="h-5 w-5 text-green-500" />}
          value={sentiment?.stats.publicAnxietyLevel ?? 'Loading'}
          label="Public Anxiety Level"
        />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Radio className="h-5 w-5 text-blue-500" />
              Social, Forum, and Citizen Report Sources
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {activeSocialSources.map((src) => (
                <div key={src.platform} className="rounded-lg bg-zinc-800 p-4">
                  <div className="mb-2 text-sm font-medium">{src.platform}</div>
                  <div className="mb-1 text-2xl font-bold">{src.posts.toLocaleString()}</div>
                  <div className="mb-2 text-xs text-zinc-400">posts / reports</div>
                  <div className="text-xs text-zinc-500">Sentiment: <span className="text-zinc-300">{src.sentiment}</span></div>
                  <div className="mt-1 text-xs text-zinc-500">Trending: <span className="text-zinc-300">{src.trending}</span></div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Topic Sentiment by Crisis</h2>
                <div className="flex gap-1">
                  {activeCrisisFilters.map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setActiveCrisis(filter.id)}
                      className={`rounded px-2.5 py-1 text-xs transition-colors ${activeCrisis === filter.id ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mb-4 text-xs text-zinc-500">Topics auto-adjust based on the most prevalent active crisis context.</p>
              <div className="space-y-4">
                {sentimentData.map((item) => (
                  <div key={item.topic}>
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <span className="text-sm">{item.topic}</span>
                        <div className="text-xs text-zinc-500">{item.source}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{item.score}%</span>
                        {item.trend === 'up' ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : item.trend === 'down' ? (
                          <TrendingUp className="h-4 w-4 rotate-180 text-red-500" />
                        ) : (
                          <div className="h-0.5 w-4 bg-zinc-500" />
                        )}
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-zinc-800">
                      <div
                        className={`h-2 rounded-full ${item.sentiment === 'positive' ? 'bg-green-600' : item.sentiment === 'neutral' ? 'bg-yellow-600' : 'bg-red-600'}`}
                        style={{ width: `${item.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Forum Operations Snapshot</h2>
                <button
                  onClick={() => setActiveTab('forum')}
                  className="inline-flex items-center gap-1 text-xs text-blue-400 transition-colors hover:text-blue-300"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open moderation tab
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <MiniStat label="Live posts" value={String(liveForumCount)} />
                <MiniStat label="Verified posts" value={String(verifiedForumCount)} />
                <MiniStat label="Moderated items" value={String(moderatedForumCount)} />
              </div>
              <div className="mt-5 space-y-3">
                {forumPosts.slice(0, 3).map((post) => (
                  <div key={post.id} className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">{post.author}</span>
                      <span className="text-xs text-zinc-500">{relativeTime(post.createdAt)}</span>
                    </div>
                    <p className="text-sm leading-6 text-zinc-300">{post.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-purple-900/50 bg-gradient-to-r from-purple-950/50 to-pink-950/50 p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-purple-900/50 p-3"><AlertTriangle className="h-6 w-6 text-purple-400" /></div>
              <div className="flex-1">
                <h3 className="mb-2 font-semibold">Analyst-Supported Sentiment Summary</h3>
                <p className="mb-3 text-sm text-zinc-300">
                  {sentiment?.summary.body ?? 'No sentiment summary available.'}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                  <span className="rounded bg-zinc-800 px-2 py-1">Confidence: {sentiment?.summary.confidence ?? 0}%</span>
                  <span className="rounded bg-zinc-800 px-2 py-1">Sources: {sentiment?.summary.sources ?? 'None'}</span>
                  <span className="rounded bg-yellow-900 px-2 py-1 text-yellow-400">Human Approval Required</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'forum' ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Government Forum Operations</h2>
                <p className="mt-1 text-sm text-zinc-400">Review live community posts, publish updates, verify reported content, and reply directly in the forum.</p>
              </div>
              <button
                onClick={() => setActiveTab('queue')}
                className="inline-flex items-center gap-1 rounded-lg bg-zinc-800 px-3 py-2 text-xs text-zinc-300 transition-colors hover:bg-zinc-700"
              >
                <Flag className="h-3.5 w-3.5" />
                Open misinformation queue
              </button>
            </div>

            <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-400" />
                  <h3 className="font-medium">Publish Post</h3>
                </div>
                <textarea
                  value={officialPost}
                  onChange={(event) => setOfficialPost(event.target.value)}
                  placeholder="Share an update with the community forum..."
                  rows={5}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <button
                  onClick={createOfficialPost}
                  disabled={forumBusy === 'create-post' || !officialPost.trim()}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                  Publish post
                </button>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Search className="h-4 w-4 text-zinc-400" />
                  <h3 className="font-medium">Search and moderate</h3>
                </div>
                <input
                  value={forumQuery}
                  onChange={(event) => setForumQuery(event.target.value)}
                  placeholder="Search forum posts, authors, or categories"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <MiniStat label="Reported posts" value={String(forumPosts.filter((post) => post.reports > 0).length)} />
                  <MiniStat label="AI flagged" value={String(forumPosts.filter((post) => post.aiFlag).length)} />
                  <MiniStat label="Hidden" value={String(forumPosts.filter((post) => post.moderationState === 'hidden').length)} />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {filteredForumPosts.map((post) => (
              <article key={post.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge text={post.category} icon={<MessageSquare className="h-3.5 w-3.5" />} />
                  {post.verified ? <Badge text="Verified" icon={<CheckCircle className="h-3.5 w-3.5" />} green /> : null}
                  {post.aiFlag ? <Badge text="AI Flagged" icon={<Flag className="h-3.5 w-3.5" />} red /> : null}
                  {post.moderationState === 'under_review' ? <Badge text="Under Review" icon={<AlertTriangle className="h-3.5 w-3.5" />} yellow /> : null}
                  {post.moderationState === 'hidden' ? <Badge text="Hidden" icon={<EyeOff className="h-3.5 w-3.5" />} yellow /> : null}
                  <span className="ml-auto text-xs text-zinc-500">{relativeTime(post.createdAt)}</span>
                </div>

                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="font-semibold text-zinc-100">{post.author}</div>
                  <div className="text-xs text-zinc-500">{post.likes} likes · {post.reports} reports</div>
                </div>

                <p className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 text-sm leading-6 text-zinc-300">{post.content}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => runModerationAction(post.id, 'verify')}
                    disabled={Boolean(forumBusy)}
                    className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Verify post
                  </button>
                  <button
                    onClick={() => runModerationAction(post.id, 'review')}
                    disabled={Boolean(forumBusy)}
                    className="inline-flex items-center gap-2 rounded-lg bg-yellow-700 px-3 py-2 text-sm font-medium hover:bg-yellow-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Flag className="h-4 w-4" />
                    Mark under review
                  </button>
                  <button
                    onClick={() => runModerationAction(post.id, 'hide')}
                    disabled={Boolean(forumBusy)}
                    className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <EyeOff className="h-4 w-4" />
                    Hide post
                  </button>
                </div>

                <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-200">
                    <Reply className="h-4 w-4 text-blue-400" />
                    Replies
                  </div>
                  <div className="space-y-2">
                    {post.replies.length ? (
                      post.replies.map((reply) => (
                        <div key={reply.id} className={`rounded-lg border px-3 py-2 text-sm ${reply.official ? 'border-blue-800 bg-blue-950/30' : 'border-zinc-800 bg-zinc-900'}`}>
                          <div className="mb-1 flex items-center justify-between gap-3 text-xs text-zinc-500">
                            <span className={reply.official ? 'text-blue-300' : 'text-zinc-400'}>{reply.author}</span>
                            <span>{relativeTime(reply.createdAt)}</span>
                          </div>
                          <p className="leading-6 text-zinc-300">{reply.content}</p>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-zinc-500">No replies yet.</div>
                    )}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <input
                      value={officialReplyDrafts[post.id] ?? ''}
                      onChange={(event) => setOfficialReplyDrafts((current) => ({ ...current, [post.id]: event.target.value }))}
                      placeholder="Write a reply"
                      className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <button
                      onClick={() => sendOfficialReply(post.id)}
                      disabled={Boolean(forumBusy) || !officialReplyDrafts[post.id]?.trim()}
                      className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Reply
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {activeTab === 'queue' ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Unified Misinformation Queue</h2>
                <p className="mt-1 text-sm text-zinc-400">Includes reported forum posts, AI-flagged community messages, and external misinformation from scraping pipelines.</p>
              </div>
              <Link to="/gov/form-handling" className="inline-flex items-center gap-1 text-xs text-blue-400 transition-colors hover:text-blue-300">
                <ExternalLink className="h-3 w-3" />
                View in Form Handling
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MiniStat label="Queue items" value={String(combinedQueue.length)} />
              <MiniStat label="Forum-derived" value={String(forumQueue.length)} />
              <MiniStat label="External scraping" value={String(externalQueue.length)} />
            </div>
          </div>

          <div className="space-y-3">
            {combinedQueue.map((item) => (
              <div
                key={item.id}
                className={`rounded-xl border p-4 ${item.priority === 'high' ? 'border-red-800 bg-red-950/30' : item.priority === 'medium' ? 'border-yellow-800 bg-yellow-950/30' : 'border-zinc-800 bg-zinc-900'}`}
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <div className="mb-1 text-sm font-medium">{item.claim}</div>
                    <div className="text-xs text-zinc-400">Source: {item.source} · Crisis: {item.crisisType} · {item.reports.toLocaleString()} reports</div>
                  </div>
                  <span className={`rounded px-2 py-1 text-xs whitespace-nowrap ${
                    item.status === 'flagged' ? 'bg-red-900 text-red-400' :
                    item.status === 'verified-false' ? 'bg-green-900 text-green-400' :
                    'bg-yellow-900 text-yellow-400'
                  }`}>
                    {item.status === 'flagged' ? 'AI FLAGGED' : item.status === 'verified-false' ? 'VERIFIED FALSE' : 'UNDER REVIEW'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium hover:bg-blue-700">
                    <Reply className="h-4 w-4" />
                    Draft official correction
                  </button>
                  <button className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium hover:bg-green-700">
                    <CheckCircle className="h-4 w-4" />
                    Mark verified false
                  </button>
                  <button className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium hover:bg-zinc-700">
                    <XCircle className="h-4 w-4" />
                    Escalate to analyst
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({
  icon,
  badge,
  value,
  label,
}: {
  icon: ReactNode;
  badge: ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="rounded-lg bg-zinc-800 p-2">{icon}</div>
        {badge}
      </div>
      <div className="mb-1 text-2xl font-bold">{value}</div>
      <div className="text-sm text-zinc-400">{label}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
      <div className="text-xl font-bold">{value}</div>
      <div className="mt-1 text-sm text-zinc-500">{label}</div>
    </div>
  );
}

function Badge({
  text,
  icon,
  green = false,
  red = false,
  yellow = false,
}: {
  text: string;
  icon: ReactNode;
  green?: boolean;
  red?: boolean;
  yellow?: boolean;
}) {
  const classes = green
    ? 'border-green-500 bg-green-600/20 text-green-200'
    : red
      ? 'border-red-500 bg-red-600/20 text-red-200'
      : yellow
        ? 'border-yellow-500 bg-yellow-600/20 text-yellow-200'
        : 'border-zinc-700 bg-zinc-800 text-zinc-300';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${classes}`}>
      {icon}
      {text}
    </span>
  );
}

function relativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return value;

  const deltaMinutes = Math.max(1, Math.round((Date.now() - timestamp) / 60000));
  if (deltaMinutes < 60) return `${deltaMinutes}m ago`;
  if (deltaMinutes < 1440) return `${Math.round(deltaMinutes / 60)}h ago`;
  return `${Math.round(deltaMinutes / 1440)}d ago`;
}
