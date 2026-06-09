import type { Router } from 'express';
import { Router as createRouter } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import {
  createPasswordUser,
  findActiveSessionByRefreshToken,
  getNotificationPreferences,
  revokeSession,
  updateNotificationPreferences,
  verifyPasswordUser,
} from './authRepository.js';
import {
  authenticateJwt,
  issueTokenPair,
  refreshTokenPair,
  type AuthenticatedRequest,
} from './authMiddleware.js';

const emailSchema = z.string().trim().email().max(320).transform((value) => value.toLowerCase());
const usernameSchema = z.string().trim().min(3).max(64);
const passwordSchema = z.string().min(8).max(128);
const loginPasswordSchema = z.string().min(1).max(128);

const registerSchema = z.object({
  email: emailSchema.optional(),
  username: usernameSchema.optional(),
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(120).optional(),
}).refine((value) => Boolean(value.email || value.username), {
  message: 'Email or username is required',
  path: ['email'],
});

const loginSchema = z.object({
  email: z.string().trim().min(1).max(320),
  password: loginPasswordSchema,
});

const refreshSchema = z.object({
  refreshToken: z.string().min(32).max(256),
});

const preferencesSchema = z.object({
  alertNotifications: z.boolean().default(true),
  replyNotifications: z.boolean().default(true),
  agencyPingNotifications: z.boolean().default(true),
  volunteerNotifications: z.boolean().default(false),
  smsEnabled: z.boolean().default(false),
  phoneNumber: z.string().trim().max(32).optional().nullable(),
}).refine((value) => !value.smsEnabled || Boolean(value.phoneNumber?.trim()), {
  message: 'Phone number is required when SMS is enabled',
  path: ['phoneNumber'],
}).refine((value) => !value.smsEnabled || /^\+?[0-9][0-9\s-]{6,20}$/.test(value.phoneNumber?.trim() ?? ''), {
  message: 'Enter a valid phone number',
  path: ['phoneNumber'],
});

export function createAuthRouter(): Router {
  const router = createRouter();
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
  });

  router.post('/register', authLimiter, async (request, response, next) => {
    if (process.env.AUTH_REGISTRATION_ENABLED !== 'true') {
      response.status(403).json({ error: 'Registration is disabled' });
      return;
    }

    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'Invalid registration payload', details: parsed.error.flatten().fieldErrors });
      return;
    }

    try {
      const user = await createPasswordUser({
        email: parsed.data.email,
        username: parsed.data.username,
        password: parsed.data.password,
        displayName: parsed.data.displayName,
        actorType: 'citizen',
        tags: ['Citizen'],
      });
      if (!user) {
        response.status(500).json({ error: 'Unable to create user' });
        return;
      }

      const tokens = await issueTokenPair({
        user,
        ipAddress: request.ip,
        userAgent: request.get('user-agent'),
      });

      response.status(201).json({ user: sanitizeUser(user), tokens });
    } catch (error) {
      if (isUniqueViolation(error)) {
        response.status(409).json({ error: 'Email is already registered' });
        return;
      }
      next(error);
    }
  });

  router.post('/login', authLimiter, async (request, response, next) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'Invalid login payload', details: parsed.error.flatten().fieldErrors });
      return;
    }

    try {
      const user = await verifyPasswordUser(parsed.data.email, parsed.data.password);
      if (!user) {
        response.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      const tokens = await issueTokenPair({
        user,
        ipAddress: request.ip,
        userAgent: request.get('user-agent'),
      });

      response.json({ user: sanitizeUser(user), tokens });
    } catch (error) {
      next(error);
    }
  });

  router.post('/refresh', authLimiter, async (request, response, next) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'Invalid refresh payload', details: parsed.error.flatten().fieldErrors });
      return;
    }

    try {
      const tokens = await refreshTokenPair({
        refreshToken: parsed.data.refreshToken,
        ipAddress: request.ip,
        userAgent: request.get('user-agent'),
      });

      if (!tokens) {
        response.status(401).json({ error: 'Invalid or expired refresh token' });
        return;
      }

      response.json({ tokens });
    } catch (error) {
      next(error);
    }
  });

  router.post('/logout', authLimiter, async (request, response, next) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'Invalid logout payload', details: parsed.error.flatten().fieldErrors });
      return;
    }

    try {
      const session = await findActiveSessionByRefreshToken(parsed.data.refreshToken);
      if (session) await revokeSession(session.id);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.get('/me', authenticateJwt, (request: AuthenticatedRequest, response) => {
    response.json({ user: request.user ? sanitizeUser(request.user) : null });
  });

  router.get('/profile', authenticateJwt, async (request: AuthenticatedRequest, response, next) => {
    try {
      if (!request.user?.id) {
        response.status(401).json({ error: 'Bearer token is required' });
        return;
      }

      response.json({
        user: sanitizeUser(request.user),
        preferences: await getNotificationPreferences(request.user.id),
      });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/profile/preferences', authenticateJwt, async (request: AuthenticatedRequest, response, next) => {
    const parsed = preferencesSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'Invalid preferences payload', details: parsed.error.flatten().fieldErrors });
      return;
    }

    try {
      if (!request.user?.id) {
        response.status(401).json({ error: 'Bearer token is required' });
        return;
      }
      response.json({ preferences: await updateNotificationPreferences(request.user.id, parsed.data) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function sanitizeUser(user: NonNullable<AuthenticatedRequest['user']>) {
  return {
    id: user.id,
    actorType: user.actor_type,
    displayName: user.display_name,
    email: user.email,
    role: user.role,
    username: user.username,
    tags: user.tags,
    agencyId: user.agency_id,
    agencyCode: user.agency_code,
    clearanceLevel: user.clearance_level,
  };
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === '23505');
}
