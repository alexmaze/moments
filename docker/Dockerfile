# ─── Stage 1: Install dependencies ───────────────────────────────────────────
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json     ./packages/db/
COPY apps/web/package.json        ./apps/web/
COPY apps/server/package.json     ./apps/server/

RUN pnpm install --frozen-lockfile

# ─── Stage 2: Build all packages ─────────────────────────────────────────────
FROM deps AS builder
COPY . .
RUN pnpm turbo run build

# ─── Stage 3: Production runtime ─────────────────────────────────────────────
FROM node:22-alpine AS runner

# Install ffmpeg for video thumbnail extraction
RUN apk add --no-cache ffmpeg

RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app

# Copy server build output
COPY --from=builder /app/apps/server/dist        ./dist
COPY --from=builder /app/apps/server/package.json ./package.json

# Copy workspace package builds (needed at runtime by server)
COPY --from=builder /app/packages/db/dist         ./node_modules/@moments/db/dist
COPY --from=builder /app/packages/db/package.json  ./node_modules/@moments/db/package.json
COPY --from=builder /app/packages/shared/dist         ./node_modules/@moments/shared/dist
COPY --from=builder /app/packages/shared/package.json  ./node_modules/@moments/shared/package.json

# Copy node_modules (production deps)
COPY --from=builder /app/node_modules             ./node_modules

# Copy frontend build as public directory (served by NestJS)
COPY --from=builder /app/apps/web/dist            ./public

# Uploads volume mount point
RUN mkdir -p /app/uploads

EXPOSE 3000
ENV NODE_ENV=production

CMD ["node", "dist/main.js"]
