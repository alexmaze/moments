# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Moments (近况)** is an open-source, self-hostable private social circle platform for sharing status updates. Core features: multi-account support, text/image/video mixed posts, likes, and comments. Designed to be lightweight, easy to self-deploy, and extensible for future AI-powered features (summarization, content analysis, relationship insights).

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 8 + Tailwind CSS v4 + TanStack Query v5 |
| Backend | NestJS 11 + Drizzle ORM + PostgreSQL 16 |
| Auth | JWT (Passport.js — local + JWT strategies) |
| Media | Local filesystem storage + sharp (images) + ffmpeg (video thumbnails) |
| Shared | Zod validators, TypeScript types |
| Monorepo | pnpm workspaces + Turborepo 2 |
| Deployment | Docker multi-stage single container (NestJS serves the SPA + API) |

## Monorepo Structure

```
moments/
├── apps/
│   ├── web/          # @moments/web   — React SPA (Vite, port 5173 in dev)
│   └── server/       # @moments/server — NestJS API (port 3000)
├── packages/
│   ├── shared/       # @moments/shared — Zod schemas + shared TS types (no runtime deps except zod)
│   └── db/           # @moments/db     — Drizzle schema, migrations, DB client factory
├── docs/             # Architecture, API, DB, development, deployment, PRD docs
├── docker/           # Dockerfile (multi-stage) + docker-compose.prod.yml
├── docker-compose.yml # Dev: starts only `db` service (PostgreSQL 16)
├── .env.example      # Environment variable reference
├── turbo.json        # Turborepo pipeline config
├── tsconfig.base.json # Shared TS compiler base
└── pnpm-workspace.yaml
```

**Package dependency chain:**
```
@moments/shared  (no internal deps)
       ↑
@moments/db      (depends on shared)
       ↑
@moments/server  (depends on shared + db)
@moments/web     (depends on shared only; proxies to server at runtime)
```
Turborepo respects this order automatically: shared → db → server/web (parallel).

## Commands

### Root-level (run from repo root)

```bash
pnpm install           # Install all workspace deps
pnpm dev               # Start all dev servers (Turborepo parallel)
pnpm build             # Build all packages in dependency order
pnpm lint              # Type-check all packages (tsc --noEmit)

pnpm db:generate       # Generate Drizzle migration SQL from schema changes
pnpm db:migrate        # Apply pending migrations to the database
pnpm db:studio         # Open Drizzle Studio (web-based DB browser)
```

### Per-package (filter syntax)

```bash
pnpm --filter @moments/server dev    # Backend only
pnpm --filter @moments/web dev       # Frontend only
pnpm --filter @moments/server lint   # Type-check server only
```

### Database (dev environment)

```bash
docker compose up db -d   # Start PostgreSQL 16 container (port 5432)
pnpm db:migrate            # Run migrations after starting DB
```

### Production Docker

```bash
cd docker
export JWT_SECRET="..." DB_PASSWORD="..." BASE_URL="https://your-domain.com"
docker compose -f docker-compose.prod.yml up -d --build
```

## Environment Variables

Copy `.env.example` to `.env` at repo root. The server reads from `.env` and `../../.env`.

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | yes | `postgresql://moments:moments_dev@localhost:5432/moments` | Postgres connection string |
| `JWT_SECRET` | yes | — | Min 32 chars |
| `BASE_URL` | no | `http://localhost:3000` | Used to build media public URLs |
| `UPLOAD_DIR` | no | `./uploads` | Local media storage directory |
| `PORT` | no | `3000` | NestJS port |
| `NODE_ENV` | no | `development` | Set to `production` to enable SPA fallback serving |

## Architecture: Backend (`apps/server`)

### NestJS module layout (`src/`)

