import './env.js';
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

// ── Plugins (order matters) ────────────────────────────────────────────────
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
}, { prefix: '/api' });

// ── Start ─────────────────────────────────────────────────────────────────
const start = async (): Promise<void> => {
  try {
    await app.listen({ port: PORT, host: HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

await start();
