import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../../middleware/require-auth.js';
import { whatsappDriver } from './drivers/whatsapp/whatsapp.driver.js';
import { instagramDriver } from './drivers/instagram/instagram.driver.js';
import { facebookDriver } from './drivers/facebook/facebook.driver.js';
import { tiktokDriver } from './drivers/tiktok/tiktok.driver.js';
import { upsertSession, getActiveSession, deleteSession, updateSessionCredentials, getSessionCredentials } from './channels.service.js';
import { addSSEClient, removeSSEClient, pushSSEEvent } from './core/sse-registry.js';
import { handleIncomingMessage } from './core/incoming-handler.js';
import { addInboxClient, removeInboxClient } from '../../modules/conversations/inbox.sse.js';
import * as evo from '../../lib/evolution-api.client.js';

const channelsRoutes: FastifyPluginAsync = async (fastify) => {
  // ── WhatsApp ──────────────────────────────────────────────────────────────

  fastify.post('/whatsapp/connect', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;

    let result;
    try {
      result = await whatsappDriver.connect(tenantId, {});
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, 'WhatsApp connect failed');
      if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('fetch failed')) {
        return reply.status(503).send({ error: 'Service Unavailable', message: 'No se pudo conectar con Evolution API. Verifica que el servicio esté corriendo.', code: 'EVO_UNREACHABLE' });
      }
      return reply.status(502).send({ error: 'Bad Gateway', message: `Error de Evolution API: ${msg}`, code: 'EVO_ERROR' });
    }

    await upsertSession(tenantId, 'whatsapp', result.sessionId, 'pending_qr');

    // Poll for QR up to 10 seconds (Evolution generates it asynchronously)
    let qrCode: string | null = result.qrCode ?? null;
    if (!qrCode) {
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        try {
          const qr = await evo.getQR(result.sessionId);
          if (qr.base64) { qrCode = qr.base64; break; }
        } catch (err) {
          request.log.debug({ err }, 'QR not ready yet');
        }
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

  // ── Instagram ─────────────────────────────────────────────────────────────

  const igConnectSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
    twoFactorCode: z.string().optional(),
  });

  fastify.post('/instagram/connect', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const data = igConnectSchema.parse(request.body);

    const result = await instagramDriver.connect(tenantId, data);

    if (result.errorMessage === 'requires_2fa') {
      return { ok: false, requires2FA: true };
    }
    if (result.status === 'error') {
      return reply.status(400).send({ error: 'Bad Request', message: result.errorMessage ?? 'Error conectando Instagram', code: 'IG_CONNECT_ERROR' });
    }

    await upsertSession(tenantId, 'instagram', tenantId, 'connected', data.username);
    instagramDriver.onIncoming(handleIncomingMessage);
    return { ok: true, username: data.username };
  });

  fastify.delete('/instagram/:id', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const { id } = request.params as { id: string };
    const session = await getActiveSession(tenantId, 'instagram');
    if (!session || session.id !== id) {
      return reply.status(404).send({ error: 'Not Found', message: 'Sesión no encontrada', code: 'NOT_FOUND' });
    }
    await instagramDriver.disconnect(tenantId);
    await deleteSession(tenantId, id);
    return reply.status(204).send();
  });

  // ── Facebook ──────────────────────────────────────────────────────────────

  const fbConnectSchema = z.object({
    email: z.string().email().optional(),
    password: z.string().min(1).optional(),
    twoFactorCode: z.string().optional(),
    appState: z.string().optional(),
  }).refine((data) => (data.email && data.password) || data.appState, {
    message: 'Se requiere email+password o appState',
    path: ['email'],
  });

  fastify.post('/facebook/connect', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const data = fbConnectSchema.parse(request.body);

    // Try to load saved appState from DB for reconnection
    const savedCreds = await getSessionCredentials(tenantId, 'facebook');
    const payload: Record<string, string | undefined> = {
      email: data.email ?? undefined,
      password: data.password ?? undefined,
      twoFactorCode: data.twoFactorCode ?? undefined,
      appState: data.appState ?? (savedCreds?.appState as string | undefined) ?? undefined,
    };

    const result = await facebookDriver.connect(tenantId, payload);

    if (result.errorMessage === 'requires_2fa') {
      return { ok: false, requires2FA: true };
    }
    if (result.status === 'error') {
      return reply.status(400).send({ error: 'Bad Request', message: result.errorMessage ?? 'Error conectando Facebook', code: 'FB_CONNECT_ERROR' });
    }

    // Persist appState for future reconnections
    const freshAppState = facebookDriver.getAppState(tenantId);
    if (freshAppState) {
      await upsertSession(tenantId, 'facebook', tenantId, 'connected');
      await updateSessionCredentials(tenantId, 'facebook', { appState: freshAppState });
    } else {
      await upsertSession(tenantId, 'facebook', tenantId, 'connected');
    }

    facebookDriver.onIncoming(handleIncomingMessage);
    return { ok: true };
  });

  fastify.delete('/facebook/:id', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const { id } = request.params as { id: string };
    const session = await getActiveSession(tenantId, 'facebook');
    if (!session || session.id !== id) {
      return reply.status(404).send({ error: 'Not Found', message: 'Sesión no encontrada', code: 'NOT_FOUND' });
    }
    await facebookDriver.disconnect(tenantId);
    await deleteSession(tenantId, id);
    return reply.status(204).send();
  });

  // ── TikTok ────────────────────────────────────────────────────────────────

  const ttConnectSchema = z.object({
    cookies: z.string().min(1),
    username: z.string().min(1),
  });

  fastify.post('/tiktok/connect', { preHandler: [requireAuth('admin')] }, async (request, _reply) => {
    const tenantId = request.user!.tenantId;
    const data = ttConnectSchema.parse(request.body);

    await tiktokDriver.connect(tenantId, data);
    await upsertSession(tenantId, 'tiktok', tenantId, 'connected', data.username);
    // Persist cookies for reconnection
    await updateSessionCredentials(tenantId, 'tiktok', { cookies: data.cookies, username: data.username });
    tiktokDriver.onIncoming(handleIncomingMessage);
    return { ok: true, username: data.username };
  });

  fastify.delete('/tiktok/:id', { preHandler: [requireAuth('admin')] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const { id } = request.params as { id: string };
    const session = await getActiveSession(tenantId, 'tiktok');
    if (!session || session.id !== id) {
      return reply.status(404).send({ error: 'Not Found', message: 'Sesión no encontrada', code: 'NOT_FOUND' });
    }
    await tiktokDriver.disconnect(tenantId);
    await deleteSession(tenantId, id);
    return reply.status(204).send();
  });

  // ── All channels status ───────────────────────────────────────────────────

  fastify.get('/all-status', { preHandler: [requireAuth()] }, async (request) => {
    const tenantId = request.user!.tenantId;
    const channels = ['whatsapp', 'instagram', 'facebook', 'tiktok'] as const;
    const result: Record<string, unknown> = {};
    for (const ch of channels) {
      const session = await getActiveSession(tenantId, ch);
      result[ch] = session ? { id: session.id, status: session.status, displayName: session.displayName } : null;
    }
    return result;
  });

  // ── Inbox SSE ─────────────────────────────────────────────────────────────

  fastify.get('/inbox/stream', { preHandler: [requireAuth()] }, (request, reply) => {
    const tenantId = request.user!.tenantId;
    const res = reply.raw;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    reply.hijack();
    res.flushHeaders();

    addInboxClient(tenantId, res);
    const ping = setInterval(() => {
      try { res.write(':ping\n\n'); } catch { clearInterval(ping); }
    }, 25000);

    request.raw.on('close', () => {
      clearInterval(ping);
      removeInboxClient(tenantId, res);
    });
  });
};

export default channelsRoutes;
