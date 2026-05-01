# ─── Stage 1: Install dependencies ───────────────────────────────────────────
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10 --activate
ENV CI=true
WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/config/package.json ./packages/config/
COPY packages/db/package.json     ./packages/db/
COPY apps/web/package.json        ./apps/web/
COPY apps/server/package.json     ./apps/server/

# Hoist all packages to root node_modules (flat layout, no symlinks)
# This is Docker-only; dev environment still uses default pnpm isolation
RUN echo "shamefully-hoist=true" > .npmrc && pnpm install --frozen-lockfile

# ─── Stage 2: Build all packages ─────────────────────────────────────────────
FROM deps AS builder

ARG APP_VERSION=dev
ENV CI=true
ENV APP_VERSION=${APP_VERSION}

COPY . .
# Preserve the .npmrc we created (source COPY would overwrite it)
RUN echo "shamefully-hoist=true" > .npmrc
# Pass APP_VERSION explicitly to ensure Docker cache invalidation on version change
RUN APP_VERSION=${APP_VERSION} pnpm install --frozen-lockfile && pnpm turbo run build

# ─── Stage 3: Production runtime ─────────────────────────────────────────────
FROM node:22-alpine AS runner

ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION}

# Install ffmpeg for video thumbnail extraction
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy server build output
COPY --from=builder /app/apps/server/dist        ./dist
COPY --from=builder /app/apps/server/package.json ./package.json

# Copy node_modules (all deps hoisted to root thanks to shamefully-hoist)
COPY --from=builder /app/node_modules             ./node_modules

# Copy workspace package builds (needed at runtime by server)
COPY --from=builder /app/packages/config/dist        ./node_modules/@moments/config/dist
COPY --from=builder /app/packages/config/package.json ./node_modules/@moments/config/package.json
COPY --from=builder /app/packages/db/dist         ./node_modules/@moments/db/dist
COPY --from=builder /app/packages/db/package.json  ./node_modules/@moments/db/package.json
COPY --from=builder /app/packages/db/src/migrations ./node_modules/@moments/db/dist/migrations
COPY --from=builder /app/packages/shared/dist         ./node_modules/@moments/shared/dist
COPY --from=builder /app/packages/shared/package.json  ./node_modules/@moments/shared/package.json

# Copy frontend build as public directory (served by NestJS)
COPY --from=builder /app/apps/web/dist            ./public

# config.yaml is volume-mounted at runtime (not baked into the image)

EXPOSE 3000
ENV NODE_ENV=production

CMD ["node", "dist/main.js"]
