import type { FastifyRequest, FastifyReply } from 'fastify';
import type { JwtPayload } from '../plugins/auth.js';

type Role = JwtPayload['role'];

const ROLE_RANK: Record<Role, number> = { owner: 3, admin: 2, agent: 1 };

/**
 * requireAuth(minRole?) — preHandler that enforces authentication + optional minimum role.
 * requireAuth()         → any authenticated user
 * requireAuth('admin')  → admin or owner
 * requireAuth('owner')  → owner only
 */
export function requireAuth(minRole?: Role) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Debes iniciar sesión para acceder a este recurso',
        code: 'UNAUTHORIZED',
      });
    }

    if (minRole) {
      const userRank = ROLE_RANK[request.user.role] ?? 0;
      const required = ROLE_RANK[minRole] ?? 0;

      if (userRank < required) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'No tienes permisos suficientes para realizar esta acción',
          code: 'FORBIDDEN',
        });
      }
    }
  };
}
