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
| 视频处理 | fluent-ffmpeg (ffmpeg / ffprobe)            |
| 对象存储 | 腾讯云 COS 私有桶 + 签名 URL                |
| 容器化   | Docker 多阶段构建, docker-compose           |

## 2. Monorepo 结构

```text
moments/
├── apps/
│   ├── web/           # React SPA 前端
│   └── server/        # NestJS 后端 API
├── packages/
│   ├── db/            # Drizzle schema, 迁移, 数据库客户端
│   └── shared/        # 前后端共享类型与工具函数
├── config/            # 存储配置文件
├── docker/            # Dockerfile + docker-compose
├── turbo.json         # Turborepo 任务编排
└── pnpm-workspace.yaml
```

## 3. 请求流程

### 开发环境

```text
Browser
  │
  ▼
Vite Dev Server (:5173)
  │
  ├── /api/*   ──proxy──▶  NestJS (:3000) ──▶ PostgreSQL
  └── 其他路径 ──▶ Vite HMR (React SPA)
```

Vite 配置当前只需代理 `/api` 到 `http://localhost:3000`。

### 生产环境

```text
Browser
  │
  ▼
NestJS (:3000)
  │
  ├── /api/*   ──▶ NestJS 路由 ──▶ PostgreSQL
  └── 其他路径 ──▶ SPA 静态文件 (public/)
       └── fallback ──▶ index.html (客户端路由)
```

媒体文件不再由应用通过 `/uploads/*` 静态托管，而是存放在腾讯云 COS 私有桶，由 API 返回签名 URL。

## 4. 认证流程

认证流程保持不变：

- 所有接口默认需要 JWT
- `@Public()` 跳过认证
- `JwtAuthGuard` 为全局 Guard
- JWT payload 包含 `sub` 与 `username`

## 5. 两阶段媒体上传

### Phase 1: 文件上传

```text
Client                        MediaService                  COS            Database
  │                               │                           │                │
  │ POST /api/media/upload        │                           │                │
  │ (multipart/form-data)         │                           │                │
  │──────────────────────────────▶│                           │                │
  │                               │ 1. 验证 MIME 类型         │                │
  │                               │ 2. 生成 object key        │                │
  │                               │ 3. PUT 对象到 COS         │                │
  │                               │──────────────────────────▶│                │
  │                               │◀──────────────────────────│                │
  │                               │ 4. 提取图片/视频/音频元数据 │                │
  │                               │ 5. 视频首帧抽封面并上传     │                │
  │                               │──────────────────────────▶│                │
  │                               │◀──────────────────────────│                │
  │                               │ 6. 写入 media_assets       │                │
  │                               │───────────────────────────────────────────▶│
  │                               │◀──────────────────────────────────────────│
  │  200 {id, publicUrl, ...}     │                           │                │
  │◀──────────────────────────────│                           │                │
```

当前持久化策略：

- `storage_provider = 'tencent-cos'`
- `bucket` 保存桶名
- `object_key` 保存稳定对象 key
- `public_url` / `cover_url` 仅保留为兼容字段
- 对外真实访问地址由接口实时签发签名 URL

### Phase 2: 创建帖子

```text
pending/orphaned ──(挂载到帖子/头像/空间封面)──▶ attached
        │
        └──(删除帖子 / 替换头像 / 替换空间封面 / 删除空间封面失去引用)──▶ orphaned
                                                                      │
                                                                      └──(清理 worker 删除 COS 对象并删库)──▶ 移除
```

## 6. 视频封面提取

视频上传后，服务端仍使用 ffmpeg/ffprobe：

- 读取视频宽高和时长
- 截取首帧生成 `video-cover.jpg`
- 将封面作为独立 COS 对象上传
- 在 `media_assets.cover_path` 中记录封面 object key

## 7. 存储抽象

当前运行时只支持腾讯云 COS，但仍保留薄接口隔离：

- `StorageConfigService`
  - 从统一配置 `config.yaml` 的 `storage` 段读取
  - 通过 `@moments/config` 包加载和校验
- `TencentCosStorageProvider`
  - `putObject()`
  - `deleteObject()`
  - `getSignedUrl()`
  - `getBucketStats(prefix)` — ListObjects 遍历统计存储占用，10 分钟内存缓存 + in-flight 去重

设计目的不是保留本地模式，而是避免 `MediaService` 直接耦合 COS 请求签名细节。

## 8. 媒体访问模型

对前端来说：

- `avatarUrl`
- `publicUrl`
- `coverUrl`
- `audio.url`

这些字段现在都是 COS 私有桶签名 URL，默认有效期 8 小时。

约束：

- 客户端不能自行拼媒体 URL
- 需要以接口最新返回值为准
- 后续若切换到预览变体，字段名可以不变，返回内容直接替换

## 9. 清理机制

媒体清理 worker 仍按 `orphaned` 状态扫描，但删除目标改为 COS 对象：

- 删除主文件 object key
- 删除视频封面 object key
- 删除数据库记录

删除前仍会二次校验帖子附件、用户头像、空间封面引用，避免误删。

## 10. 后续演进

Phase 1 已完成的方向：

- 从本地静态目录切到 COS 私有桶
- API 返回签名 URL
- `media_assets` 新增存储标识字段

Phase 2 计划：

- `media_asset_variants`
- 图片 `webp preview`
- 视频 `mp4 preview`
- 音频 `m4a preview`
- 波形与异步处理链

Phase 3 计划：

- 浏览器直传 COS
- 分片上传
- 临时凭证或预签名上传
