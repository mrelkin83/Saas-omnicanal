import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../../middleware/require-auth.js';
import { whatsappDriver } from './drivers/whatsapp/whatsapp.driver.js';
import { upsertSession, getActiveSession, deleteSession } from './channels.service.js';
import { addSSEClient, removeSSEClient, pushSSEEvent } from './core/sse-registry.js';
import * as evo from '../../lib/evolution-api.client.js';

const channelsRoutes: FastifyPluginAsync = async (fastify) => {
  // ── WhatsApp ──────────────────────────────────────────────────────────────

  fastify.post('/whatsapp/connect', { preHandler: [requireAuth('admin')] }, async (request, _reply) => {
    const tenantId = request.user!.tenantId;

    const result = await whatsappDriver.connect(tenantId, {});
    await upsertSession(tenantId, 'whatsapp', result.sessionId, 'pending_qr');

    // Poll for QR up to 10 seconds (Evolution generates it asynchronously)
    let qrCode: string | null = result.qrCode ?? null;
    if (!qrCode) {
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        try {
          const qr = await evo.getQR(result.sessionId);
          if (qr.base64) { qrCode = qr.base64; break; }
        } catch { /* not ready yet */ }
      }
    }

    return { sessionId: result.sessionId, status: result.status, qrCode };
  });

  fastify.delete('/whatsapp/:id', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const { id } = request.params as { id: string };

    const session = await getActiveSession(tenantId, 'whatsapp');
    if (!session || session.id !== id) {
      return reply.status(404).send({ error: 'Not Found', message: 'Sesión no encontrada', code: 'NOT_FOUND' });
    }

    try {
      await whatsappDriver.disconnect(session.externalId ?? id);
    } catch {
      // Continue even if Evolution API throws
    }

    await deleteSession(tenantId, id);
    pushSSEEvent(tenantId, 'disconnected', {});

    return reply.status(204).send();
  });

  // SSE stream for QR + connection status updates
  fastify.get('/whatsapp/stream', { preHandler: [requireAuth()] }, (request, reply) => {
    const tenantId = request.user!.tenantId;
    const res = reply.raw;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    reply.hijack();
    res.flushHeaders();

    addSSEClient(tenantId, res);

    // Send initial session state
    getActiveSession(tenantId, 'whatsapp').then((session) => {
      if (session) {
        const event = session.status === 'connected' ? 'connected' : 'status';
        const data = session.status === 'connected'
          ? { phone: session.displayName }
          : { status: session.status };
        try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch { /* ignore */ }
      }
    }).catch(() => null);

    const ping = setInterval(() => {
      try { res.write(':ping\n\n'); } catch { clearInterval(ping); }
    }, 25000);

    request.raw.on('close', () => {
      clearInterval(ping);
      removeSSEClient(tenantId, res);
    });
  });

  // ── Status ─────────────────────────────────────────────────────────────────

  fastify.get('/status', { preHandler: [requireAuth()] }, async (request) => {
    const tenantId = request.user!.tenantId;
    const session = await getActiveSession(tenantId, 'whatsapp');
    if (!session) return { whatsapp: null };

    return {
      whatsapp: {
        id: session.id,
        status: session.status,
        displayName: session.displayName,
        lastSeenAt: session.lastSeenAt,
      },
    };
  });

  // ── QR refresh ─────────────────────────────────────────────────────────────

  fastify.get('/whatsapp/qr', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const session = await getActiveSession(tenantId, 'whatsapp');
    if (!session) {
      return reply.status(404).send({ error: 'Not Found', message: 'No hay sesión activa', code: 'NOT_FOUND' });
    }

    try {
      const qr = await evo.getQR(session.externalId ?? `tenant-${tenantId}`);
      return { qrCode: qr.base64 };
    } catch {
      return reply.status(503).send({ error: 'Service Unavailable', message: 'QR no disponible aún', code: 'QR_NOT_READY' });
    }
  });
};

export default channelsRoutes;
