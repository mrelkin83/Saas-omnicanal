import type { FastifyRequest, FastifyReply } from 'fastify';

export async function requireSuperAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user?.isSuperAdmin) {
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Solo superadmins pueden acceder a este recurso',
      code: 'FORBIDDEN',
    });
  }
}
