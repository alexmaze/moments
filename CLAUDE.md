# CLAUDE.md

## Project Overview

**Moments (近况)** — open-source, self-hostable private social circle. Features: multi-account, text/image/video posts, single-audio attachments, likes, comments. Lightweight, extensible for AI features.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 8 + Tailwind CSS v4 + TanStack Query v5 |
| UI Components | Radix UI + Sonner + yet-another-react-lightbox + Lexical |
| Rich Text Editor | Lexical + lexical-beautiful-mentions (atomic mention/tag nodes) |
| Backend | NestJS 11 + Drizzle ORM + PostgreSQL 16 |
| Auth | JWT (Passport.js — local + JWT strategies) |
| Media | sharp (images) + ffmpeg (video thumbnails) + Tencent COS |
| Shared | Zod validators, TypeScript types |
| Monorepo | pnpm workspaces + Turborepo 2 |
| Deployment | Docker multi-stage single container (NestJS serves SPA + API) |

## Monorepo Structure

```
moments/
├── apps/
│   ├── web/          # @moments/web   — React SPA (Vite, port 5173 in dev) — includes admin pages at /admin/*
│   └── server/       # @moments/server — NestJS API (port 3000)
├── packages/
│   ├── shared/       # @moments/shared — Zod schemas + shared TS types (no runtime deps except zod)
│   ├── config/       # @moments/config — YAML config loader + typed config interfaces
│   └── db/           # @moments/db     — Drizzle schema, migrations, DB client factory
├── config.yaml              # Real config (gitignored, contains secrets)
├── config.example.yaml      # Template (committed)
├── docs/             # Architecture, API, DB, development, deployment, PRD docs
├── docker/           # Dockerfile (multi-stage) + docker-compose.prod.yml
├── docker-compose.yml # Dev: starts only `db` service (PostgreSQL 16)
├── turbo.json        # Turborepo pipeline config
├── tsconfig.base.json # Shared TS compiler base
└── pnpm-workspace.yaml
```

**Dependency chain:** `shared → config → db → server/web` (Turborepo auto-resolves)

## Commands

```bash
pnpm install           # Install all workspace deps
pnpm dev               # Start all dev servers (Turborepo parallel)
pnpm build             # Build all packages in dependency order
pnpm lint              # Type-check all packages (tsc --noEmit)

pnpm db:generate       # Generate Drizzle migration SQL from schema changes
pnpm db:migrate        # Apply pending migrations to the database
pnpm db:studio         # Open Drizzle Studio (web-based DB browser)
```

```bash
pnpm --filter @moments/server dev    # Backend only
pnpm --filter @moments/web dev       # Frontend only
pnpm --filter @moments/server lint   # Type-check server only
```

```bash
docker compose up db -d   # Start PostgreSQL 16 container (port 5432)
pnpm db:migrate            # Run migrations after starting DB
```

## Configuration

All configuration lives in a single YAML file: `config.yaml` (gitignored). Copy from template:

```bash
cp config.example.yaml config.yaml
```

`@moments/config` package (`packages/config/`) loads, validates, and exports the typed config. Server uses NestJS `ConfigModule` with a `load:` factory; `drizzle.config.ts` calls `loadConfig()` directly.

### Config structure (`config.yaml`)

```yaml
app:
  port: 3000
  nodeEnv: development          # development | production | test

database:
  url: postgresql://moments:moments_dev@localhost:5432/moments

auth:
  jwtSecret: <min 32 chars>
  adminUsernames:               # YAML list, case-insensitive
    - admin

storage:
  driver: tencent-cos
  signedUrlTtlSeconds: 604800
  keyPrefix: moments
  ci:                           # 数据万象 — set enabled: true to activate
    enabled: false
    feedImage: "imageMogr2/..."
    feedCover: "imageMogr2/..."
    smallThumb: "imageMogr2/..."
    avatar: "imageMogr2/..."
    spaceCover: "imageMogr2/..."
  tencentCos:
    secretId: <COS secret ID>
    secretKey: <COS secret key>
    region: ap-shanghai
    bucket: <bucket name>
    useHttps: true
    timeoutMs: 30000

media:
  cleanup:
    enabled: true
    dryRun: false
    retentionDays: 7
    pendingMaxAgeHours: 24
    batchSize: 100
```

## Architecture: Backend (`apps/server`)

