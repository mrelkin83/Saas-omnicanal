##
## Stage 1 — install and build
##
FROM node:22-alpine AS builder
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable

WORKDIR /monorepo

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json packages/shared/
COPY apps/web/package.json apps/web/

RUN pnpm install --frozen-lockfile

COPY packages/shared/src packages/shared/src
COPY apps/web apps/web

# Build shared package first
RUN pnpm --filter @saas/shared build

# Build Next.js (uses output: 'standalone' from next.config.mjs)
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN pnpm --filter @app/web build

##
## Stage 2 — minimal production image
##
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -g 1001 -S nodejs && \
    adduser  -S nodejs -u 1001

# Standalone server bundle (includes its own node_modules)
COPY --from=builder --chown=nodejs:nodejs /monorepo/apps/web/.next/standalone ./
# Static files
COPY --from=builder --chown=nodejs:nodejs /monorepo/apps/web/.next/static ./apps/web/.next/static
# Public assets
COPY --from=builder --chown=nodejs:nodejs /monorepo/apps/web/public ./apps/web/public

USER nodejs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["node", "apps/web/server.js"]
