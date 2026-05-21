import './env.js';
import { runMigrations } from '@saas/db';
import Fastify from 'fastify';

// Plugins
import errorHandlerPlugin from './plugins/error-handler.js';
import corsPlugin from './plugins/cors.js';
import swaggerPlugin from './plugins/swagger.js';
import rateLimitPlugin from './plugins/rate-limit.js';
import authPlugin from './plugins/auth.js';
import tenantPlugin from './plugins/tenant.js';

// Routes
import authRoutes from './modules/auth/auth.routes.js';
import tenantsRoutes from './modules/tenants/tenants.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import categoriesRoutes from './modules/categories/categories.routes.js';
import productsRoutes from './modules/products/products.routes.js';
import customersRoutes from './modules/customers/customers.routes.js';
import conversationsRoutes from './modules/conversations/conversations.routes.js';
import appointmentsRoutes from './modules/appointments/appointments.routes.js';
import ordersRoutes from './modules/orders/orders.routes.js';
import quotesRoutes from './modules/quotes/quotes.routes.js';
import reservationsRoutes from './modules/reservations/reservations.routes.js';
import deliveriesRoutes from './modules/deliveries/deliveries.routes.js';
import kanbanRoutes from './modules/kanban/kanban.routes.js';
import departmentsRoutes from './modules/departments/departments.routes.js';
import contactListsRoutes from './modules/contact-lists/contact-lists.routes.js';
import campaignsRoutes from './modules/campaigns/campaigns.routes.js';
import groupsRoutes from './modules/groups/groups.routes.js';
import integrationsRoutes from './modules/integrations/integrations.routes.js';
import { startCampaignSender, stopCampaignSender } from './jobs/campaign-sender.job.js';
import paymentsRoutes from './modules/payments/payments.routes.js';
import messagesRoutes from './modules/messages/messages.routes.js';
import analyticsRoutes from './modules/analytics/analytics.routes.js';
import aiRoutes from './modules/ai/ai.routes.js';
import devRoutes from './modules/dev/dev.routes.js';
import channelsRoutes from './modules/channels/channels.routes.js';
import webhooksRoutes from './modules/webhooks/webhooks.routes.js';
import { registerDriver } from './modules/channels/core/channel-manager.js';
import { whatsappDriver } from './modules/channels/drivers/whatsapp/whatsapp.driver.js';
import { instagramDriver } from './modules/channels/drivers/instagram/instagram.driver.js';
import { facebookDriver } from './modules/channels/drivers/facebook/facebook.driver.js';
import { tiktokDriver } from './modules/channels/drivers/tiktok/tiktok.driver.js';
import { handleIncomingMessage } from './modules/channels/core/incoming-handler.js';
import { startInstagramPoller, stopInstagramPoller } from './jobs/instagram-poller.job.js';
import { startTikTokScraper, stopTikTokScraper } from './jobs/tiktok-scraper.job.js';
import { startDemoExpiryJob, stopDemoExpiryJob } from './jobs/demo-expiry.job.js';
import { startReminderJob, stopReminderJob } from './jobs/reminder.job.js';
import superadminAuthRoutes from './modules/superadmin/auth.routes.js';
import superadminTenantsRoutes from './modules/superadmin/tenants.routes.js';
import superadminPlansRoutes from './modules/superadmin/plans.routes.js';
import superadminDemosRoutes from './modules/superadmin/demos.routes.js';
import superadminResellersRoutes from './modules/superadmin/resellers.routes.js';
import superadminDashboardRoutes from './modules/superadmin/dashboard.routes.js';
import superadminMonitorRoutes from './modules/superadmin/monitor.routes.js';
import superadminAuditRoutes from './modules/superadmin/audit.routes.js';

const PORT = parseInt(process.env['API_PORT'] ?? '3001', 10);
const HOST = process.env['API_HOST'] ?? '0.0.0.0';
const LOG_LEVEL = process.env['LOG_LEVEL'] ?? 'info';

const app = Fastify({
  logger: {
    level: LOG_LEVEL,
    ...(process.env['NODE_ENV'] !== 'production' && {
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
    }),
  },
});

