import type { FastifyRequest, FastifyReply } from 'fastify';
import { db, superadminUsers, eq, and } from '@saas/db';

export async function requireSuperAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user?.isSuperAdmin) {
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Solo superadmins pueden acceder a este recurso',
      code: 'FORBIDDEN',
    });
  }

  const [saUser] = await db
    .select()
    .from(superadminUsers)
    .where(and(eq(superadminUsers.email, request.user.email), eq(superadminUsers.isActive, true)))
    .limit(1);

  if (!saUser) {
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Solo superadmins pueden acceder a este recurso',
      code: 'FORBIDDEN',
    });
  }
}
