import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import fastifyHelmet from '@fastify/helmet';

const helmetPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
      },
    },
  });
};

export default fp(helmetPlugin, { name: 'helmet' });
