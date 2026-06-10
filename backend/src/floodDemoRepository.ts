import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  appendDemoForumReply,
  clearDemoForumPosts,
  upsertDemoForumPost,
  type ForumModerationState,
  type ForumPost,
  type ForumReply,
} from './forumRepository.js';

type DemoFrame = {
  id: string;
  label: string;
  dayRange: number[];
  displayGranularity: string;
  narrative: string;
};

type DemoReply = {
  id: string;
  authorName: string;
  content: string;
  createdAt: string;
};

type DemoPost = {
  id: string;
  frameId: string;
  title: string;
  authorName: string;
  content: string;
  createdAt: string;
  location: string;
  latitude: number;
  longitude: number;
  crisisTagIds: string[];
  likes: number;
  dislikes: number;
  reports: number;
  moderationState: ForumModerationState;
  replies: DemoReply[];
};

type DemoTag = {
  id: string;
  label: string;
  frameId: string;
};

type FrameRecord = {
  id?: string;
  frameId?: string;
  [key: string]: unknown;
};

type FloodScenario = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  frames: DemoFrame[];
  crisisTags: DemoTag[];
  forumPosts: DemoPost[];
  citizenReports: FrameRecord[];
  volunteerProfiles: FrameRecord[];
  volunteerOpportunities: FrameRecord[];
  sentimentSeries: FrameRecord[];
};

type DemoEvent =
  | { kind: 'post'; post: DemoPost }
  | { kind: 'reply'; postId: string; reply: DemoReply }
  | { kind: 'tag' | 'report' | 'profile' | 'opportunity' | 'sentiment'; record: FrameRecord };

const scenarioPath = fileURLToPath(new URL('../data/flood-crisis-demo-scenario.json', import.meta.url));
const scenario = JSON.parse(readFileSync(scenarioPath, 'utf8')) as FloodScenario;
const demoPostIds = scenario.forumPosts.map((post) => post.id);
const tagLabels = new Map(scenario.crisisTags.map((tag) => [tag.id, tag.label]));

let currentFrameIndex = -1;
let streaming = false;
let generation = 0;
let processedEvents = 0;
let totalEvents = 0;
const visible = {
  crisisTags: [] as FrameRecord[],
  citizenReports: [] as FrameRecord[],
  volunteerProfiles: [] as FrameRecord[],
  volunteerOpportunities: [] as FrameRecord[],
  sentimentSeries: [] as FrameRecord[],
};

export function getFloodDemoState() {
  return {
    scenario: {
      id: scenario.id,
      title: scenario.title,
      description: scenario.description,
      startsAt: scenario.startsAt,
      frames: scenario.frames,
    },
    currentFrameIndex,
    currentFrame: scenario.frames[currentFrameIndex] ?? null,
    nextFrame: scenario.frames[currentFrameIndex + 1] ?? null,
    streaming,
    progress: totalEvents > 0 ? processedEvents / totalEvents : 0,
    visible,
  };
}

export function resetFloodDemo() {
  generation += 1;
  currentFrameIndex = -1;
  streaming = false;
  processedEvents = 0;
  totalEvents = 0;
  visible.crisisTags.length = 0;
  visible.citizenReports.length = 0;
  visible.volunteerProfiles.length = 0;
  visible.volunteerOpportunities.length = 0;
  visible.sentimentSeries.length = 0;
  clearDemoForumPosts(demoPostIds);
  return getFloodDemoState();
}

export function advanceFloodDemo() {
  if (streaming) {
    return { accepted: false, reason: 'streaming', state: getFloodDemoState() };
  }
  const nextFrameIndex = currentFrameIndex + 1;
  const frame = scenario.frames[nextFrameIndex];
  if (!frame) {
    return { accepted: false, reason: 'complete', state: getFloodDemoState() };
  }

  currentFrameIndex = nextFrameIndex;
  streaming = true;
  processedEvents = 0;
  const runGeneration = ++generation;
  const events = eventsForFrame(frame.id);
  totalEvents = events.length;
  void streamEvents(events, runGeneration);
  return { accepted: true, reason: null, state: getFloodDemoState() };
}