```
src/
├── main.ts                    # Bootstrap: global prefix /api, ValidationPipe, static file serving
├── app.module.ts              # Root module; registers global JwtAuthGuard as APP_GUARD
├── database/
│   └── database.module.ts     # Global module; provides DRIZZLE token (DrizzleClient)
├── common/
│   ├── decorators/
│   │   ├── current-user.decorator.ts   # @CurrentUser() — extracts JWT payload from request
│   │   └── public.decorator.ts         # @Public() — marks route as unauthenticated
│   ├── filters/               # (placeholder)
│   ├── guards/                # (placeholder)
│   ├── interceptors/          # (placeholder)
│   └── pipes/                 # (placeholder)
└── modules/
    ├── auth/                  # Register, login (local strategy), JWT validation, /auth/me
    ├── posts/                 # CRUD feed posts; cursor-based pagination
    ├── likes/                 # Toggle like on a post
    ├── comments/              # Comments on posts; page-based pagination
    ├── media/                 # File upload (images + videos); storage abstraction
    └── users/                 # User profile, update profile, user posts
```

### Auth pattern
- **Global JWT guard** applied to all routes via `APP_GUARD`. Use `@Public()` decorator to opt out.
- `@CurrentUser()` decorator injects the JWT payload (`{ id, username }`) into handlers.
- Passwords hashed with bcrypt (12 rounds). JWT tokens are stateless (no refresh tokens in MVP).

### Database access pattern
- Drizzle client injected via `@Inject(DRIZZLE)` using the `DRIZZLE` Symbol token.
- **No Drizzle relations API used for queries** — services do explicit batch loading and assembly (see `PostsService.enrichPosts()`). Relations in schema are defined for documentation/type purposes.
- Soft deletes on posts and comments (`isDeleted` flag + `deletedAt`).
- Like/comment counts are denormalized columns on the `posts` table, updated in-place.

### Media upload flow
1. Multer accepts file in memory buffer.
2. MIME type validated against allowlist (jpeg/png/webp/gif, mp4/mov/webm).
3. File saved via `IStorageProvider` (currently `LocalStorageProvider`).
4. For images: sharp extracts dimensions.
5. For videos: ffmpeg extracts dimensions, duration, and first-frame cover image.
6. `mediaAssets` DB record created with `status: 'pending'`.
7. When post is created, media IDs are verified (owned by author + pending status), then marked `status: 'attached'`.
8. Storage is abstracted via `IStorageProvider` interface — inject `STORAGE_PROVIDER` token to swap backends.

### API routing
- All API routes prefixed `/api` (set in `main.ts`).
- In production (`NODE_ENV=production`), NestJS also serves the frontend SPA from `dist/../public` with a catch-all fallback for client-side routing.

## Architecture: Frontend (`apps/web`)

### Directory layout (`src/`)

```
src/
├── main.tsx          # React root; wraps app in QueryClientProvider + BrowserRouter
├── App.tsx           # Route tree (react-router-dom v7)
├── index.css         # Tailwind CSS v4 global styles
├── api/
│   ├── client.ts     # Axios instance; auto-injects Bearer token; handles 401 → clearAuth
│   ├── auth.api.ts
│   ├── posts.api.ts
│   ├── media.api.ts
│   └── users.api.ts
├── store/
│   └── auth.store.ts # Zustand store (persisted to localStorage as "moments-auth")
├── hooks/
│   ├── useAuth.ts        # useLogin, useRegister, useLogout
│   ├── usePosts.ts       # TanStack Query hooks for feed/post CRUD
│   ├── useComments.ts    # TanStack Query hooks for comments
│   └── useMediaUpload.ts # Parallel upload state machine with progress tracking
├── components/
│   ├── layout/       # AppLayout, GuestLayout, AuthGuard
│   ├── feed/         # FeedList, PostCard, MediaGrid
│   ├── post/         # PostDetail, CommentSection, CommentInput, CommentItem
│   ├── composer/     # PostComposer, MediaUploader
│   └── profile/      # ProfileHeader
├── pages/            # LoginPage, RegisterPage, FeedPage, PostDetailPage, ProfilePage, NotFoundPage
├── types/
│   └── dto.ts        # Frontend TS interfaces mirroring API response shapes
└── lib/              # Utility helpers
```

### State management
- **Server state**: TanStack Query (staleTime 60s, no refetch-on-focus, retry 1).
- **Auth state**: Zustand with `persist` middleware → `localStorage` key `moments-auth`.
- **Media upload state**: local `useState` inside `useMediaUpload` hook.

