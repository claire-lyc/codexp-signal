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
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { API_REFRESH_INTERVAL_MS, apiUrl } from '../../lib/api';
import { authHeaders } from '../../lib/auth';

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
};

const categories = ['All', 'Health', 'Weather', 'Infrastructure', 'Supply', 'Community'];
const moderationFilters = ['All', 'Reported', 'AI Flagged', 'Under Review', 'Hidden', 'Misleading', 'Resolved'];

export default function GovPublicSentiment() {
  const [forumPosts, setForumPosts] = useState<ForumPost[]>([]);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeModeration, setActiveModeration] = useState('All');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedImageOpen, setSelectedImageOpen] = useState(true);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setSelectedImageOpen(true);
  }, [selectedPostId]);

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
    if (selectedPostId && !filteredPosts.some((post) => post.id === selectedPostId)) {
      setSelectedPostId(filteredPosts[0]?.id ?? null);
    }
  }, [filteredPosts, selectedPostId]);

  const replacePost = (updatedPost: ForumPost) => {
    setForumPosts((current) => current.map((post) => (post.id === updatedPost.id ? normalizePost(updatedPost) : post)));
  };

  const runModerationAction = async (postId: string, action: 'verify' | 'hide' | 'review' | 'misleading' | 'resolve') => {
    setBusy(`${action}-${postId}`);
    setError('');
    try {
      const response = await fetch(apiUrl(`/api/forum/posts/${postId}/moderation`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
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
      const response = await fetch(apiUrl(`/api/forum/posts/${postId}/ban-author`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
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
      const response = await fetch(apiUrl(`/api/forum/posts/${postId}/official-replies`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
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
        <h1 className="mb-2 text-3xl font-bold">Community Forum</h1>
        <p className="text-zinc-400">Monitor public discussions, reply to citizens, and handle reported or misleading content.</p>
      </div>

      {error ? <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-sm text-red-300">{error}</div> : null}
      {status ? <div className="rounded-lg border border-blue-800 bg-blue-950/40 p-4 text-sm text-blue-300">{status}</div> : null}

      <div className="rounded-xl border border-purple-900/50 bg-gradient-to-r from-purple-950/50 to-blue-950/50 p-5">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-purple-900/50 p-3">
            <Shield className="h-6 w-6 text-purple-400" />
          </div>
          <div className="flex-1">
            <h3 className="mb-2 font-semibold">Forum Moderation Queue</h3>
            <p className="text-sm text-zinc-300">
              Government users cannot create public forum posts here. Use comments, resolve actions, and moderation controls to manage citizen discussions.
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
                className={`rounded-full px-3 py-1 text-xs transition-colors ${
                  activeCategory === item ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
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
                className={`rounded-full px-3 py-1 text-xs transition-colors ${
                  activeModeration === item ? 'bg-zinc-200 text-zinc-950' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
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
                      <span className="font-medium">{selectedPost.author}</span>
                      <span className="text-xs text-zinc-600">{new Date(selectedPost.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-300">{selectedPost.content}</p>
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

                  <div className="flex flex-wrap items-center gap-3 border-y border-zinc-800 py-3 text-xs text-zinc-500">
                    <span className="inline-flex items-center gap-1"><ThumbsUp className="h-3.5 w-3.5" />{selectedPost.likes} likes</span>
                    <span className="inline-flex items-center gap-1"><ThumbsDown className="h-3.5 w-3.5" />{selectedPost.dislikes ?? 0} dislikes</span>
                    <span className="inline-flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />{selectedPost.replies.length} replies</span>
                    {selectedPost.reports ? <span className="inline-flex items-center gap-1 text-red-400"><Flag className="h-3.5 w-3.5" />{selectedPost.reports} reports</span> : null}
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
    </div>
  );
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
            <span className="font-medium text-zinc-100">{post.author}</span>
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
      <p className="line-clamp-2 text-sm leading-6 text-zinc-300">{post.content}</p>
      {post.images?.[0] && (
        <div className="mt-3 h-20 w-20 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-800">
          <img src={post.images[0].previewUrl} alt={post.images[0].filename ?? 'Forum attachment'} className="h-full w-full object-cover" />
        </div>
      )}
      <div className="mt-3 flex items-center gap-3 text-xs text-zinc-500">
        <span className="inline-flex items-center gap-1"><ThumbsUp className="h-3.5 w-3.5" />{post.likes}</span>
        <span className="inline-flex items-center gap-1"><ThumbsDown className="h-3.5 w-3.5" />{post.dislikes ?? 0}</span>
        {post.reports ? <span className="inline-flex items-center gap-1 text-red-400"><Flag className="h-3.5 w-3.5" />{post.reports}</span> : null}
      </div>
    </button>
  );
}

function ModerationBadges({ post, compact = false }: { post: ForumPost; compact?: boolean }) {
  const iconClass = compact ? 'h-3.5 w-3.5' : 'h-3.5 w-3.5';
  return (
    <>
      {post.verified ? <Badge text={compact ? '' : 'Verified'} icon={<CheckCircle className={`${iconClass} text-green-400`} />} green compact={compact} /> : null}
      {post.aiFlag ? <Badge text={compact ? '' : 'AI Flagged'} icon={<AlertTriangle className={`${iconClass} text-red-400`} />} red compact={compact} /> : null}
      {post.moderationState === 'under_review' ? <Badge text={compact ? '' : 'Under Review'} icon={<Flag className={`${iconClass} text-yellow-300`} />} yellow compact={compact} /> : null}
      {post.moderationState === 'hidden' ? <Badge text={compact ? '' : 'Hidden'} icon={<EyeOff className={iconClass} />} yellow compact={compact} /> : null}
      {post.moderationState === 'misleading' ? <Badge text={compact ? '' : 'Misleading'} icon={<EyeOff className={iconClass} />} red compact={compact} /> : null}
      {post.moderationState === 'resolved' ? <Badge text={compact ? '' : 'Resolved'} icon={<CheckCircle className={iconClass} />} green compact={compact} /> : null}
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

function moderationMessage(action: 'verify' | 'hide' | 'review' | 'misleading' | 'resolve') {
  if (action === 'verify') return 'Post verified and cleared.';
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
