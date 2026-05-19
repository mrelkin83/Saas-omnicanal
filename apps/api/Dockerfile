##
## Stage 1 — install all dependencies and build
##
FROM node:22-alpine AS builder
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && \
    apk add --no-cache python3 make g++

WORKDIR /monorepo

# Copy workspace manifests first (layer-cache friendly)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/db/package.json packages/db/tsconfig.json packages/db/
COPY packages/shared/package.json packages/shared/tsconfig.json packages/shared/
COPY apps/api/package.json apps/api/tsconfig.json apps/api/

# Install all (including devDeps needed to build)
RUN pnpm install --frozen-lockfile

# Copy source and build workspace packages + API
COPY packages/shared/src packages/shared/src
COPY packages/db/src packages/db/src
COPY apps/api/src apps/api/src

RUN pnpm --filter @saas/shared build && \
    pnpm --filter @saas/db build && \
    pnpm --filter @app/api build

# Deploy produces a self-contained dir with only production node_modules
RUN pnpm --filter @app/api deploy --prod --legacy /deploy/api

##
## Stage 2 — minimal production image
##
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && \
    adduser  -S nodejs -u 1001

# Compiled API
COPY --from=builder --chown=nodejs:nodejs /monorepo/apps/api/dist ./dist

# Production node_modules (workspace packages bundled by pnpm deploy)
COPY --from=builder --chown=nodejs:nodejs /deploy/api/node_modules ./node_modules

USER nodejs
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "dist/server.js"]
