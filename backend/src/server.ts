import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import { authenticateJwt, optionalAuthenticateJwt, requireActor, type AuthenticatedRequest } from './authMiddleware.js';
import { createAuthRouter } from './authRoutes.js';
import {
  createForumPost,
  createForumReply,
  likeForumPost,
  listForumPosts,
  reportForumPost,
} from './forumRepository.js';
import {
  addTicketComment,
  createCitizenTicket,
  getTicketByPublicId,
  listTickets,
  pingTicketAgencies,
  updateTicketStatus,
  type TicketStatus,
} from './ticketRepository.js';
import {
  getLatestMapLayer,
  getLatestSnapshot,
  listAlerts,
  listCrises,
} from './dashboardRepository.js';
import { detectTicketUrgency } from './severityDetector.js';

const app = express();
const port = Number(process.env.PORT ?? 4000);
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
app.use(express.json());
app.use('/api/auth', createAuthRouter());

app.get('/health', (_request, response) => {
  response.json({ ok: true });
});

app.get('/api/forum/posts', (_request, response) => {
  response.json({ items: listForumPosts() });
});

app.post('/api/forum/posts', (request, response) => {
  const content = stringBody(request.body?.content);
  if (!content) {
    response.status(400).json({ error: 'Post content is required' });
    return;
  }

  const post = createForumPost({
    author: stringBody(request.body?.author),
    content,
    category: stringBody(request.body?.category),
  });
  response.status(201).json({ item: post });
});

app.post('/api/forum/posts/:id/like', (request, response) => {
  const post = likeForumPost(request.params.id);
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

app.post('/api/forum/posts/:id/replies', (request, response) => {
  const content = stringBody(request.body?.content);
  if (!content) {
    response.status(400).json({ error: 'Reply content is required' });
    return;
  }

  const post = createForumReply(request.params.id, {
    author: stringBody(request.body?.author),
    content,
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

app.post('/api/citizen/reports', async (request, response, next) => {
  const message = stringBody(request.body?.description) ?? stringBody(request.body?.message);
  const crisisType = stringBody(request.body?.crisisType) ?? stringBody(request.body?.reportType) ?? 'general';
  if (!message) {
    response.status(400).json({ error: 'Report description is required' });
    return;
  }

  try {
    const urgency = await detectTicketUrgency(crisisType, message);
    const ticket = createCitizenTicket({
      reporter: stringBody(request.body?.reporter),
      message,
      location: stringBody(request.body?.locationText) ?? stringBody(request.body?.location),
      crisisType,
      urgency,
      hasImage: Boolean(request.body?.hasImage),
    });

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
});

app.post(
  '/api/citizen/reports',
  optionalAuthenticateJwt as express.RequestHandler,
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
      const ticket = await createCitizenTicket({
        reporterUserId: request.user?.id ?? null,
        reporter: stringBody(request.body?.reporter),
        title: stringBody(request.body?.title),
        message,
        location: stringBody(request.body?.locationText) ?? stringBody(request.body?.location),
        latitude: numberBody(request.body?.latitude),
        longitude: numberBody(request.body?.longitude),
        crisisType,
        reportType: stringBody(request.body?.reportType),
        images: [
          ...files.map((file) => ({
            originalFilename: file.originalname,
            mimeType: file.mimetype,
            byteSize: file.size,
            storageKey: `uploads/${Date.now()}-${file.originalname}`,
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

app.get('/api/citizen/reports/:publicReportId', async (request, response, next) => {
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
        };
      });
  } catch {
    return [];
  }
}

function isTicketStatus(value: unknown): value is TicketStatus {
  return value === 'open' || value === 'in-progress' || value === 'resolved' || value === 'grouped';
}

async function getSnapshotResponse(snapshotKey: string) {
  const payload = await getLatestSnapshot(snapshotKey);
  return payload ?? { items: [] };
}

function asObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