### Key patterns (constraints)
- Global JWT guard via `APP_GUARD`. Use `@Public()` to opt out individual routes.
- Inject `DRIZZLE` (Symbol) for DB client, `STORAGE_PROVIDER` (Symbol) for storage. Never inject module classes directly.
- **No Drizzle relations API for queries** — use explicit batch loading (see `PostsService.enrichPosts()`). Relations in schema for types only.
- Soft deletes: `isDeleted` + `deletedAt` on posts/comments. Never hard-delete user content.
- Denormalized `likeCount`/`commentCount` on `posts` table — update in-place.
- DTOs: `class-validator` decorators. `ValidationPipe` with `whitelist: true, forbidNonWhitelisted: true`.
- Admin: `@AdminOnly()` decorator. Routes under `/api/admin`. Checks `auth.adminUsernames` config (case-insensitive).
- Registration toggle: `system_settings` table key `registration_open`.
- All routes prefixed `/api`. Production serves SPA with catch-all fallback.

### Media upload (two-phase — constraint)
1. Upload → `mediaId` (status: `pending`)
2. Create post with `mediaIds` → server verifies ownership + pending status, marks `attached`

Orphaned `pending` uploads need periodic cleanup.

### CI thumbnails (数据万象)
- Optional: `storage.ci.enabled` in `config.yaml`. Signed URLs with CI params co-signed into HMAC.
- `MediaAssetDto.thumbnailUrl: string | null` — `null` when disabled. Frontend: `item.thumbnailUrl ?? item.publicUrl`.
- Scenarios configurable in `config.yaml`: `feedImage`, `feedCover`, `smallThumb`, `avatar`, `spaceCover`.

## Architecture: Frontend (`apps/web`)

### Key constraints
- **State**: TanStack Query for server state. Zustand + persist for auth/locale/theme/background (each has own localStorage key).
- **Path alias**: `@/` → `src/`
- **Dev proxy**: Vite proxies `/api` to `http://localhost:3000`
- **Icons**: `lucide-react` only. No inline `<svg>`.
- **Modals**: Radix UI Dialog/AlertDialog only. Never `window.confirm()`/`window.alert()`.
- **Toasts**: `sonner` module-level `toast()`. Convention: success for create/delete, error for failures.
- **Post creation**: QuickComposer is sole entry point (no FAB/separate page).
- **RichTextEditor**: Lexical + `lexical-beautiful-mentions`. Mentions serialize as `@{displayName|userId}`. Tags as `#tagName`.
- **Lightbox**: Global singleton `MediaLightboxProvider` in AppLayout. All PostCards share via Context.
- **Media Grid**: `variant: 'feed'|'detail'`. Feed truncates at 9 items with `+N` badge; detail shows all.

### Scroll architecture (critical constraint)
Internal container scrolling, NOT page-level. Only `<main>` scrolls.

- `html`+`body`: `height:100%; overflow:hidden; position:fixed; inset:0` (iOS Safari rubber-band fix).
- AppLayout: `h-screen flex flex-col overflow-hidden`. Header shrink-0, main flex-1 overflow-y-auto, nav fixed.
- **CRITICAL**: IntersectionObserver callers MUST use `{ root: scrollRoot }` from `ScrollContainerContext`. Default `root:null` is broken with container scroll — observers silently stop firing.

### Design System (constraints for consistency)
- **Theme**: Warm amber. Brand `--primary: 24 80% 50%`. Like color `--like: hsl(5, 85%, 57%)`.
- **Tokens**: shadcn/ui-style HSL CSS vars split across `src/styles/` (`tokens.css`, `theme-bridge.css`, `animations.css`, `scrollbars.css`, `surfaces.css`, `lightbox.css`), composed via `index.css` imports. All styling via Tailwind utilities consuming tokens.
- **Surfaces**: Three glassmorphism levels (`surface-card`, `surface-overlay`, `surface-toast`) in CSS tokens. Don't hardcode alpha/blur values.
- **Dark mode**: 3 options (Light/Dark/System). FOUT prevention via inline `<head>` script. Synced from DB on login.
- **Custom background**: texture presets in `lib/backgroundPresets.ts`. Rendered as fixed -z-10 layer inside AppLayout's `relative isolate` root.
- **Hardcoded `bg-black/*` overlays**: Intentional on media thumbs, avatar hovers, dialog backdrops — must darken arbitrary user content.
- **Radius**: Cards `rounded-xl`, buttons `rounded-lg`, avatars `rounded-full`.
- **Fonts**: System font stack only; do not load external font CDNs.

## Database Schema (`packages/db/src/schema/`)