async function streamEvents(events: DemoEvent[], runGeneration: number) {
  const delayMs = Math.max(4, Math.floor(1000 / Math.max(1, events.length)));
  for (const event of events) {
    if (generation !== runGeneration) return;
    applyEvent(event);
    processedEvents += 1;
    await delay(delayMs);
  }
  if (generation === runGeneration) {
    streaming = false;
  }
}

function eventsForFrame(frameId: string): DemoEvent[] {
  const events: DemoEvent[] = [];
  const framePosts = scenario.forumPosts.filter((item) => item.frameId === frameId);
  for (const post of framePosts) {
    events.push({ kind: 'post', post });
  }
  events.push(...scenario.crisisTags.filter((item) => item.frameId === frameId).map((record) => ({ kind: 'tag' as const, record })));

  const timedEvents: DemoEvent[] = [
    ...framePosts.flatMap((post) =>
      post.replies.map((reply) => ({ kind: 'reply' as const, postId: post.id, reply }))),
    ...scenario.citizenReports
      .filter((item) => item.frameId === frameId)
      .map((record) => ({ kind: 'report' as const, record })),
    ...scenario.sentimentSeries
      .filter((item) => item.frameId === frameId)
      .map((record) => ({ kind: 'sentiment' as const, record })),
  ].sort((left, right) => eventTime(left) - eventTime(right));
  events.push(...timedEvents);

  if (frameId === 'frame-3') {
    events.push(...scenario.volunteerProfiles.map((record) => ({ kind: 'profile' as const, record })));
  }
  events.push(...scenario.volunteerOpportunities.filter((item) => item.frameId === frameId).map((record) => ({ kind: 'opportunity' as const, record })));
  return events;
}

function eventTime(event: DemoEvent) {
  if (event.kind === 'reply') return new Date(event.reply.createdAt).getTime();
  if (event.kind === 'post') return new Date(event.post.createdAt).getTime();
  const timestamp = event.record.createdAt ?? event.record.timestamp;
  return typeof timestamp === 'string' ? new Date(timestamp).getTime() : Number.MAX_SAFE_INTEGER;
}

function applyEvent(event: DemoEvent) {
  if (event.kind === 'post') {
    upsertDemoForumPost(toForumPost(event.post));
    return;
  }
  if (event.kind === 'reply') {
    appendDemoForumReply(event.postId, toForumReply(event.reply));
    return;
  }

  const destination = event.kind === 'tag'
    ? visible.crisisTags
    : event.kind === 'report'
      ? visible.citizenReports
      : event.kind === 'profile'
        ? visible.volunteerProfiles
        : event.kind === 'opportunity'
          ? visible.volunteerOpportunities
          : visible.sentimentSeries;
  const recordKey = event.record.id ?? event.record.timestamp;
  if (!destination.some((record) => (record.id ?? record.timestamp) === recordKey)) {
    destination.push(event.record);
  }
}

function toForumPost(post: DemoPost): ForumPost {
  const crisisTag = post.crisisTagIds.map((id) => tagLabels.get(id)).filter(Boolean).join(', ') || null;
  return {
    id: post.id,
    author: post.authorName,
    content: `${post.title}\n\n${post.content}`,
    createdAt: post.createdAt,
    verified: false,
    aiFlag: false,
    likes: post.likes,
    dislikes: post.dislikes,
    reports: post.reports,
    moderationState: post.moderationState,
    replies: [],
    images: [],
    category: 'Weather',
    crisisTag,
    topicTag: floodTopicTag(post.location),
    location: post.location,
    latitude: post.latitude,
    longitude: post.longitude,
    sourceReportId: null,
    similarReports: 0,
  };
}

function toForumReply(reply: DemoReply): ForumReply {
  return {
    id: reply.id,
    author: reply.authorName,
    content: reply.content,
    createdAt: reply.createdAt,
  };
}

function floodTopicTag(location: string) {
  const area = location.toLowerCase()
    .replace(/\b(community centre|community center|library|road|rd|street|st)\b/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return area ? `flood-${area}` : 'flood';
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