// ── Register channel drivers ───────────────────────────────────────────────
registerDriver(whatsappDriver);
registerDriver(instagramDriver);
registerDriver(facebookDriver);
registerDriver(tiktokDriver);

whatsappDriver.onIncoming(handleIncomingMessage);

// ── Plugins (order matters) ────────────────────────────────────────────────
await app.register((await import('@fastify/multipart')).default, { limits: { fileSize: 10 * 1024 * 1024 } });
await app.register(errorHandlerPlugin);
await app.register(corsPlugin);
await app.register(swaggerPlugin);
await app.register(rateLimitPlugin);
await app.register(authPlugin);
await app.register(tenantPlugin);

// ── Health ────────────────────────────────────────────────────────────────
app.get('/health', async () => ({
  ok: true,
  timestamp: new Date().toISOString(),
  version: '0.0.1',
}));

// ── API Routes ────────────────────────────────────────────────────────────
await app.register(async (api) => {
  await api.register(authRoutes, { prefix: '/auth' });
  await api.register(tenantsRoutes, { prefix: '/tenants' });
  await api.register(usersRoutes, { prefix: '/users' });
  await api.register(categoriesRoutes, { prefix: '/categories' });
  await api.register(productsRoutes, { prefix: '/products' });
  await api.register(customersRoutes, { prefix: '/customers' });
  await api.register(conversationsRoutes, { prefix: '/conversations' });
  await api.register(appointmentsRoutes, { prefix: '/appointments' });
  await api.register(ordersRoutes, { prefix: '/orders' });
  await api.register(quotesRoutes, { prefix: '/quotes' });
  await api.register(reservationsRoutes, { prefix: '/reservations' });
  await api.register(deliveriesRoutes, { prefix: '/deliveries' });
  await api.register(kanbanRoutes, { prefix: '/kanban' });
  await api.register(departmentsRoutes, { prefix: '/departments' });
  await api.register(contactListsRoutes, { prefix: '/contact-lists' });
  await api.register(campaignsRoutes, { prefix: '/campaigns' });
  await api.register(groupsRoutes, { prefix: '/groups' });
  await api.register(integrationsRoutes, { prefix: '/integrations' });
  await api.register(paymentsRoutes, { prefix: '/payments' });
  await api.register(messagesRoutes, { prefix: '/messages' });
  await api.register(analyticsRoutes, { prefix: '/analytics' });
  await api.register(aiRoutes, { prefix: '/ai' });
  await api.register(devRoutes, { prefix: '/dev' });
  await api.register(channelsRoutes, { prefix: '/channels' });
  await api.register(webhooksRoutes, { prefix: '/webhooks' });
}, { prefix: '/api' });

// ── SuperAdmin Routes ─────────────────────────────────────────────────────
await app.register(async (sa) => {
  await sa.register(superadminAuthRoutes, { prefix: '/auth' });
  await sa.register(superadminTenantsRoutes, { prefix: '/tenants' });
  await sa.register(superadminPlansRoutes, { prefix: '/plans' });
  await sa.register(superadminDemosRoutes, { prefix: '/demos' });
  await sa.register(superadminResellersRoutes, { prefix: '/resellers' });
  await sa.register(superadminDashboardRoutes, { prefix: '/dashboard' });
  await sa.register(superadminMonitorRoutes, { prefix: '/monitor' });
  await sa.register(superadminAuditRoutes, { prefix: '/audit' });
}, { prefix: '/api/superadmin' });

// ── Start ─────────────────────────────────────────────────────────────────
const start = async (): Promise<void> => {
  try {
    app.log.info('Running database migrations...');
    await runMigrations();
    await app.listen({ port: PORT, host: HOST });
    startInstagramPoller();
    startTikTokScraper();
    startCampaignSender();
    startDemoExpiryJob();
    startReminderJob();
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

const stop = async (): Promise<void> => {
  await stopInstagramPoller();
  await stopTikTokScraper();
  await stopCampaignSender();
  await stopDemoExpiryJob();
  await stopReminderJob();
  await app.close();
};

process.on('SIGTERM', () => { stop().catch(() => process.exit(1)); });
process.on('SIGINT', () => { stop().catch(() => process.exit(1)); });

await start();
