import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import { authenticateJwt, requireActor, type AuthenticatedRequest } from './authMiddleware.js';
import { createAuthRouter } from './authRoutes.js';
import {
  banForumAuthor,
  createForumPost,
  createForumReply,
  dislikeForumPost,
  ForumAuthorBannedError,
  likeForumPost,
  listForumPosts,
  moderateForumPost,
  reportForumPost,
} from './forumRepository.js';
import {
  addTicketComment,
  createCitizenTicket,
  deleteTicket,
  getTicketByPublicId,
  listTicketsForReporter,
  listTickets,
  pingTicketAgencies,
  TicketChatClosedError,
  updateTicketStatus,
  type TicketStatus,
} from './ticketRepository.js';
import {
  getLatestMapLayer,
  getLatestSnapshot,
  listAlerts,
  listCrises,
} from './dashboardRepository.js';
import { startExternalDashboardRefresh } from './externalDashboardRefresh.js';
import {
  createBroadcast,
  listBroadcasts,
  resolveBroadcast,
  setBroadcastAction,
  type BroadcastSeverity,
} from './broadcastRepository.js';
import {
  enqueueAgencyPingNotifications,
  enqueueBroadcastNotifications,
  enqueueCitizenReplyNotifications,
  enqueueGovernmentReplyNotification,
  listUserNotifications,
  markUserNotificationRead,
} from './notificationRepository.js';
import { detectPotentialMisinformation } from './misinformationDetector.js';
import { detectTicketUrgency } from './severityDetector.js';

const app = express();
const port = Number(process.env.PORT ?? 4000);
const forumPostCooldownMs = Number(process.env.FORUM_POST_COOLDOWN_MS ?? 60_000);
const forumPostCooldowns = new Map<string, number>();
const requireGovUser: express.RequestHandler[] = [
  authenticateJwt as express.RequestHandler,
  requireActor('government_user', 'system') as express.RequestHandler,
];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 5,
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_request, file, callback) => {
    if (!file.mimetype.startsWith('image/')) {
      callback(new Error('Only image uploads are supported'));
      return;
    }
    callback(null, true);
  },
});

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true }));
app.use(helmet());
app.use(express.json({ limit: '5mb' }));
app.use('/api/auth', createAuthRouter());

app.get('/health', (_request, response) => {
  response.json({ ok: true });
});