### Routing structure
- Guest routes (`/login`, `/register`) wrapped in `GuestLayout`.
- Authenticated routes (`/`, `/posts/:id`, `/users/:username`) wrapped in `AuthGuard` → `AppLayout`.
- Path alias `@/` maps to `src/` (configured in both Vite and tsconfig).

### Dev proxy
Vite proxies `/api` and `/uploads` to `http://localhost:3000` — no CORS config needed during development.

## Database Schema (`packages/db/src/schema/`)

| Table | Purpose |
|---|---|
| `users` | Accounts: username (unique), displayName, passwordHash, avatarUrl, bio, isActive |
| `media_assets` | Uploaded files: type (image/video), status (pending/attached/orphaned), storagePath, publicUrl, dimensions, duration, coverPath/URL |
| `posts` | Posts: authorId, content (nullable), likeCount, commentCount, soft-delete flags |
| `post_media_relations` | Many-to-many posts ↔ media_assets with sortOrder |
| `post_likes` | Unique (postId, userId) pair |
| `post_comments` | Comments with soft-delete |
| `event_log` | Audit log: eventType, entityType, entityId, payload, ipAddress, userAgent |

Migrations live in `packages/db/src/migrations/`. Schema source of truth is `packages/db/src/schema/`.

**Migration workflow** (always do this after schema changes):
```bash
pnpm db:generate   # creates new SQL file in packages/db/src/migrations/
pnpm db:migrate    # applies it to the database
```

## Shared Package (`packages/shared/src/`)

- **`types/`**: `UserDto`, `PostDto`, `MediaDto` etc. — used by both server responses and frontend.
- **`validators/`**: Zod schemas (`loginSchema`, `registerSchema`, `createPostSchema`, `createCommentSchema`) — used by both the NestJS DTOs (via class-validator) and frontend form validation.

## Key Patterns & Conventions

### TypeScript
- Strict mode everywhere (`strict: true`, `noUnusedLocals`, `noUnusedParameters` on frontend).
- Server uses `CommonJS` + `emitDecoratorMetadata` + `experimentalDecorators` (required for NestJS DI).
- Frontend uses `ESNext` modules with `bundler` resolution (Vite handles imports).
- Lint = `tsc --noEmit` (no ESLint on server; ESLint only on frontend via `eslint.config.js`).

### NestJS conventions
- Services inject `DRIZZLE` (Symbol) — not the `DatabaseModule` class — for the Drizzle client.
- `STORAGE_PROVIDER` (Symbol) is similarly injected in `MediaService` for swappable storage.
- DTOs use `class-validator` decorators; `ValidationPipe` with `whitelist: true, forbidNonWhitelisted: true` strips unknown fields.
- No Swagger/OpenAPI setup (see `docs/api.md` for manual API docs).

### Feed pagination
- Posts feed uses **cursor-based pagination** (ISO timestamp cursor from `createdAt`).
- Comments use **page-based pagination** (`page` + `pageSize`).

### Media upload (two-phase)
1. Upload file → get `mediaId` (status: `pending`)
2. Create post with `mediaIds` array → server atomically attaches and marks `attached`

This means orphaned uploads (status `pending`) can accumulate and need periodic cleanup.

### No test suite
The `apps/server/test/` directory is empty. There are no automated tests. Rely on TypeScript type checking and manual testing.

### 文档维护要求
任何代码变更（新增功能、修改接口、调整架构、变更配置等）完成后，必须同步更新相关文档，包括但不限于：
- `docs/` 目录下的架构、API、数据库、部署等文档
- `CLAUDE.md`（如涉及架构、命令、模式等变化）
- `README.md`（如涉及用户可见的功能或使用方式变化）
- `.env.example`（如新增或变更环境变量）

## Docker / Production

- **Single container** architecture: one NestJS process serves API + static frontend + media files.
- Multi-stage Dockerfile: `deps` → `builder` → `runner` (node:22-alpine + ffmpeg).
- Two volumes: `postgres_data` (database) and `uploads_data` (media files).
- `BASE_URL` env var controls the hostname embedded in media `publicUrl` fields — must match the public-facing URL.
