# Moments 架构文档

## 1. 技术栈总览

| 层级     | 技术                                        |
| -------- | ------------------------------------------- |
| 前端     | React, Vite, TailwindCSS, lightGallery, Lexical |
| 富文本   | Lexical + lexical-beautiful-mentions        |
| 后端     | NestJS (Express), Passport, JWT             |
| 数据库   | PostgreSQL 16                               |
| ORM      | Drizzle ORM                                 |
| 运行时   | Node.js 22                                  |
| 包管理   | pnpm (workspace), Turborepo                 |
| 图片处理 | sharp                                       |
| 视频处理 | fluent-ffmpeg (ffmpeg / ffprobe)             |
| 容器化   | Docker 多阶段构建, docker-compose           |

## 2. Monorepo 结构

```
moments/
├── apps/
│   ├── web/           # React SPA 前端
│   └── server/        # NestJS 后端 API
├── packages/
│   ├── db/            # Drizzle schema, 迁移, 数据库客户端
│   └── shared/        # 前后端共享类型与工具函数
├── docker/            # Dockerfile + docker-compose
├── turbo.json         # Turborepo 任务编排
└── pnpm-workspace.yaml
```

**包职责与依赖关系：**

```
+------------------+       +------------------+
|    apps/web      |       |   apps/server    |
|   (React SPA)    |       |    (NestJS)      |
+--------+---------+       +---+-----------+--+
         |                     |           |
         v                     v           v
  +------+------+     +-------+---+  +----+--------+
  | packages/   |     | packages/ |  | packages/   |
  | shared      |     | shared    |  | db          |
  +-------------+     +-----------+  +-------------+
```

- **apps/web** — React SPA, 通过 Vite 开发服务器运行, 依赖 `@moments/shared`
- **apps/server** — NestJS 后端, 提供 `/api` 路由, 依赖 `@moments/db` 和 `@moments/shared`
- **packages/db** — 数据库 schema 定义 (Drizzle), 迁移脚本, `createDrizzleClient` 工厂函数
- **packages/shared** — 前后端共享的 DTO 类型、常量等

Turborepo 通过 `"dependsOn": ["^build"]` 确保 `packages/*` 先于 `apps/*` 构建。

## 3. 请求流程

### 开发环境

```
Browser
  │
  ▼
Vite Dev Server (:5173)
  │
  ├── /api/*     ──proxy──▶  NestJS (:3000) ──▶ PostgreSQL
  ├── /uploads/* ──proxy──▶  NestJS (:3000) ──▶ 本地文件系统
  └── 其他路径   ──▶ Vite HMR (React SPA)
```

Vite 配置 (`vite.config.ts`) 将 `/api` 和 `/uploads` 代理到 `http://localhost:3000`。

### 生产环境

```
Browser
  │
  ▼
NestJS (:3000)
  │
  ├── /api/*     ──▶ NestJS 路由 ──▶ PostgreSQL
  ├── /uploads/* ──▶ Express 静态文件 (本地磁盘)
  └── 其他路径   ──▶ SPA 静态文件 (public/)
       └── fallback ──▶ index.html (客户端路由)
```

NestJS 在生产环境中同时承担三个职责：API 服务、上传文件服务、SPA 静态文件托管。SPA fallback 通过正则 `/^\/(?!api|uploads).*/` 将非 API/uploads 请求重定向到 `index.html`。

## 4. 认证流程

### 注册

```
Client                          Server                         Database
  │                               │                               │
  │  POST /api/auth/register      │                               │
  │  {username, displayName,      │                               │
  │   password}                   │                               │
  │──────────────────────────────▶│                               │
  │                               │  bcrypt.hash(password)        │
  │                               │──┐                            │
  │                               │◀─┘                            │
  │                               │                               │
  │                               │  INSERT INTO users            │
  │                               │  (username, display_name,     │
  │                               │   password_hash, ...)         │
  │                               │──────────────────────────────▶│
  │                               │◀──────────────────────────────│
  │                               │                               │
  │  200 { UserDto }              │                               │
  │◀──────────────────────────────│                               │
```

### 登录

```
Client                          Server                         Database
  │                               │                               │
  │  POST /api/auth/login         │                               │
  │  {username, password}         │                               │
  │──────────────────────────────▶│                               │
  │                               │  LocalStrategy.validate()     │
  │                               │  SELECT user WHERE username   │
  │                               │──────────────────────────────▶│
  │                               │◀──────────────────────────────│
  │                               │                               │
  │                               │  bcrypt.compare(password,     │
  │                               │    user.passwordHash)         │
  │                               │──┐                            │
  │                               │◀─┘                            │
  │                               │                               │
  │                               │  JWT.sign({sub: user.id,      │
  │                               │    username})                  │
  │                               │──┐                            │
  │                               │◀─┘                            │
  │                               │                               │
  │  200 {accessToken, user}      │                               │
  │◀──────────────────────────────│                               │
```

