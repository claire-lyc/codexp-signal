import type { Router } from 'express';
import { Router as createRouter } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import {
  createPasswordUser,
  findActiveSessionByRefreshToken,
  revokeSession,
  verifyPasswordUser,
} from './authRepository.js';
import {
  authenticateJwt,
  issueTokenPair,
  refreshTokenPair,
  type AuthenticatedRequest,
} from './authMiddleware.js';

const emailSchema = z.string().trim().email().max(320).transform((value) => value.toLowerCase());
const passwordSchema = z.string().min(8).max(128);
const loginPasswordSchema = z.string().min(1).max(128);

const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(120).optional(),
  actorType: z.enum(['citizen', 'government_user']).default('government_user'),
  role: z.string().trim().min(1).max(80).optional(),
  agencyCode: z.string().trim().min(1).max(40).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().min(1).max(320),
  password: loginPasswordSchema,
});

const refreshSchema = z.object({
  refreshToken: z.string().min(32).max(256),
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
      const user = await createPasswordUser(parsed.data);
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
