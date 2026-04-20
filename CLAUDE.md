# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Moments (近况)** is an open-source, self-hostable private social circle platform for sharing status updates. Core features: multi-account support, text/image/video mixed posts, likes, and comments. Designed to be lightweight, easy to self-deploy, and extensible for future AI-powered features (summarization, content analysis, relationship insights).

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 8 + Tailwind CSS v4 + TanStack Query v5 |
| UI Components | Radix UI (Dialog, AlertDialog) + Sonner (toast notifications) + lightGallery (media lightbox) |
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
    ├── users/                 # User profile, update profile, user posts
    └── spaces/                # Public spaces: CRUD, membership, growth records (baby spaces)
```

### Auth pattern
- **Global JWT guard** applied to all routes via `APP_GUARD`. Use `@Public()` decorator to opt out.
- `@CurrentUser()` decorator injects the JWT payload (`{ id, username }`) into handlers.
- Passwords hashed with bcrypt (12 rounds). JWT tokens are stateless (no refresh tokens in MVP).

### Database access pattern
- Drizzle client injected via `@Inject(DRIZZLE)` using the `DRIZZLE` Symbol token.
- **No Drizzle relations API used for queries** — services do explicit batch loading and assembly (see `PostsService.enrichPosts()` which batch-loads authors, media, likes, and comment previews in parallel). Relations in schema are defined for documentation/type purposes.
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
├── index.css         # Tailwind CSS v4 global styles + design tokens + warm amber theme
├── i18n/
│   ├── index.ts      # i18next initialization (static bundle, no lazy loading)
│   ├── zod-error-map.ts # Custom Zod error map with i18n translations
│   ├── i18next.d.ts  # TypeScript type augmentation for translation keys
│   └── locales/      # {en,zh-CN}/{common,auth,feed,post,profile,spaces}.json
├── api/
│   ├── client.ts     # Axios instance; auto-injects Bearer token; handles 401 → clearAuth
│   ├── auth.api.ts
│   ├── posts.api.ts
│   ├── media.api.ts
│   ├── users.api.ts
│   ├── spaces.api.ts
│   └── background.api.ts
├── store/
│   ├── auth.store.ts # Zustand store (persisted to localStorage as "moments-auth")
│   ├── locale.store.ts # Locale preference store (persisted as "moments-locale")
│   ├── theme.store.ts # Theme preference store (persisted as "moments-theme")
│   └── background.store.ts # Background preference store (persisted as "moments-background")
├── hooks/
│   ├── useAuth.ts        # useLogin, useRegister, useLogout
│   ├── usePosts.ts       # TanStack Query hooks for feed/post CRUD
│   ├── useComments.ts    # TanStack Query hooks for comments
│   ├── useSpaces.ts      # TanStack Query hooks for spaces CRUD, membership
│   ├── useGrowthRecords.ts # TanStack Query hooks for baby space growth records
│   └── useMediaUpload.ts # Parallel upload state machine with progress tracking
│       useAvatarUpload.tsx # Avatar upload flow: file pick → crop → resize → upload
│       useTheme.ts       # Dark mode: toggles .dark class on <html>, listens to prefers-color-scheme
│       useBackground.ts  # Custom background: reads store + theme, resolves texture preset → CSSProperties
│       useBackgroundUpload.ts # Background image upload flow
├── components/
│   ├── ui/           # Reusable UI primitives: Dialog, AlertDialog, Toaster (sonner)
│   ├── layout/       # AppLayout, GuestLayout, AuthGuard
│   ├── feed/         # FeedList, PostCard, MediaGrid, MediaLightbox
│   ├── post/         # PostDetail, CommentSection, CommentInput, CommentItem
│   ├── composer/     # QuickComposer, MediaUploader, HighlightTextarea, EmojiPickerPopover, TagSuggestionDropdown
│   └── profile/      # ProfileHeader, EditProfileDialog, AvatarCropDialog, BackgroundPicker
├── pages/            # LoginPage, RegisterPage, FeedPage, PostDetailPage, ProfilePage, NotFoundPage
├── types/
│   └── dto.ts        # Frontend TS interfaces mirroring API response shapes
└── lib/              # Utility helpers (utils, cropImage)
```