### 鉴权 (每次请求)

```
Client                           JwtAuthGuard              JwtStrategy
  │                                  │                          │
  │  Authorization: Bearer <token>   │                          │
  │─────────────────────────────────▶│                          │
  │                                  │                          │
  │                          检查 @Public() 装饰器              │
  │                                  │                          │
  │                        [有 @Public()]                       │
  │                        直接放行 ──▶ Controller              │
  │                                  │                          │
  │                        [无 @Public()]                       │
  │                                  │  验证 JWT 签名与过期时间 │
  │                                  │─────────────────────────▶│
  │                                  │                          │
  │                                  │  validate(payload)       │
  │                                  │  return {id, username}   │
  │                                  │◀─────────────────────────│
  │                                  │                          │
  │                        req.user = {id, username}            │
  │                        放行 ──▶ Controller                  │
```

**关键实现细节：**
- `JwtAuthGuard` 注册为全局 Guard (`APP_GUARD`)，所有路由默认需要认证
- 使用 `@Public()` 装饰器 (基于 `Reflector` 元数据) 可以跳过认证
- JWT payload 包含 `sub` (用户 ID) 和 `username`，`validate()` 映射为 `{id, username}` 注入 `req.user`
- JWT secret 通过 `ConfigService` 从环境变量 `JWT_SECRET` 读取

## 5. 两阶段媒体上传

### Phase 1: 文件上传

```
Client                        MediaService                  Storage         Database
  │                               │                           │                │
  │ POST /api/media/upload        │                           │                │
  │ (multipart/form-data)         │                           │                │
  │──────────────────────────────▶│                           │                │
  │                               │                           │                │
  │                    1. 验证 MIME 类型                       │                │
  │                    (image/jpeg, png, webp, gif             │                │
  │                     video/mp4, quicktime, webm)            │                │
  │                               │                           │                │
  │                    2. 存储文件                             │                │
  │                               │  save(file, "yyyy/MM/dd") │                │
  │                               │──────────────────────────▶│                │
  │                               │  {storagePath, publicUrl} │                │
  │                               │◀──────────────────────────│                │
  │                               │                           │                │
  │                    3. 提取元数据                           │                │
  │                    [图片] sharp → width, height            │                │
  │                    [视频] ffprobe → width, height,         │                │
  │                           duration                        │                │
  │                           ffmpeg → 首帧截图 → cover.jpg   │                │
  │                               │                           │                │
  │                    4. 插入数据库记录                       │                │
  │                               │    INSERT media_assets    │                │
  │                               │    (status = 'pending')   │                │
  │                               │───────────────────────────────────────────▶│
  │                               │◀──────────────────────────────────────────│
  │                               │                           │                │
  │  200 {id, publicUrl,          │                           │                │
  │       coverUrl, ...metadata}  │                           │                │
  │◀──────────────────────────────│                           │                │
```

### Phase 2: 创建帖子 (关联媒体)

```
Client                        PostsService                           Database
  │                               │                                      │
  │ POST /api/posts               │                                      │
  │ {content, mediaIds}           │                                      │
  │──────────────────────────────▶│                                      │
  │                               │                                      │
  │                    1. 验证 mediaIds 所有权                           │
  │                    (确认当前用户是 uploader)                          │
  │                               │                                      │
  │                    2. 事务 (Transaction)                              │
  │                               │  INSERT INTO posts                   │
  │                               │──────────────────────────────────────▶│
  │                               │                                      │
  │                               │  INSERT INTO post_media_relations    │
  │                               │  (逐条, 按 sort_order)              │
  │                               │──────────────────────────────────────▶│
  │                               │                                      │
  │                               │  UPDATE media_assets                 │
  │                               │  SET status = 'attached'             │
  │                               │──────────────────────────────────────▶│
  │                               │◀─────────────────────────────────────│
  │                               │                                      │
  │  201 {post}                   │                                      │
  │◀──────────────────────────────│                                      │
```

**media_assets.status 生命周期：**

```
pending/orphaned ──(挂载到帖子/头像/空间封面)──▶ attached
        │
        └──(删除帖子 / 替换头像 / 替换空间封面 / 删除空间后失去引用)──▶ orphaned
                                                                      │
                                                                      └──(后台清理 worker 二次校验引用后删除)──▶ 移除
```

