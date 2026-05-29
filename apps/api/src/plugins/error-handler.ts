import type { FastifyPluginAsync, FastifyError } from 'fastify';
import fp from 'fastify-plugin';
import { ZodError } from 'zod';

const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error instanceof ZodError) {
      const isProd = process.env.NODE_ENV === 'production';
      return reply.status(400).send({
        error: 'Validation Error',
        message: isProd ? 'Invalid input' : error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        code: 'VALIDATION_ERROR',
      });
    }

    const status = error.statusCode ?? 500;

    if (status === 401) {
      return reply.status(401).send({ error: 'Unauthorized', message: error.message, code: 'UNAUTHORIZED' });
    }
    if (status === 403) {
      return reply.status(403).send({ error: 'Forbidden', message: error.message, code: 'FORBIDDEN' });
    }
    if (status === 404) {
      return reply.status(404).send({ error: 'Not Found', message: error.message, code: 'NOT_FOUND' });
    }
    if (status < 500) {
      return reply.status(status).send({ error: error.name ?? 'Bad Request', message: error.message, code: 'CLIENT_ERROR' });
    }

    fastify.log.error(error);
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
    });
  });
};

export default fp(errorHandlerPlugin, { name: 'error-handler' });
