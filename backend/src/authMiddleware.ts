import type { NextFunction, Request, Response } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import crypto from 'node:crypto';
import {
  createRefreshToken,
  createSession,
  findActiveSessionByRefreshToken,
  getUserById,
  revokeSession,
  type ActorType,
  type AuthenticatedUser,
} from './authRepository.js';

type AccessTokenPayload = {
  sub: string;
  actorType: ActorType;
  email?: string;
  role?: string;
};

const generatedDevSecret = crypto.randomBytes(32).toString('hex');
const jwtSecret = process.env.JWT_SECRET ?? generatedDevSecret;
const accessTtl = (process.env.JWT_ACCESS_TTL ?? '15m') as SignOptions['expiresIn'];
const refreshDays = Number(process.env.JWT_REFRESH_DAYS ?? 7);

if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET is not set. Using a generated development secret for this process only.');
}

export type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
  token?: AccessTokenPayload;
};

export async function issueTokenPair(input: {
  user: AuthenticatedUser;
  ipAddress?: string;
  userAgent?: string;
}) {
  const accessToken = signAccessToken(input.user);
  const refreshToken = createRefreshToken();
  const refreshExpiresAt = new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000);

  await createSession({
    userId: input.user.id,
    refreshToken,
    expiresAt: refreshExpiresAt,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: String(accessTtl),
    refreshExpiresAt: refreshExpiresAt.toISOString(),
  };
}

export async function refreshTokenPair(input: {
  refreshToken: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const session = await findActiveSessionByRefreshToken(input.refreshToken);
  if (!session) return null;

  const user = await getUserById(session.user_id);
  if (!user) return null;

  await revokeSession(session.id);
  return issueTokenPair({ user, ipAddress: input.ipAddress, userAgent: input.userAgent });
}

export async function authenticateJwt(request: AuthenticatedRequest, response: Response, next: NextFunction) {
  const header = request.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;

  if (!token) {
    response.status(401).json({ error: 'Bearer token is required' });
    return;
  }

  try {
    const payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] }) as AccessTokenPayload;
    const user = await getUserById(payload.sub);
    if (!user) {
      response.status(401).json({ error: 'Invalid token user' });
      return;
    }
    request.token = payload;
    request.user = user;
    next();
  } catch {
    response.status(401).json({ error: 'Invalid or expired token' });
  }
}

export async function optionalAuthenticateJwt(request: AuthenticatedRequest, _response: Response, next: NextFunction) {
  const header = request.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;

  if (!token) {
    next();
    return;
  }

  try {
    const payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] }) as AccessTokenPayload;
    const user = await getUserById(payload.sub);
    if (user) {
      request.token = payload;
      request.user = user;
    }
  } catch {
    // Optional auth intentionally ignores invalid tokens and treats the request as anonymous.
  }

  next();
}

export function requireActor(...allowed: ActorType[]) {
  return (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
    if (!request.user || !allowed.includes(request.user.actor_type)) {
      response.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

function signAccessToken(user: AuthenticatedUser) {
  const payload: AccessTokenPayload = {
    sub: user.id,
    actorType: user.actor_type,
    ...(user.email ? { email: user.email } : {}),
    ...(user.role ? { role: user.role } : {}),
  };

  return jwt.sign(payload, jwtSecret, {
    algorithm: 'HS256',
    expiresIn: accessTtl,
  });
}