app.get('/api/notifications', authenticateJwt as express.RequestHandler, async (request: AuthenticatedRequest, response, next) => {
  try {
    if (!request.user?.id) {
      response.status(401).json({ error: 'Bearer token is required' });
      return;
    }
    response.json({ items: await listUserNotifications(request.user.id, { unreadOnly: true }) });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/notifications/:id/read', authenticateJwt as express.RequestHandler, async (request: AuthenticatedRequest, response, next) => {
  try {
    if (!request.user?.id) {
      response.status(401).json({ error: 'Bearer token is required' });
      return;
    }
    const item = await markUserNotificationRead(request.user.id, request.params.id);
    if (!item) {
      response.status(404).json({ error: 'Notification not found' });
      return;
    }
    response.json({ item });
  } catch (error) {
    next(error);
  }
});

app.get('/api/forum/posts', (_request, response) => {
  response.json({ items: listForumPosts() });
});

app.get('/api/forum/posts/moderation', ...requireGovUser, (_request, response) => {
  response.json({ items: listForumPosts({ includeHidden: true }) });
});

app.post('/api/forum/posts/official', ...requireGovUser, async (request: AuthenticatedRequest, response, next) => {
  const content = stringBody(request.body?.content);
  if (!content) {
    response.status(400).json({ error: 'Post content is required' });
    return;
  }

  try {
    const post = createForumPost({
      author: request.user?.display_name ?? request.user?.username ?? 'Government Moderator',
      content,
      category: stringBody(request.body?.category),
      verified: true,
      moderationState: 'verified',
      images: parseForumImages(request.body?.images),
    });
    response.status(201).json({ item: post });
  } catch (error) {
    next(error);
  }
});

app.post('/api/forum/posts', async (request, response, next) => {
  const content = stringBody(request.body?.content);
  if (!content) {
    response.status(400).json({ error: 'Post content is required' });
    return;
  }

  const author = stringBody(request.body?.author);
  const cooldownKey = forumCooldownKey(request, author);
  const cooldown = forumCooldownRemaining(cooldownKey);
  if (cooldown > 0) {
    response.setHeader('Retry-After', String(Math.ceil(cooldown / 1000)));
    response.status(429).json({
      error: 'Please wait before posting again.',
      retryAfterMs: cooldown,
      retryAfterSeconds: Math.ceil(cooldown / 1000),
    });
    return;
  }

  try {
    const aiFlag = await detectPotentialMisinformation(content);
    const post = createForumPost({
      author,
      content,
      category: stringBody(request.body?.category),
      aiFlag,
      images: parseForumImages(request.body?.images),
    });
    forumPostCooldowns.set(cooldownKey, Date.now() + forumPostCooldownMs);
    response.status(201).json({ item: post });
  } catch (error) {
    if (error instanceof ForumAuthorBannedError) {
      response.status(403).json({ error: error.message });
      return;
    }
    next(error);
  }
});

app.post('/api/forum/posts/:id/like', (request, response) => {
  const post = likeForumPost(request.params.id, forumInteractionKey(request));
  if (!post) {
    response.status(404).json({ error: 'Forum post not found' });
    return;
  }
  response.json({ item: post });
});

app.post('/api/forum/posts/:id/dislike', (request, response) => {
  const post = dislikeForumPost(request.params.id, forumInteractionKey(request));
  if (!post) {
    response.status(404).json({ error: 'Forum post not found' });
    return;
  }
  response.json({ item: post });
});

app.post('/api/forum/posts/:id/report', (request, response) => {
  const post = reportForumPost(request.params.id);
  if (!post) {
    response.status(404).json({ error: 'Forum post not found' });
    return;
  }
  response.json({ item: post });
});

app.post('/api/forum/posts/:id/moderation', ...requireGovUser, (request: AuthenticatedRequest, response) => {
  const action = request.body?.action;
  if (action !== 'verify' && action !== 'hide' && action !== 'review' && action !== 'misleading' && action !== 'resolve') {
    response.status(400).json({ error: 'Valid moderation action is required' });
    return;
  }

  const post = moderateForumPost(request.params.id, {
    action,
    moderator: request.user?.display_name ?? request.user?.username ?? 'Government Moderator',
    note: stringBody(request.body?.note),
  });
  if (!post) {
    response.status(404).json({ error: 'Forum post not found' });
    return;
  }
  response.json({ item: post });
});

app.post('/api/forum/posts/:id/ban-author', ...requireGovUser, (request: AuthenticatedRequest, response) => {
  const post = banForumAuthor(request.params.id, {
    moderator: request.user?.display_name ?? request.user?.username ?? 'Government Moderator',
    note: stringBody(request.body?.note),
  });
  if (!post) {
    response.status(404).json({ error: 'Forum post not found' });
    return;
  }
  response.json({ item: post, bannedAuthor: post.author });
});

app.post('/api/forum/posts/:id/replies', (request, response) => {
  const content = stringBody(request.body?.content);
  if (!content) {
    response.status(400).json({ error: 'Reply content is required' });
    return;
  }

  try {
    const post = createForumReply(request.params.id, {
      author: stringBody(request.body?.author),
      content,
    });
    if (!post) {
      response.status(404).json({ error: 'Forum post not found' });
      return;
    }
    response.status(201).json({ item: post });
  } catch (error) {
    if (error instanceof ForumAuthorBannedError) {
      response.status(403).json({ error: error.message });
      return;
    }
    throw error;
  }
});

app.post('/api/forum/posts/:id/official-replies', ...requireGovUser, (request: AuthenticatedRequest, response) => {
  const content = stringBody(request.body?.content);
  if (!content) {
    response.status(400).json({ error: 'Reply content is required' });
    return;
  }

  const post = createForumReply(request.params.id, {
    author: request.user?.display_name ?? request.user?.username ?? 'Government Moderator',
    content,
    official: true,
  });
  if (!post) {
    response.status(404).json({ error: 'Forum post not found' });
    return;
  }
  response.status(201).json({ item: post });
});

app.get('/api/tickets', ...requireGovUser, async (request, response, next) => {
  try {
    response.json({
      items: await listTickets({
        agency: stringParam(request.query.agency),
        status: stringParam(request.query.status),
        crisisType: stringParam(request.query.crisisType),
        query: stringParam(request.query.query),
      }),
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/tickets/:id', ...requireGovUser, async (request, response, next) => {
  try {
    const ticket = await getTicketByPublicId(request.params.id);
    if (!ticket) {
      response.status(404).json({ error: 'Ticket not found' });
      return;
    }
    response.json({ item: ticket });
  } catch (error) {
    next(error);
  }
});

app.get('/api/citizen/reports', authenticateJwt as express.RequestHandler, async (request: AuthenticatedRequest, response, next) => {
  try {
    if (!request.user?.id) {
      response.status(401).json({ error: 'Bearer token is required' });
      return;
    }
    response.json({ items: await listTicketsForReporter(request.user.id) });
  } catch (error) {
    next(error);
  }
});

app.post(
  '/api/citizen/reports',
  authenticateJwt as express.RequestHandler,
  upload.array('images', 5),
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const message = stringBody(request.body?.description) ?? stringBody(request.body?.message);
      const crisisType = stringBody(request.body?.crisisType) ?? stringBody(request.body?.reportType) ?? 'general';
      if (!message) {
        response.status(400).json({ error: 'Report description is required' });
        return;
      }

      const files = Array.isArray(request.files) ? request.files : [];
      const bodyImages = parseImageMetadata(request.body?.images);
      const urgency = await detectTicketUrgency(crisisType, message);
      const ticket = await createCitizenTicket({
        reporterUserId: request.user?.id ?? null,
        reporter: stringBody(request.body?.reporter),
        title: stringBody(request.body?.title),
        message,
        location: stringBody(request.body?.locationText) ?? stringBody(request.body?.location),
        latitude: numberBody(request.body?.latitude),
        longitude: numberBody(request.body?.longitude),
        crisisType,
        urgency,
        reportType: stringBody(request.body?.reportType),
        images: [
          ...files.map((file) => ({
            originalFilename: file.originalname,
            mimeType: file.mimetype,
            byteSize: file.size,
            storageKey: `uploads/${Date.now()}-${file.originalname}`,
            previewUrl: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
          })),
          ...bodyImages,
        ],
      });

      if (!ticket) {
        response.status(500).json({ error: 'Unable to create ticket' });
        return;
      }

      response.status(201).json({
        id: ticket.id,
        publicReportId: ticket.id,
        status: ticket.status,
        assignedAgency: ticket.assignedAgency,
        createdAt: new Date().toISOString(),
        item: ticket,
      });
    } catch (error) {
      next(error);
    }
  },
);

app.get('/api/citizen/reports/:publicReportId', authenticateJwt as express.RequestHandler, async (request, response, next) => {
  try {
    const ticket = await getTicketByPublicId(request.params.publicReportId);
    if (!ticket) {
      response.status(404).json({ error: 'Report not found' });
      return;
    }

    response.json({
      publicReportId: ticket.id,
      status: ticket.status,
      assignedAgency: ticket.assignedAgency,
      latestPublicMessage:
        [...ticket.comments].reverse().find((comment) => comment.visibility === 'public')?.body ??
        'Your report is in the government ticket queue.',
      updatedAt: ticket.comments.at(-1)?.createdAt ?? new Date().toISOString(),
      item: ticket,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/citizen/reports/:publicReportId/comments', authenticateJwt as express.RequestHandler, async (request: AuthenticatedRequest, response, next) => {
  const body = stringBody(request.body?.body);
  if (!body) {
    response.status(400).json({ error: 'Comment body is required' });
    return;
  }

  try {
    const ticket = await addTicketComment(request.params.publicReportId, {
      body,
      visibility: 'public',
      author: request.user?.display_name ?? request.user?.username ?? 'Citizen',
      authorUserId: request.user?.id,
      authorType: request.user?.actor_type === 'government_user' ? 'government_user' : 'citizen',
    });
    if (!ticket) {
      response.status(404).json({ error: 'Report not found' });
      return;
    }
    if (request.user?.actor_type === 'government_user') {
      await enqueueGovernmentReplyNotification(request.params.publicReportId, body);
    } else {
      await enqueueCitizenReplyNotifications(request.params.publicReportId, body);
    }
    response.status(201).json({ item: ticket });
  } catch (error) {
    if (error instanceof TicketChatClosedError) {
      response.status(409).json({ error: error.message });
      return;
    }
    next(error);
  }
});

app.patch('/api/tickets/:id/status', ...requireGovUser, async (request, response, next) => {
  const status = stringBody(request.body?.status);
  if (!isTicketStatus(status)) {
    response.status(400).json({ error: 'Valid ticket status is required' });
    return;
  }

  try {
    const ticket = await updateTicketStatus(request.params.id, status);
    if (!ticket) {
      response.status(404).json({ error: 'Ticket not found' });
      return;
    }
    response.json({ item: ticket });
  } catch (error) {
    if (error instanceof TicketChatClosedError) {
      response.status(409).json({ error: error.message });
      return;
    }
    next(error);
  }
});

app.delete('/api/tickets/:id', ...requireGovUser, async (request, response, next) => {
  try {
    const deleted = await deleteTicket(request.params.id);
    if (!deleted) {
      response.status(404).json({ error: 'Ticket not found' });
      return;
    }
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.post('/api/tickets/:id/comments', ...requireGovUser, async (request: AuthenticatedRequest, response, next) => {
  const body = stringBody(request.body?.body);
  const visibility = request.body?.visibility === 'public' ? 'public' : 'internal';
  if (!body) {
    response.status(400).json({ error: 'Comment body is required' });
    return;
  }

  try {
    const ticket = await addTicketComment(request.params.id, {
      body,
      visibility,
      author: stringBody(request.body?.author),
      authorUserId: request.user?.id,
      authorType: 'government_user',
    });
    if (!ticket) {
      response.status(404).json({ error: 'Ticket not found' });
      return;
    }
    if (visibility === 'public') {
      await enqueueGovernmentReplyNotification(request.params.id, body);
    }
    response.status(201).json({ item: ticket });
  } catch (error) {
    next(error);
  }
});

app.post('/api/tickets/:id/ping-agencies', ...requireGovUser, async (request: AuthenticatedRequest, response, next) => {
  const agencyCodes = Array.isArray(request.body?.agencyCodes)
    ? request.body.agencyCodes.filter((item: unknown) => typeof item === 'string' && item.trim())
    : [];
  if (agencyCodes.length === 0) {
    response.status(400).json({ error: 'At least one agency code is required' });
    return;
  }

  try {
    const result = await pingTicketAgencies(request.params.id, agencyCodes, request.user?.id);
    if (!result?.ticket) {
      response.status(404).json({ error: 'Ticket not found' });
      return;
    }
    await enqueueAgencyPingNotifications(
      result.ticket.id,
      result.pingedAgencies,
      `You were pinged on ${result.ticket.id}.`,
    );
    response.json({
      item: result.ticket,
      ticketId: result.ticket.id,
      pingedAgencies: result.pingedAgencies,
      createdAt: result.createdAt,
    });
  } catch (error) {
    next(error);
  }
});

app.get(['/api/gov/crises', '/api/crises'], ...requireGovUser, async (request, response, next) => {
  try {
    const items = await listCrises({
      status: stringParam(request.query.status),
      crisisType: stringParam(request.query.crisisType),
    });
    response.json({ items });
  } catch (error) {
    next(error);
  }
});

app.get(['/api/gov/alerts', '/api/alerts'], ...requireGovUser, async (request, response, next) => {
  try {
    const items = await listAlerts({
      status: stringParam(request.query.status) ?? 'active',
      crisisType: stringParam(request.query.type) ?? stringParam(request.query.crisisType),
      region: stringParam(request.query.region),
    });
    response.json({ items });
  } catch (error) {
    next(error);
  }
});

app.get('/api/citizen/alerts', async (request, response, next) => {
  try {
    const items = await listAlerts({
      status: stringParam(request.query.status) ?? 'active',
      crisisType: stringParam(request.query.type) ?? stringParam(request.query.crisisType),
      region: stringParam(request.query.region),
    });
    response.json({ items });
  } catch (error) {
    next(error);
  }
});

app.get('/api/broadcasts', ...requireGovUser, async (_request, response, next) => {
  try {
    response.json({ items: await listBroadcasts({ includeResolved: true }) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/broadcasts', ...requireGovUser, async (request: AuthenticatedRequest, response, next) => {
  const title = stringBody(request.body?.title);
  const message = stringBody(request.body?.message);
  const severity = stringBody(request.body?.severity);
  if (!title || !message || !isBroadcastSeverity(severity)) {
    response.status(400).json({ error: 'Valid title, message, and severity are required' });
    return;
  }

  try {
    const item = await createBroadcast({
      createdByUserId: request.user?.id,
      title,
      message,
      severity,
      targetType: request.body?.targetType === 'regions' ? 'regions' : request.body?.targetType === 'agencies' ? 'agencies' : 'all_citizens',
      targetRegions: Array.isArray(request.body?.targetRegions) ? request.body.targetRegions.filter((item: unknown) => typeof item === 'string') : [],
      platforms: Array.isArray(request.body?.platforms) ? request.body.platforms.filter((item: unknown) => typeof item === 'string') : ['web'],
    });
    await enqueueBroadcastNotifications(item);
    response.status(201).json({ item });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/broadcasts/:id/resolve', ...requireGovUser, async (request, response, next) => {
  try {
    const item = await resolveBroadcast(request.params.id);
    if (!item) {
      response.status(404).json({ error: 'Broadcast not found' });
      return;
    }
    response.json({ item });
  } catch (error) {
    next(error);
  }
});

app.get('/api/citizen/broadcasts', authenticateJwt as express.RequestHandler, async (request: AuthenticatedRequest, response, next) => {
  try {
    response.json({ items: await listBroadcasts({ includeResolved: true, userId: request.user?.id }) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/citizen/broadcasts/:id/action', authenticateJwt as express.RequestHandler, async (request: AuthenticatedRequest, response, next) => {
  const action = request.body?.action === 'ignore' ? 'ignore' : request.body?.action === 'notify' ? 'notify' : null;
  if (!action) {
    response.status(400).json({ error: 'Valid action is required' });
    return;
  }
  if (!request.user?.id) {
    response.status(401).json({ error: 'Bearer token is required' });
    return;
  }

  try {
    await setBroadcastAction(request.user.id, request.params.id, action);
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get('/api/gov/overview', ...requireGovUser, async (_request, response, next) => {
  try {
    const [crises, alerts, overview] = await Promise.all([
      listCrises({ status: 'active' }),
      listAlerts({ status: 'active' }),
      getLatestSnapshot('dashboard_overview'),
    ]);

    response.json({ crises, alerts, overview });
  } catch (error) {
    next(error);
  }
});

app.get(['/api/gov/cybersecurity', '/api/cybersecurity'], ...requireGovUser, async (_request, response, next) => {
  try {
    response.json(await getSnapshotResponse('dashboard_cybersecurity'));
  } catch (error) {
    next(error);
  }
});

app.get(['/api/citizen/home', '/api/public/home'], async (_request, response, next) => {
  try {
    response.json(await getSnapshotResponse('dashboard_public_home'));
  } catch (error) {
    next(error);
  }
});

app.get(['/api/citizen/incidents', '/api/public/incidents'], async (_request, response, next) => {
  try {
    response.json(await getSnapshotResponse('dashboard_public_incidents'));
  } catch (error) {
    next(error);
  }
});

app.get('/api/dashboard/cached-external', ...requireGovUser, async (_request, response, next) => {
  try {
    response.json(await getSnapshotResponse('dashboard_cached_external'));
  } catch (error) {
    next(error);
  }
});

app.get(['/api/gov/recommendations', '/api/recommendations'], ...requireGovUser, async (request, response, next) => {
  try {
    const payload = await getLatestSnapshot<{ items: Record<string, unknown>[] }>('dashboard_recommendations');
    const crisisType = stringParam(request.query.crisisType);
    const items = payload?.items ?? [];
    response.json({
      items: crisisType
        ? items.filter((item) => String(item.category ?? '').toLowerCase() === crisisType.toLowerCase())
        : items,
    });
  } catch (error) {
    next(error);
  }
});

app.get(['/api/gov/sentiment', '/api/sentiment'], ...requireGovUser, async (_request, response, next) => {
  try {
    response.json(await getSnapshotResponse('dashboard_sentiment'));
  } catch (error) {
    next(error);
  }
});

app.get(['/api/gov/historical', '/api/historical'], ...requireGovUser, async (_request, response, next) => {
  try {
    response.json(await getSnapshotResponse('dashboard_historical'));
  } catch (error) {
    next(error);
  }
});

app.get(['/api/gov/heatmap', '/api/heatmap'], ...requireGovUser, async (request, response, next) => {
  try {
    const layer = stringParam(request.query.layer) ?? 'crises';
    const mapLayer = await getLatestMapLayer(layer);
    response.json(
      mapLayer
        ? { layer: mapLayer.layer_key, title: mapLayer.title, ...asObject(mapLayer.payload), generatedAt: mapLayer.generated_at }
        : { layer, markers: [], generatedAt: new Date().toISOString() },
    );
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error(error);
  response.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`SiGnal backend listening on http://localhost:${port}`);
  startExternalDashboardRefresh();
});

function stringParam(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function stringBody(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberBody(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseImageMetadata(value: unknown) {
  if (!value) return [];

  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const record = item as Record<string, unknown>;
        return {
          originalFilename: stringBody(record.originalFilename) ?? stringBody(record.filename) ?? null,
          mimeType: stringBody(record.mimeType) ?? null,
          byteSize: typeof record.byteSize === 'number' ? record.byteSize : null,
          storageKey: stringBody(record.storageKey) ?? null,
          checksumSha256: stringBody(record.checksumSha256) ?? null,
          previewUrl: stringBody(record.previewUrl) ?? null,
        };
      });
  } catch {
    return [];
  }
}

function parseForumImages(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const record = item as Record<string, unknown>;
      return {
        filename: stringBody(record.filename),
        mimeType: stringBody(record.mimeType),
        previewUrl: stringBody(record.previewUrl),
      };
    });
}

function isTicketStatus(value: unknown): value is TicketStatus {
  return value === 'open' || value === 'in-progress' || value === 'resolved' || value === 'grouped';
}

function isBroadcastSeverity(value: unknown): value is BroadcastSeverity {
  return value === 'critical' || value === 'high' || value === 'medium' || value === 'low';
}

async function getSnapshotResponse(snapshotKey: string) {
  const payload = await getLatestSnapshot(snapshotKey);
  return payload ?? { items: [] };
}

function asObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function forumCooldownKey(request: express.Request, author?: string) {
  const forwardedFor = stringParam(request.headers['x-forwarded-for']);
  const clientIp = forwardedFor?.split(',')[0]?.trim() || request.ip || request.socket.remoteAddress || 'unknown';
  return `${clientIp}:${(author ?? 'Anonymous User').trim().toLowerCase()}`;
}

function forumInteractionKey(request: express.Request) {
  return forumCooldownKey(request, request.get('user-agent') ?? 'anonymous');
}

function forumCooldownRemaining(key: string) {
  const expiresAt = forumPostCooldowns.get(key);
  if (!expiresAt) return 0;

  const remaining = expiresAt - Date.now();
  if (remaining <= 0) {
    forumPostCooldowns.delete(key);
    return 0;
  }

  return remaining;
}