| Table | Purpose |
|---|---|
| `users` | username (unique), displayName, passwordHash, avatarUrl, bio, locale, theme, background, isActive |
| `media_assets` | type (image/video/audio), status (pending/attached/orphaned), storageProvider, bucket, objectKey, dimensions, duration, coverPath |
| `posts` | authorId, content, spaceId (nullable), audioMediaId (optional), likeCount, commentCount, soft-delete |
| `post_media_relations` | posts ↔ media_assets M2M with sortOrder |
| `post_likes` | Unique (postId, userId) |
| `post_comments` | Comments with soft-delete, reply_to_id FK |
| `spaces` | name, slug (unique), type (general/baby), creatorId, memberCount, postCount, soft-delete |
| `space_members` | spaceId + userId (unique), role (owner/admin/member) |
| `growth_records` | Baby space: spaceId, date, heightCm, weightKg, headCircumferenceCm |
| `tags` | name (original case), nameLower (UNIQUE), postCount (denormalized) |
| `post_tags` | Composite PK (postId, tagId) |
| `mentions` | postId/commentId, mentionedUserId |
| `event_log` | Audit: eventType, entityType, entityId, payload |
| `system_settings` | Key-value (e.g., `registration_open`) |

**Migration workflow** (after schema changes):
```bash
pnpm db:generate   # creates new SQL file in packages/db/src/migrations/
pnpm db:migrate    # applies it to the database
```
**CRITICAL: All migration SQL MUST be idempotent** — use `IF NOT EXISTS` / `IF EXISTS` guards on every DDL statement. App applies migrations on every startup; non-idempotent SQL crashes server on restart.

## Shared Package (`packages/shared/src/`)

- **`types/`**: `UserDto`, `PostDto`, `MediaDto` — used by server + frontend.
- **`validators/`**: Zod schemas — used by NestJS DTOs + frontend forms.

## Key Domain Logic

### Hashtags
- Parsing: `packages/shared/src/utils/hashtag.ts`. Regex: `/\B#([\p{L}\p{N}_]{1,50})(?=\s|$|[^\p{L}\p{N}_])/gu`
- Case: `name` stores original, `nameLower` (UNIQUE) for dedup. First occurrence's case preserved.
- Create/delete: in-transaction upsert/decrement `postCount`.

### @Mentions
- Format: `@{displayName|userId}` — pipe-delimited with UUID.
- Parsing: `packages/shared/src/utils/mention.ts`. Regex: `/@\{(.+)\|([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\}/gi`
- Display name: snapshot at mention time. No auto-update on name change.

### Spaces
- Types: `general`, `baby` (growth records). Public browse, members-only post/comment/like. Owner cannot leave.
- Deletion: only owner can delete. Deleting a space soft-deletes the space, removes members/growth records, clears cover media for orphan cleanup, and keeps existing posts as regular feed posts by setting `posts.spaceId = null`.
- API: `GET /spaces/my` defined before `:slug` (route collision avoidance).
- LikesService/CommentsService verify membership for space posts.

### Feed pagination
- Posts: cursor-based (ISO timestamp from `createdAt`)
- Comments: page-based
- Feed embeds first 10 comments per post (`hasMoreComments` flag)

## Internationalization (i18n)

- `react-i18next` + `i18next`. Locales: `en`, `zh-CN`.
- Files: `apps/web/src/i18n/locales/{en,zh-CN}/*.json`
- Namespaces: `common`, `auth`, `feed`, `post`, `profile`, `spaces`, `tags`
- DB `users.locale` synced on login.

## Admin (`/admin/*`)

- `auth.adminUsernames` config. `@AdminOnly()` backend guard. `AdminGuard` frontend redirect.
- Pages: Dashboard (stats), Users (ban/unban), Posts (force delete), Settings (registration toggle).
- `GET /api/admin/stats`: users, posts, comments, likes, storage (COS ListObjects with 10-min cache, fallback to DB SUM; returns `totalBytes` + `objectCount`), DB size.

## Docker / Production

- Single container: NestJS serves API + SPA.
- Multi-stage: deps → builder → runner (node:22-alpine + ffmpeg).
- Config: `config.yaml` volume-mounted read-only into `/app/config.yaml`.
- Media: signed COS URLs returned by API (no local `/uploads` serving).

## 文档维护要求
代码变更后必须同步更新：
- `docs/` (架构、API、DB、部署)
- `CLAUDE.md` (架构/命令/模式变化)
- `README.md` (用户可见功能变化)
- `config.example.yaml` (新增/变更配置项)

## TODO 工作流

`TODO.md` 为任务跟踪文件：

### 记录想法
用户提到想法/需求/bug → 追加到 `TODO.md` 对应优先级：
- 格式：`- [ ] 描述 #tag` (tag: `#feature` `#bug` `#infra` `#ui` `#refactor` `#docs`)
- 未指定优先级 → 判断后确认

### 启动任务
用户说「做下一个 TODO」「继续」等：
1. 读 `TODO.md`，取最高优先级(P0>P1>P2>P3)最靠前未完成项
2. 确认任务 → Plan → 实现
3. 完成后移到 `## Done`，标 `- [x]` + 完成日期

### 注意
- 添加/修改后无需 commit（除非明确要求）
- 开始前先 Read 确认最新状态
- 模糊 TODO 先澄清再开始