### State management
- **Server state**: TanStack Query (staleTime 60s, no refetch-on-focus, retry 1).
- **Auth state**: Zustand with `persist` middleware → `localStorage` key `moments-auth`.
- **Locale state**: Zustand with `persist` middleware → `localStorage` key `moments-locale`. Separate from auth store so locale works before login.
- **Theme state**: Zustand with `persist` middleware → `localStorage` key `moments-theme`. `null` = follow system. Synced from DB on login (same as locale).
- **Background state**: Zustand with `persist` middleware → `localStorage` key `moments-background`. Stores preset ID (e.g. `'texture-linen'`) or `null` (default). Synced from DB on login (same as theme/locale).
- **Media upload state**: local `useState` inside `useMediaUpload` hook.

### Routing structure
- Guest routes (`/login`, `/register`) wrapped in `GuestLayout`.
- Authenticated routes (`/`, `/posts/:id`, `/users/:username`, `/spaces`, `/spaces/:slug`) wrapped in `AuthGuard` → `AppLayout`.
- Path alias `@/` maps to `src/` (configured in both Vite and tsconfig).

### Dev proxy
Vite proxies `/api` and `/uploads` to `http://localhost:3000` — no CORS config needed during development.

## Database Schema (`packages/db/src/schema/`)

| Table | Purpose |
|---|---|
| `users` | Accounts: username (unique), displayName, passwordHash, avatarUrl, bio, locale, theme, background (preset ID), isActive |
| `media_assets` | Uploaded files: type (image/video), status (pending/attached/orphaned), storagePath, publicUrl, dimensions, duration, coverPath/URL |
| `posts` | Posts: authorId, content (nullable), spaceId (nullable FK→spaces), likeCount, commentCount, soft-delete flags |
| `post_media_relations` | Many-to-many posts ↔ media_assets with sortOrder |
| `post_likes` | Unique (postId, userId) pair |
| `post_comments` | Comments with soft-delete |
| `spaces` | Public spaces: name, slug (unique), description, coverUrl, type (general/baby), creatorId, memberCount, postCount, soft-delete |
| `space_members` | Space membership: spaceId + userId (unique pair), role (owner/admin/member), joinedAt |
| `growth_records` | Baby space growth data: spaceId, recordedBy, date, heightCm, weightKg, headCircumferenceCm |
| `tags` | Hashtags: name (original case), nameLower (unique, for case-insensitive lookup), postCount (denormalized) |
| `post_tags` | Many-to-many posts ↔ tags, composite PK (postId, tagId) |
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
- Feed API embeds the first 10 comments per post (`comments` array + `hasMoreComments` flag) to enable inline display without extra requests.

