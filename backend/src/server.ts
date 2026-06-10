import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import { authenticateJwt, optionalAuthenticateJwt, requireActor, type AuthenticatedRequest } from './authMiddleware.js';
import { createAuthRouter } from './authRoutes.js';
import {
  createForumPost,
  createOrMergeForumPost,
  createForumReply,
  likeForumPost,
  listForumPosts,
  moderateForumPost,
  reportForumPost,
} from './forumRepository.js';
import {
  acceptUrgentVolunteerAlert,
  createUrgentVolunteerAlert,
  getVolunteerProfile,
  listUrgentVolunteerAlerts,
  listUrgentVolunteerAlertsForVolunteer,
  listVolunteerProfiles,
  patchVolunteerProfile,
  upsertVolunteerProfile,
} from './volunteerRepository.js';
import {
  addTicketComment,
  createReportSubjectTag,
  createCitizenTicket,
  deleteTicket,
  getTicketByPublicId,
  listTicketsForReporter,
  listTickets,
  listReportSubjectTags,
  pingTicketAgencies,
  renameReportSubjectTag,
  setTicketSubjectTag,
  startTicketWork,
  TicketChatClosedError,
  updateTicketStatus,
  type Ticket,
  type TicketStatus,
} from './ticketRepository.js';
import {
  getLatestMapLayer,
  getLatestSnapshot,
  listAlerts,
  listCrises,
} from './dashboardRepository.js';
import {
  fetchLiveTrafficCameraSnapshot,
  fetchNeaHazeLayers,
  fetchNeaRainRadarFrames,
  startExternalDashboardRefresh,
} from './externalDashboardRefresh.js';
import {
  createBroadcast,
  addBroadcastUpdate,
  deleteBroadcast,
  listBroadcasts,
  resolveBroadcast,
  setBroadcastAction,
  unresolveBroadcast,
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
import { answerCrisisQuestion } from './crisisAssistant.js';

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
app.use(express.json());
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

app.post('/api/citizen/assistant', authenticateJwt as express.RequestHandler, async (request: AuthenticatedRequest, response, next) => {
  try {
    const messages = Array.isArray(request.body?.messages)
      ? request.body.messages
        .filter((message: unknown) => message && typeof message === 'object')
        .map((message: Record<string, unknown>) => ({
          role: message.role === 'assistant' ? 'assistant' as const : 'user' as const,
          content: stringBody(message.content)?.slice(0, 1200) ?? '',
        }))
        .filter((message: { content: string }) => message.content)
        .slice(-10)
      : [];

    if (!messages.length || messages.at(-1)?.role !== 'user') {
      response.status(400).json({ error: 'A user question is required' });
      return;
    }

    response.json({ reply: await answerCrisisQuestion(messages) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/forum/posts', (request, response) => {
  response.json({
    items: listForumPosts({
      latitude: numberBody(request.query.latitude),
      longitude: numberBody(request.query.longitude),
    }),
  });
});

app.post('/api/forum/posts', optionalAuthenticateJwt as express.RequestHandler, async (request: AuthenticatedRequest, response, next) => {
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
    const location = stringBody(request.body?.location);
    const latitude = numberBody(request.body?.latitude);
    const longitude = numberBody(request.body?.longitude);
    let linkedTicket: Ticket | null = null;
    if (request.body?.createReport === true) {
      if (!request.user?.id) {
        response.status(401).json({ error: 'Sign in before sending a forum post as a report.' });
        return;
      }
      linkedTicket = await createCitizenTicket({
        reporterUserId: request.user.id,
        reporter: author,
        title: stringBody(request.body?.title),
        message: content,
        location,
        latitude,
        longitude,
        crisisType: stringBody(request.body?.reportType) ?? stringBody(request.body?.category) ?? 'general',
        reportType: stringBody(request.body?.reportType) ?? stringBody(request.body?.category),
        urgency: await detectTicketUrgency(
          stringBody(request.body?.reportType) ?? stringBody(request.body?.category) ?? 'general',
          content,
        ),
        images: parseImageMetadata(request.body?.images),
      });
      if (linkedTicket?.status === 'spam') {
        response.status(422).json({
          error: `Report ${linkedTicket.id} was saved to the government spam queue and was not posted publicly.`,
          linkedReportId: linkedTicket.id,
        });
        return;
      }
    }
    const result = createOrMergeForumPost({
      author,
      content,
      category: stringBody(request.body?.category),
      aiFlag,
      location,
      latitude,
      longitude,
      sourceReportId: linkedTicket?.id ?? null,
      images: parseImageMetadata(request.body?.images).map((image) => ({
        filename: image.originalFilename,
        mimeType: image.mimeType,
        previewUrl: image.previewUrl,
      })),
    });
    forumPostCooldowns.set(cooldownKey, Date.now() + forumPostCooldownMs);
    response.status(201).json({
      item: result.post,
      merged: result.merged,
      similarityScore: result.similarityScore,
      linkedReportId: linkedTicket?.id ?? null,
    });
  } catch (error) {
    next(error);
  }
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

app.get('/api/forum/posts/moderation', ...requireGovUser, (_request, response) => {
  response.json({ items: listForumPosts() });
});

app.post('/api/forum/posts/official', ...requireGovUser, async (request: AuthenticatedRequest, response, next) => {
  const content = stringBody(request.body?.content);
  if (!content) {
    response.status(400).json({ error: 'Post content is required' });
    return;
  }

  try {
    const post = createForumPost({
      author: request.user?.display_name ?? request.user?.username ?? request.user?.email ?? 'Government Official',
      content,
      category: stringBody(request.body?.category),
      verified: true,
      moderationState: 'verified',
    });
    response.status(201).json({ item: post });
  } catch (error) {
    next(error);
  }
});

app.post('/api/forum/posts/:id/moderation', ...requireGovUser, (request: AuthenticatedRequest, response) => {
  const action = request.body?.action === 'verify'
    ? 'verify'
    : request.body?.action === 'hide'
      ? 'hide'
      : request.body?.action === 'review'
        ? 'review'
        : null;

  if (!action) {
    response.status(400).json({ error: 'Valid moderation action is required' });
    return;
  }

  const post = moderateForumPost(request.params.id, {
    action,
    moderator: request.user?.display_name ?? request.user?.username ?? request.user?.email ?? 'Government Moderator',
  });
  if (!post) {
    response.status(404).json({ error: 'Forum post not found' });
    return;
  }
  response.json({ item: post });
});

app.post('/api/forum/posts/:id/official-replies', ...requireGovUser, (request: AuthenticatedRequest, response) => {
  const content = stringBody(request.body?.content);
  if (!content) {
    response.status(400).json({ error: 'Reply content is required' });
    return;
  }

  const post = createForumReply(request.params.id, {
    author: request.user?.display_name ?? request.user?.username ?? request.user?.email ?? 'Government Official',
    content,
    official: true,
  });
  if (!post) {
    response.status(404).json({ error: 'Forum post not found' });
    return;
  }
  response.status(201).json({ item: post });
});

app.get('/api/volunteers/profile', authenticateJwt as express.RequestHandler, async (request: AuthenticatedRequest, response, next) => {
  try {
    if (!request.user?.id) {
      response.status(401).json({ error: 'Bearer token is required' });
      return;
    }

    const item = await getVolunteerProfile(request.user.id);
    const profile = item?.profile?.status === 'pending_review'
      ? { ...item.profile, status: 'verified' }
      : item?.profile;
    response.json({
      item: item ? { userId: item.user_id, profile } : null,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/volunteers/urgent-alerts', authenticateJwt as express.RequestHandler, async (request: AuthenticatedRequest, response, next) => {
  try {
    if (!request.user?.id) {
      response.status(401).json({ error: 'Bearer token is required' });
      return;
    }
    response.json({ items: await listUrgentVolunteerAlertsForVolunteer(request.user.id) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/volunteers/urgent-alerts/:id/accept', authenticateJwt as express.RequestHandler, async (request: AuthenticatedRequest, response, next) => {
  try {
    if (!request.user?.id) {
      response.status(401).json({ error: 'Bearer token is required' });
      return;
    }
    const item = await acceptUrgentVolunteerAlert(request.params.id, request.user.id);
    if (!item) {
      response.status(404).json({ error: 'Urgent volunteer alert not found' });
      return;
    }
    response.json({ item });
  } catch (error) {
    next(error);
  }
});

app.put('/api/volunteers/profile', authenticateJwt as express.RequestHandler, async (request: AuthenticatedRequest, response, next) => {
  try {
    if (!request.user?.id) {
      response.status(401).json({ error: 'Bearer token is required' });
      return;
    }

    const body = asObject(request.body);
    const profile = {
      ...body,
      name: stringBody(body.name) ?? request.user.display_name ?? request.user.username ?? 'Citizen Volunteer',
      email: stringBody(body.email) ?? request.user.email ?? '',
      status: body.status === 'assigned' || body.status === 'checked_in' || body.status === 'completed'
        ? body.status
        : 'verified',
    };
    const item = await upsertVolunteerProfile(request.user.id, profile);
    response.json({
      item: item ? { userId: item.user_id, profile: item.profile } : null,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/gov/volunteers/profiles', ...requireGovUser, async (_request, response, next) => {
  try {
    const items = await listVolunteerProfiles();
    response.json({
      items: items.map((item) => ({
        userId: item.user_id,
        profile: item.profile?.status === 'pending_review'
          ? { ...item.profile, status: 'verified' }
          : item.profile,
      })),
    });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/gov/volunteers/profiles/:userId', ...requireGovUser, async (request, response, next) => {
  try {
    const item = await patchVolunteerProfile(request.params.userId, asObject(request.body));
    if (!item) {
      response.status(404).json({ error: 'Volunteer profile not found' });
      return;
    }
    response.json({ item: { userId: item.user_id, profile: item.profile } });
  } catch (error) {
    next(error);
  }
});

app.get('/api/gov/volunteers/urgent-alerts', ...requireGovUser, async (_request, response, next) => {
  try {
    response.json({ items: await listUrgentVolunteerAlerts() });
  } catch (error) {
    next(error);
  }
});

app.post('/api/gov/volunteers/urgent-alerts', ...requireGovUser, async (request: AuthenticatedRequest, response, next) => {
  try {
    const title = stringBody(request.body?.title);
    const message = stringBody(request.body?.message);
    const location = stringBody(request.body?.location);
    const region = stringBody(request.body?.region);
    const agency = stringBody(request.body?.agency) ?? request.user?.username ?? request.user?.display_name ?? 'Government';
    const needed = numberBody(request.body?.needed) ?? 1;

    if (!title || !message || !location || !region) {
      response.status(400).json({ error: 'Title, message, location, and region are required' });
      return;
    }

    const item = await createUrgentVolunteerAlert({
      title,
      message,
      location,
      region,
      agency,
      needed,
    });
    response.status(201).json({ item });
  } catch (error) {
    next(error);
  }
});

app.get('/api/report-subject-tags', authenticateJwt as express.RequestHandler, async (request, response, next) => {
  try {
    response.json({ items: await listReportSubjectTags({ activeOnly: request.query.active === 'true' }) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/report-subject-tags', ...requireGovUser, async (request: AuthenticatedRequest, response, next) => {
  const label = stringBody(request.body?.label);
  if (!label) {
    response.status(400).json({ error: 'Subject tag label is required' });
    return;
  }

  const categories = Array.isArray(request.body?.categories)
    ? request.body.categories.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  if (!categories.length) {
    response.status(400).json({ error: 'At least one subject category is required' });
    return;
  }

  try {
    const item = await createReportSubjectTag({
      label,
      description: stringBody(request.body?.description),
      categories,
      createdByUserId: request.user?.id,
    });
    if (!item) {
      response.status(500).json({ error: 'Unable to create subject tag' });
      return;
    }
    response.status(201).json({ item });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/report-subject-tags/:id', ...requireGovUser, async (request, response, next) => {
  const label = stringBody(request.body?.label);
  if (!label) {
    response.status(400).json({ error: 'Subject tag label is required' });
    return;
  }

  try {
    const item = await renameReportSubjectTag(request.params.id, label);
    if (!item) {
      response.status(404).json({ error: 'Subject tag not found' });
      return;
    }
    response.json({ item });
  } catch (error) {
    next(error);
  }
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
    const items = await listTicketsForReporter(request.user.id, { visibleFeed: request.query.scope === 'visible' });
    response.json({ items: items.map(redactInternalTicket) });
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
      const uploadedImages = files.map((file) => ({
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        byteSize: file.size,
        storageKey: `uploads/${Date.now()}-${file.originalname}`,
        previewUrl: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
      }));
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
        subjectTagId: stringBody(request.body?.subjectTagId) ?? null,
        images: [
          ...uploadedImages,
          ...bodyImages,
        ],
      });

      if (!ticket) {
        response.status(500).json({ error: 'Unable to create ticket' });
        return;
      }

      const postToForum = request.body?.postToForum === 'true' || request.body?.postToForum === true;
      const forumResult = postToForum && ticket.status !== 'spam'
        ? createOrMergeForumPost({
            author: stringBody(request.body?.reporter)
              ?? request.user?.display_name
              ?? request.user?.username
              ?? 'Citizen',
            content: message,
            category: forumCategory(crisisType),
            location: stringBody(request.body?.locationText) ?? stringBody(request.body?.location),
            latitude: numberBody(request.body?.latitude),
            longitude: numberBody(request.body?.longitude),
            sourceReportId: ticket.id,
            aiFlag: await detectPotentialMisinformation(message),
            images: [...uploadedImages, ...bodyImages].map((image) => ({
              filename: image.originalFilename,
              mimeType: image.mimeType,
              previewUrl: image.previewUrl,
            })),
          })
        : null;

      response.status(201).json({
        id: ticket.id,
        publicReportId: ticket.id,
        status: ticket.status,
        assignedAgency: ticket.assignedAgency,
        createdAt: new Date().toISOString(),
        item: redactInternalTicket(ticket),
        forumPost: forumResult?.post ?? null,
        forumMerged: forumResult?.merged ?? false,
        forumSuppressed: postToForum && ticket.status === 'spam',
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
      item: redactInternalTicket(ticket),
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
    response.status(201).json({ item: redactInternalTicket(ticket) });
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

app.patch('/api/tickets/:id/subject-tag', ...requireGovUser, async (request: AuthenticatedRequest, response, next) => {
  try {
    const subjectTagId = stringBody(request.body?.subjectTagId) ?? null;
    const ticket = await setTicketSubjectTag(request.params.id, subjectTagId, request.user?.id);
    if (!ticket) {
      response.status(404).json({ error: 'Ticket not found' });
      return;
    }
    response.json({ item: ticket });
  } catch (error) {
    next(error);
  }
});

app.post('/api/tickets/:id/start-work', ...requireGovUser, async (request: AuthenticatedRequest, response, next) => {
  try {
    const ticket = await startTicketWork(
      request.params.id,
      request.user?.id,
      request.user?.display_name ?? request.user?.username ?? request.user?.email ?? 'Government handler',
    );
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
      targetAgencies: Array.isArray(request.body?.targetAgencies) ? request.body.targetAgencies.filter((item: unknown) => typeof item === 'string') : [],
      targetRegions: Array.isArray(request.body?.targetRegions) ? request.body.targetRegions.filter((item: unknown) => typeof item === 'string') : [],
      platforms: Array.isArray(request.body?.platforms) ? request.body.platforms.filter((item: unknown) => typeof item === 'string') : ['web'],
    });
    if (!item) {
      response.status(500).json({ error: 'Unable to create broadcast' });
      return;
    }
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

app.patch('/api/broadcasts/:id/unresolve', ...requireGovUser, async (request, response, next) => {
  try {
    const item = await unresolveBroadcast(request.params.id);
    if (!item) {
      response.status(404).json({ error: 'Broadcast not found' });
      return;
    }
    response.json({ item });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/broadcasts/:id', ...requireGovUser, async (request, response, next) => {
  try {
    const deleted = await deleteBroadcast(request.params.id);
    if (!deleted) {
      response.status(404).json({ error: 'Broadcast not found' });
      return;
    }
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.post('/api/broadcasts/:id/updates', ...requireGovUser, async (request: AuthenticatedRequest, response, next) => {
  const body = stringBody(request.body?.body) ?? stringBody(request.body?.message);
  if (!body) {
    response.status(400).json({ error: 'Update body is required' });
    return;
  }

  try {
    const update = await addBroadcastUpdate({
      broadcastId: request.params.id,
      authorUserId: request.user?.id,
      body,
    });
    if (!update) {
      response.status(404).json({ error: 'Ongoing broadcast not found' });
      return;
    }
    response.status(201).json({ item: update });
  } catch (error) {
    next(error);
  }
});

app.get('/api/citizen/broadcasts', async (_request, response, next) => {
  try {
    response.json({ items: await listBroadcasts({ includeResolved: true }) });
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
    const [crises, alerts, broadcasts, overview] = await Promise.all([
      listCrises({ status: 'active' }),
      listAlerts({ status: 'active' }),
      listBroadcasts(),
      getLatestSnapshot('dashboard_overview'),
    ]);

    const liveBroadcastAlerts = broadcasts.map((broadcast) => ({
      id: `broadcast-${broadcast.id}`,
      type: 'Broadcast',
      severity: broadcast.severity,
      message: `${broadcast.title}: ${broadcast.message}`,
      region: broadcast.senderAgencyCode
        ? `${broadcast.targetRegions.length ? broadcast.targetRegions.join('/') : 'Nationwide'} • ${broadcast.senderAgencyCode}`
        : (broadcast.targetRegions.length ? broadcast.targetRegions.join('/') : 'Nationwide'),
      time: broadcast.time,
    }));

    response.json({ crises, alerts: [...liveBroadcastAlerts, ...alerts], overview });
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

app.get('/api/gov/infrastructure/cameras/live', ...requireGovUser, async (_request, response, next) => {
  try {
    response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.setHeader('Pragma', 'no-cache');
    response.setHeader('Expires', '0');
    response.json({ infrastructure: await fetchLiveTrafficCameraSnapshot() });
  } catch (error) {
    next(error);
  }
});

app.get('/api/gov/weather/rain-radar', ...requireGovUser, async (_request, response, next) => {
  try {
    response.setHeader('Cache-Control', 'no-store');
    response.json(await fetchNeaRainRadarFrames());
  } catch (error) {
    next(error);
  }
});

app.get('/api/gov/weather/haze-layers', ...requireGovUser, async (_request, response, next) => {
  try {
    response.setHeader('Cache-Control', 'no-store');
    response.json(await fetchNeaHazeLayers());
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

function isTicketStatus(value: unknown): value is TicketStatus {
  return value === 'open' || value === 'in-progress' || value === 'resolved' || value === 'grouped' || value === 'spam';
}

function isBroadcastSeverity(value: unknown): value is BroadcastSeverity {
  return value === 'critical' || value === 'high' || value === 'medium' || value === 'low';
}

function redactInternalTicket(ticket: Ticket): Ticket {
  return {
    ...ticket,
    comments: ticket.comments.filter((comment) => comment.visibility === 'public'),
  };
}

async function getSnapshotResponse(snapshotKey: string) {
  const payload = await getLatestSnapshot(snapshotKey);
  return payload ?? { items: [] };
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function forumCooldownKey(request: express.Request, author?: string) {
  const forwardedFor = stringParam(request.headers['x-forwarded-for']);
  const clientIp = forwardedFor?.split(',')[0]?.trim() || request.ip || request.socket.remoteAddress || 'unknown';
  return `${clientIp}:${(author ?? 'Anonymous User').trim().toLowerCase()}`;
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

function forumCategory(crisisType: string) {
  const normalized = crisisType.toLowerCase();
  if (normalized === 'health') return 'Health';
  if (normalized === 'flood' || normalized === 'environment') return 'Weather';
  if (normalized === 'supply') return 'Supply';
  if (normalized === 'infrastructure' || normalized === 'transport') return 'Infrastructure';
  return 'Community';
}
