import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { db, sql } from '@saas/db';
import type { Database } from '@saas/db';

declare module 'fastify' {
  interface FastifyRequest {
    tenantId: string | null;
  }
  interface FastifyInstance {
    withTenantCtx: <T>(tenantId: string | null, fn: (tx: Database) => Promise<T>) => Promise<T>;
  }
}

const tenantPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('tenantId', null);

  fastify.decorate(
    'withTenantCtx',
    async <T>(tenantId: string | null, fn: (tx: Database) => Promise<T>): Promise<T> => {
      if (!tenantId) return fn(db);
      return db.transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`);
        return fn(tx as unknown as Database);
      });
    },
  );

  fastify.addHook('preHandler', async (request) => {
    const fromJwt = request.user?.tenantId;
    const fromHeader = request.headers['x-tenant-id'] as string | undefined;
    request.tenantId = fromJwt ?? fromHeader ?? null;
  });
};

export default fp(tenantPlugin, { name: 'tenant', dependencies: ['auth'] });