### Quick Composer (快捷发帖入口)
- **Component**: `@/components/composer/QuickComposer.tsx` — inline expandable post composer at the top of the feed.
- **Collapsed state**: Card with current user's avatar + placeholder text + image icon hint. Clicking anywhere expands it.
- **Expanded state**: Avatar + `HighlightTextarea` (with #tag highlighting), MediaUploader below, bottom toolbar: `[Image] [Emoji] [#] [SpaceSelector] — [Submit]`.
- **HighlightTextarea**: Overlay-based textarea with transparent text. An overlay div renders `#hashtags` in amber (`text-primary`). Preserves native textarea behaviors (caret, selection, IME, undo).
- **EmojiPickerPopover**: Portal-based emoji picker using `emoji-picker-react`. Supports search, skin tones, categories, recent emojis. Respects dark/light theme.
- **Toolbar buttons**: Image (file picker), Emoji (toggles picker popover), Hashtag (inserts `#` at cursor, triggers tag suggestion), SpaceSelector (optional, hidden when `fixedSpaceId` prop set).
- **State management**: Local `expanded` state; reuses `useMediaUpload()` and `useCreatePost()` hooks. On successful post, auto-collapses and resets.
- **Click-outside behavior**: Collapses when clicking outside **only if** no content or media has been entered (prevents accidental data loss).
- **Sole entry point**: QuickComposer is the only post creation interface (no FAB, no separate PostComposer).

### Inline comments in feed
- PostCard includes a toggle button to expand/collapse an inline comment section.
- Comments are seeded from the embedded preview data (no initial fetch), with "Load more" button to paginate.
- `usePostComments` hook (based on `useInfiniteQuery`) handles both feed-inline and detail-page contexts.
- Comment create/delete use optimistic updates to avoid resetting the infinite feed scroll.

### Media upload (two-phase)
1. Upload file → get `mediaId` (status: `pending`)
2. Create post with `mediaIds` array → server atomically attaches and marks `attached`

This means orphaned uploads (status `pending`) can accumulate and need periodic cleanup.

### Avatar upload
- **Frontend flow**: File picker → `react-easy-crop` square crop dialog → Canvas API resize to 512×512 JPEG → `POST /api/users/me/avatar` (multipart, 10MB limit)
- **Backend**: Reuses `MediaService.uploadFile()` → stores file → updates `users.avatarUrl` via `UsersService.updateAvatar()`
- **Entry points**: ProfileHeader hover overlay (quick edit) + EditProfileDialog avatar section (both use independent `useAvatarUpload` hook instances)
- **State update**: `uploadAvatarApi` returns updated `UserDto` → `setCurrentUser()` + `invalidateQueries(['userProfile'])` propagates the change everywhere

### No test suite
The `apps/server/test/` directory is empty. There are no automated tests. Rely on TypeScript type checking and manual testing.

### Design System (Visual Theme)
- **Theme**: Warm amber — warm milk-white background, pure white cards, amber/orange brand color (`--primary: 24 80% 50%`), warm gray tones throughout.
- **Token system**: shadcn/ui-style HSL CSS variables in `apps/web/src/index.css` (`:root` for light, `.dark` for dark mode). All UI components consume tokens via Tailwind utility classes.
- **Brand color (primary)**: Amber-orange `hsl(24, 80%, 50%)` — used for buttons, links, FAB, active nav states, focus rings.
- **Like/heart color**: Separate `--like` token (`hsl(5, 85%, 57%)`) — warm red, not reusing `--destructive`. Utility class: `text-like`.
- **Fonts**: Inter (Latin) + Noto Sans SC (Chinese) via Google Fonts CDN (`font-display: swap`). Fallback chain: `system-ui → -apple-system → PingFang SC → Microsoft YaHei → sans-serif`. Loaded in `apps/web/index.html`.
- **Border radius**: Base `--radius: 0.75rem` (12px). Cards use `rounded-xl` (16px), buttons/inputs use `rounded-lg` (12px), avatars use `rounded-full`.
- **Shadows**: Warm-tinted shadows (hue 20° brown instead of cold black) via `--shadow-sm/md/lg` overrides in `@theme inline`.
- **Dark mode**: Full dark mode support with three options: Light / Dark / Follow System (default). CSS variables defined in `.dark` class with warm dark tones (not cold gray). Theme preference stored in DB (`users.theme` column) + localStorage (`moments-theme`). FOUT prevention via synchronous inline script in `<head>` that reads localStorage before CSS paints.
  - **Theme store**: `apps/web/src/store/theme.store.ts` — Zustand with `persist` middleware, mirrors locale store pattern. `null` = follow system, `'light'` / `'dark'` = explicit preference.
  - **useTheme hook**: `apps/web/src/hooks/useTheme.ts` — mounted once in `App.tsx`, toggles `.dark` class on `<html>`, listens to `prefers-color-scheme` media query when in "Follow System" mode.
  - **UI entry points**: (1) EditProfileDialog theme `<select>` with optimistic preview, (2) AppLayout header dropdown quick-toggle (cycles system → light → dark).
  - **Auth sync**: On login, `syncThemeFromUser()` in `auth.store.ts` pushes DB preference to theme store (same pattern as locale sync).
- **Hardcoded overlays**: `bg-black/*` on media thumbnails, avatar hover overlays, and dialog backdrops are intentionally kept — they must darken arbitrary user content.
- **Guest page decoration**: Login/Register pages have a decorative amber radial gradient glow at the top (defined in `GuestLayout.tsx`).
- **Mobile nav active state**: Current page's icon highlighted in amber via `useLocation()` comparison in `AppLayout.tsx`.
- **Custom background**: Users can customize the full-page background (AppLayout root container) with 11 built-in tiling texture presets. Preference stored in DB (`users.background` column) + localStorage (`moments-background`). Each preset has light and dark mode variants with dedicated fill colours.
  - **Background store**: `apps/web/src/store/background.store.ts` — Zustand with `persist` middleware. Value is preset ID (e.g. `'texture-food'`) or `null` (default).
  - **Presets**: Defined in `apps/web/src/lib/backgroundPresets.ts` — 11 texture presets (food, connected, gplay, geometry, wool, plaid, grey, robots, skulls, subtle, dots). Each preset has `id`, `nameKey`, `textureFile` (PNG path), and `light`/`dark` variants with `fillColor` and `intensity`. Textures are transparent PNGs from Transparent Textures (CC BY-SA 3.0).
  - **useBackground hook**: `apps/web/src/hooks/useBackground.ts` — reads store + current theme, returns `{ backgroundStyle, hasCustomBackground }` for AppLayout. `resolveBackgroundStyle()` takes `isDark` to select appropriate variant.
  - **UI**: `BackgroundPicker` component in EditProfileDialog — 7 swatches (default + 6 textures) with live preview strip. Preview respects current theme mode.
  - **AppLayout integration**: Conditional `style` on root div when custom bg is set; `bg-background` class when default. No overlay needed — each preset defines its own dark fill colour.

### Icons
- **Library**: `lucide-react` — all图标统一使用 Lucide React 组件，禁止手写内嵌 `<svg>`。
- **用法**: `import { Home, Plus, User } from 'lucide-react'`，通过 `className` 控制尺寸（如 `w-5 h-5`），通过 `strokeWidth` 控制线条粗细。
- **特殊属性**: 需要填充的图标用 `fill` prop（如 `<Heart fill="currentColor" />`），媒体覆盖层上的白色图标用 `stroke="white"` 或 `fill="white"`。
- **已使用图标**: `User`, `Plus`, `Play`, `X`, `Trash2`, `Camera`, `ArrowLeft`, `Heart`, `MessageSquare`, `Image`, `LogOut`, `Home`。

### Toast notifications
- **Library**: `sonner` — lightweight toast library, module-level `toast()` function (no React context needed).
- **Provider**: `<Toaster />` from `@/components/ui/sonner.tsx`, mounted in `App.tsx`.
- **Theme**: Styled to match the warm amber design tokens (bg-card, text-foreground, border-border).
- **Usage in hooks**: Import `{ toast } from 'sonner'` + `i18n from '@/i18n'`, call `toast.success(i18n.t('namespace:key'))` or `toast.error(...)` directly in mutation callbacks.
- **Convention**: Success toasts for create/delete operations, error toasts for all failures, short-duration (2s) error toasts for high-frequency actions (e.g., like toggle).

### Dialog & AlertDialog
- **Library**: `@radix-ui/react-dialog` and `@radix-ui/react-alert-dialog` — headless primitives providing accessibility (ESC close, focus trap, scroll lock, portal rendering).
- **Wrappers**: `@/components/ui/dialog.tsx` and `@/components/ui/alert-dialog.tsx` — styled with Tailwind CSS, matching project theme tokens.
- **Dialog**: For general-purpose modals (EditProfileDialog). Supports `hideCloseButton` prop when the content has its own close mechanism.
- **AlertDialog**: For destructive confirmations (delete post, delete comment). Uses `AlertDialogAction` (destructive style) + `AlertDialogCancel` pattern. Prevents closing on overlay click — requires explicit user action.
- **Convention**: Never use `window.confirm()` or `window.alert()`. Always use `AlertDialog` for confirmations and `toast` for notifications.

### Media Grid (媒体网格布局)
- **Component**: `@/components/feed/MediaGrid.tsx` — renders media thumbnails in a responsive grid layout.
- **`variant` prop**: `'feed'` (default) or `'detail'` — controls overflow behavior.
- **Layout rules by item count** (applies to both variants):
  - **1**: Single image/video, width 100%, aspect ratio from original dimensions clamped to 1:2 (portrait) ~ 2:1 (landscape), max-h 400px, `object-cover` center crop. Falls back to 4:3 when dimensions unknown.
  - **2**: `grid-cols-2`, aspect-square, center crop.
  - **3**: `grid-cols-3`, one row, aspect-square.
  - **4**: `grid-cols-2`, 2×2 grid, aspect-square.
  - **5–6**: `grid-cols-3`, two rows, aspect-square.
  - **7–9**: `grid-cols-3`, nine-grid, aspect-square.
  - **>9 (feed)**: Only first 9 shown; last cell overlaid with `+N` semi-transparent badge. Clicking still opens lightbox with all media.
  - **>9 (detail)**: All items shown in `grid-cols-3`, no truncation.
- **`PostCard` variant prop**: `PostCard` accepts `variant?: 'feed' | 'detail'` and passes it through to `MediaGrid`. `PostDetail` passes `variant="detail"`.
- **Lightbox integration**: `onItemClick(index)` callback triggers lightbox; slides are always built from the **full** `post.media` array regardless of display truncation.

### Media Lightbox (图片/视频查看器)
- **Library**: `lightgallery` (v2.9) — image/video lightbox with zoom, pan, and keyboard navigation.
- **Plugins used**: `lgZoom` (scroll-wheel/pinch zoom, drag pan) + `lgVideo` (HTML5 `<video>` playback).
- **Component**: `@/components/feed/MediaLightbox.tsx` — wraps lightGallery in `dynamic` mode, exposes `openGallery(index)` via `forwardRef` + `useImperativeHandle`.
- **Conversion utility**: `@/lib/mediaToLightGallery.ts` — converts `PostMediaDto[]` to lightGallery's `GalleryItem[]` format.
- **Integration**: `PostCard` holds a ref to `MediaLightbox`; `MediaGrid` accepts `onItemClick` callback. Clicking a media cell calls `e.stopPropagation()` (blocks `<Link>` navigation) then `openGallery(index)`.
- **CSS imports**: `lightgallery/css/lightgallery.css`, `lg-zoom.css`, `lg-video.css` — imported in `index.css`.
- **Trigger**: Both Feed page and Detail page support lightbox (via PostCard). Click media → lightbox; click text → navigate to detail page.
- **Keyboard**: ← → arrows switch slides, ESC closes. Scroll-wheel zooms when viewing images.

### Public Spaces (公共主题空间)
- **Backend module**: `apps/server/src/modules/spaces/` — SpacesService, GrowthRecordsService, SpacesController
- **Database tables**: `spaces` (name, slug, type, creatorId, memberCount, postCount), `space_members` (role-based membership), `growth_records` (baby space growth data). Posts table has nullable `spaceId` FK.
- **Space types**: `general` (default), `baby` (adds growth records feature with height/weight/head circumference tracking + recharts line chart)
- **Permission model**: Fully public browsing. Only joined members can post/comment/like. Owner cannot leave (must transfer/delete).
- **Feed integration**: Space posts appear in main feed with space badge (name + link). PostCard shows `post.space` info. `enrichPosts()` batch-loads space info + membership status.
- **Membership guard**: LikesService and CommentsService check `post.spaceId` → verify membership before allowing interaction.
- **API routes**: All under `/api/spaces` prefix. `GET /spaces/my` defined before `:slug` to avoid collision.
- **Frontend**:
  - Pages: `SpacesPage` (list with infinite scroll), `SpaceDetailPage` (header + tabs: Posts/Members/Growth)
  - Components: `SpaceCard`, `CreateSpaceDialog`, `SpaceHeader`, `SpacePostsTab`, `SpaceMembersTab`, `GrowthTab`, `GrowthChart` (recharts), `GrowthRecordForm`, `GrowthRecordsList`, `SpaceSelector`
  - Hooks: `useSpaces.ts` (spaceKeys factory, CRUD/membership hooks), `useGrowthRecords.ts`
  - i18n namespace: `spaces` (in `locales/{en,zh-CN}/spaces.json`)
- **Navigation**: Bottom nav has 4 items: Home / Spaces / Profile. `AppLayout` uses `isSpaces = location.pathname.startsWith('/spaces')`.
- **QuickComposer**: Inline expandable post composer at feed top. Collapsed: avatar + placeholder + image icon. Expanded: `HighlightTextarea` with tag highlighting + emoji/hashtag toolbar + media upload + space selector. Uses `useTagSuggestion` for `#` autocomplete, emoji-picker-react for emoji insertion.

### Hashtags (话题标签)
- **Backend module**: `apps/server/src/modules/tags/` — TagsService, TagsController
- **Database tables**: `tags` (name, nameLower UNIQUE, postCount), `post_tags` (composite PK: postId + tagId). `nameLower` stores lowercase for case-insensitive uniqueness.
- **Tag parsing**: `packages/shared/src/utils/hashtag.ts` — `parseHashtags()` extracts `#tagName` from content. Regex: `/\B#([\p{L}\p{N}_]{1,50})(?=\s|$|[^\p{L}\p{N}_])/gu`. Supports Chinese, letters, numbers, underscore. Ends at whitespace/punctuation. Case-insensitive (normalized via `normalizeHashtag()`).
- **Rendering**: `@/components/feed/PostContent.tsx` — uses `renderContentWithTags()` from shared package to split content into text/tag segments. Tags render as `<Link to="/tags/{name}">` with amber primary color.
- **PostDto extension**: `tags: string[]` field on `PostDto` — populated in `enrichPosts()` via batch-loading `postTags` + `tags` join.
- **Create flow**: `PostsService.create()` extracts tags in-transaction, upserts `tags` (increments `postCount`), inserts `postTags` relations.
- **Delete flow**: `PostsService.deleteOwn()` removes `postTags` and decrements `tags.postCount` in-transaction.
- **API routes**: `GET /api/tags?q=prefix&limit=10` (prefix search), `GET /api/tags/:name/posts?sort=latest|hot` (tag detail page). `GET /api/posts?tag=name` adds tag filter to main feed.
- **Frontend**:
  - Page: `TagPage` at `/tags/:name` — header with tag name + post count, sort toggle (latest/hot), infinite scroll PostCard list
  - API: `apps/web/src/api/tags.api.ts`
  - Hooks: `apps/web/src/hooks/useTags.ts` — `useTags(q)` for search, `useTagPosts(name, sort)` for infinite list
  - i18n namespace: `tags` (in `locales/{en,zh-CN}/tags.json`)
- **Case handling**: `#JavaScript` and `#javascript` are the same tag. `name` stores original case, `nameLower` (UNIQUE) stores lowercase. First occurrence's case is preserved.
- **Tag suggestion**: `useTagSuggestion` hook detects `#` + characters in textarea, queries `/api/tags?q=`, shows `TagSuggestionDropdown` at caret position. Keyboard navigation: ↑↓ select, Enter/Tab confirm, Esc close. Debounced 150ms. Integrated in QuickComposer.

### Internationalization (i18n)
- **Library**: `react-i18next` + `i18next` + `i18next-browser-languagedetector`
- **Supported locales**: `en` (English), `zh-CN` (Simplified Chinese)
- **Translation files**: `apps/web/src/i18n/locales/{en,zh-CN}/*.json`
- **Namespaces**: `common`, `auth`, `feed`, `post`, `profile`, `spaces`, `tags` — each page/feature uses its own namespace
- **Language detection priority**: `localStorage` (key `moments-locale`) → `navigator.language`
- **User preference sync**: On login, DB `users.locale` overrides localStorage. Changes via Edit Profile dialog are saved to both DB and localStorage.
- **Date/time formatting**: Uses `Intl.RelativeTimeFormat` and `Intl.DateTimeFormat` for locale-aware output.
- **Zod validation**: Custom `ZodErrorMap` in `apps/web/src/i18n/zod-error-map.ts` maps error codes to translated strings. Re-installed on language change.
- **Adding a new language**: (1) Create `apps/web/src/i18n/locales/{code}/*.json` files, (2) Add imports to `apps/web/src/i18n/index.ts`, (3) Add to `SUPPORTED_LOCALES` in `packages/shared/src/types/user.types.ts`, (4) Add to `@IsIn()` in `apps/server/src/modules/users/dto/update-profile.dto.ts`.
- **TypeScript key autocomplete**: `apps/web/src/i18n/i18next.d.ts` declares `CustomTypeOptions.resources` from English JSON files.

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

## TODO 工作流

项目根目录的 `TODO.md` 是任务跟踪文件，遵循以下工作流：

### 记录想法
当用户随口提到想法、需求、bug 等，主动追加到 `TODO.md` 对应优先级分类下：
- 格式：`- [ ] 简要描述 #tag` （tag 如 `#feature` `#bug` `#infra` `#ui` `#refactor` `#docs`）
- 如果用户没指定优先级，根据内容判断后向用户确认
- 同一次对话中多条想法可以批量添加

### 启动任务
当用户说「做下一个 TODO」「下一项」「继续」等意图时：
1. 读取 `TODO.md`，找到未完成条目中优先级最高（P0 > P1 > P2 > P3）、排列最靠前的一项
2. 向用户确认即将开始的任务
3. 正常走 Plan → 实现流程
4. 完成后将条目从原位置移到 `## Done` 区域，标记为 `- [x]` 并附上完成日期

### 注意事项
- 添加/修改 TODO 条目后无需 commit，除非用户明确要求
- 每次开始任务前先 `Read TODO.md` 确认最新状态
- 如果某个 TODO 过于模糊，先向用户澄清再开始