补充说明：
- 资源从 `orphaned` 重新挂载时，会清空 `orphaned_at` 和 `cleanup_error`
- 资源变为 `orphaned` 时，会写入 `orphaned_at = now()`
- 清理前会再次检查 `post_media_relations.media_id`、`users.avatar_media_id`、`spaces.cover_media_id`
- 视频资源清理时会同时删除主文件和 `cover_path`

## 6. 视频封面提取

```
video buffer
    │
    ▼
写入临时文件 (os.tmpdir/moments-xxx/input.mp4)
    │
    ├──▶ ffprobe: 提取 width, height, duration
    │
    └──▶ ffmpeg.screenshots(): 抽取首帧 (timemarks: ['0'])
         尺寸: min(原始宽度, 1280) x 等比高度
         输出: <uuid>_cover.jpg
              │
              ▼
         storageProvider.saveBuffer()
         存储到 uploads/yyyy/MM/dd/<uuid>_cover.jpg
              │
              ▼
         media_assets.cover_path = "yyyy/MM/dd/<uuid>_cover.jpg"
         media_assets.cover_url  = "/uploads/yyyy/MM/dd/<uuid>_cover.jpg"
```

临时文件在处理完成后通过 `fs.rm(tmpDir, { recursive: true })` 清理。

## 7. 存储抽象层

```
            IStorageProvider (interface)
            ┌──────────────────────────┐
            │ save(file, subpath)      │
            │ delete(storagePath)      │
            │ getPublicUrl(storagePath)│
            └──────────┬───────────────┘
                       │
           ┌───────────┴───────────┐
           ▼                       ▼
  LocalStorageProvider        (未来: S3StorageProvider)
  ┌─────────────────────┐    ┌──────────────────────┐
  │ 写入本地磁盘        │    │ 上传至 S3 / MinIO    │
  │ ./uploads/yyyy/MM/  │    │ 返回 CDN URL         │
  │ dd/<uuid>.<ext>     │    │                      │
  │                     │    │                      │
  │ publicUrl:          │    │ publicUrl:           │
  │ /uploads/...        │    │ https://cdn.../...   │
  │ yyyy/MM/dd/<uuid>   │    │                      │
  └─────────────────────┘    └──────────────────────┘
```

`LocalStorageProvider` 额外提供 `saveBuffer()` 方法用于保存视频封面等内存中的 Buffer 数据。通过 NestJS 依赖注入 (`STORAGE_PROVIDER` token) 实现可替换。

## 8. 生产部署架构

### Docker 多阶段构建

```
Stage 1: deps (node:22-alpine)
  └─ pnpm install --frozen-lockfile

Stage 2: builder
  └─ pnpm turbo run build
     ├─ packages/db      → dist/
     ├─ packages/shared  → dist/
     ├─ apps/web         → dist/  (Vite 构建 SPA)
     └─ apps/server      → dist/  (NestJS 编译)

Stage 3: runner (node:22-alpine + ffmpeg)
  ├─ dist/           ← server 构建产物
  ├─ public/         ← web SPA 构建产物 (由 NestJS 托管)
  ├─ node_modules/   ← 运行时依赖
  │   ├─ @moments/db
  │   └─ @moments/shared
  └─ /app/uploads/   ← 挂载卷
```

### docker-compose 架构

```
                    docker-compose.prod.yml
┌─────────────────────────────────────────────────────┐
│                                                     │
│  ┌──────────┐        ┌──────────────────────────┐   │
│  │ db       │        │ app                      │   │
│  │ postgres │◀───────│ NestJS (:3000)           │   │
│  │ :16      │  DB连接 │                          │   │
│  │          │        │ ├── /api/*    → 路由处理  │   │
│  └──────────┘        │ ├── /uploads/ → 静态文件  │   │
│   volumes:           │ └── /*       → SPA        │   │
│   postgres_data      └──────────────────────────┘   │
│                        volumes:                     │
│                        uploads_data → /app/uploads  │
│                        ports: ${PORT}:3000          │
└─────────────────────────────────────────────────────┘
```

**关键环境变量：**

| 变量           | 说明                    | 默认值                    |
| -------------- | ----------------------- | ------------------------- |
| `DATABASE_URL` | PostgreSQL 连接字符串   | (compose 内部拼接)        |
| `JWT_SECRET`   | JWT 签名密钥            | (必填, 无默认值)          |
| `UPLOAD_DIR`   | 上传文件存储目录        | `/app/uploads`            |
| `PORT`         | 监听端口                | `3000`                    |
| `NODE_ENV`     | 运行环境                | `production`              |
