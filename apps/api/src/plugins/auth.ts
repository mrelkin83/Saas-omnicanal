import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { SignJWT, jwtVerify } from 'jose';
import { randomUUID } from 'node:crypto';
import { redis } from '../lib/redis.js';
import { db, superadminUsers, eq, and } from '@saas/db';

export interface JwtPayload {
  sub: string;
  tenantId: string;
  role: 'owner' | 'admin' | 'agent';
  email: string;
  isSuperAdmin?: boolean | undefined;
}

declare module 'fastify' {
  interface FastifyInstance {
    signTokens: (payload: JwtPayload) => Promise<{ accessToken: string; refreshToken: string }>;
    verifyAccessToken: (token: string) => Promise<JwtPayload>;
    invalidateRefreshToken: (refreshToken: string) => Promise<void>;
    rotateRefreshToken: (refreshToken: string) => Promise<{ accessToken: string; refreshToken: string; payload: JwtPayload } | null>;
  }
  interface FastifyRequest {
    user: JwtPayload | null;
  }
}

const REFRESH_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

function getSecret(): Uint8Array {
  const secret = process.env['JWT_SECRET'];
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }
  return new TextEncoder().encode(secret);
}

function getExpiry(): string {
  return process.env['JWT_EXPIRY'] ?? '15m';
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('user', null);

  fastify.decorate('signTokens', async (payload: JwtPayload) => {
    const secret = getSecret();
    const accessToken = await new SignJWT({ ...payload })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setSubject(payload.sub)
      .setExpirationTime(getExpiry())
      .sign(secret);

    const refreshToken = randomUUID();
    await redis.set(
      `refresh:${refreshToken}`,
      JSON.stringify(payload),
      'EX',
      REFRESH_TTL,
    );

    return { accessToken, refreshToken };
  });

  fastify.decorate('verifyAccessToken', async (token: string): Promise<JwtPayload> => {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as JwtPayload;
  });

  fastify.decorate('invalidateRefreshToken', async (refreshToken: string) => {
    await redis.del(`refresh:${refreshToken}`);
  });

  fastify.decorate(
    'rotateRefreshToken',
    async (
      refreshToken: string,
    ): Promise<{ accessToken: string; refreshToken: string; payload: JwtPayload } | null> => {
      const raw = await redis.get(`refresh:${refreshToken}`);
      if (!raw) return null;

      const payload = JSON.parse(raw) as JwtPayload;
      await redis.del(`refresh:${refreshToken}`);

      const tokens = await fastify.signTokens(payload);
      return { ...tokens, payload };
    },
  );

  // Global preHandler: extract JWT from Authorization header or ?token= query param (SSE)
  fastify.addHook('preHandler', async (request: FastifyRequest) => {
    const authHeader = request.headers.authorization;
    const queryToken = (request.query as Record<string, string | undefined>)['token'];
    const raw = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : queryToken;
    if (!raw) return;

    try {
      const payload = await fastify.verifyAccessToken(raw);
      if (payload.isSuperAdmin) {
        const [saUser] = await db
          .select()
          .from(superadminUsers)
          .where(and(eq(superadminUsers.email, payload.email), eq(superadminUsers.isActive, true)))
          .limit(1);
        if (!saUser) {
          payload.isSuperAdmin = false;
        }
      }
      request.user = payload;
    } catch {
      // Invalid token — request.user stays null; routes that require auth will reject
    }
  });
};

export default fp(authPlugin, { name: 'auth' });
