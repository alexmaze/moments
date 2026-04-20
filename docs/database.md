# Moments 数据库文档

## 1. 概述

- **数据库**: PostgreSQL 16 (Docker: `postgres:16-alpine`)
- **ORM**: Drizzle ORM (`drizzle-orm/node-postgres`)
- **连接池**: `pg.Pool`, 最大连接数 10
- **表数量**: 9 张表
- **自定义枚举**: 2 个 (`media_type`, `media_status`)
- **Schema 定义位置**: `packages/db/src/schema/`

## 2. ER 关系图

```
┌──────────────┐
│    users     │
│──────────────│
│ PK id        │
│    username   │
│    ...       │
└──────┬───────┘
       │
       │ 1:N
       │
       ├───────────────────────┬──────────────────────┬───────────────────┐
       │                       │                      │                   │
       ▼                       ▼                      ▼                   ▼
┌──────────────┐     ┌──────────────┐      ┌──────────────┐    ┌──────────────┐
│    posts     │     │ media_assets │      │ post_likes   │    │post_comments │
│──────────────│     │──────────────│      │──────────────│    │──────────────│
│ PK id        │     │ PK id        │      │ PK id        │    │ PK id        │
│ FK author_id │     │ FK uploader_ │      │ FK post_id   │    │ FK post_id   │
│    content   │     │    id        │      │ FK user_id   │    │ FK author_id │
│    like_count│     │    type      │      │ UQ (post_id, │    │    content   │
│    comment_  │     │    status    │      │     user_id) │    │    is_deleted│
│    count     │     │    ...       │      └──────────────┘    └──────────────┘
└──────┬───────┘     └──────────────┘
       │
       │ M:N (通过中间表)
       │
       ▼
┌──────────────────────┐
│ post_media_relations │
│──────────────────────│
│ PK id                │
│ FK post_id           │
│ FK media_id          │
│    sort_order        │
└──────────────────────┘

┌──────────────┐     ┌──────────────┐
│    tags      │     │  post_tags   │
│──────────────│     │──────────────│
│ PK id        │     │PK(post_id,   │
│    name      │────│    tag_id)    │
│    name_lower│     │ FK post_id   │
│    post_count│     │ FK tag_id    │
└──────────────┘     └──────────────┘

┌──────────────┐
│  event_log   │  (独立表, 无外键关联)
│──────────────│
│ PK id        │
│    user_id   │
│    event_type│
│    payload   │
└──────────────┘
```

## 3. 表结构详情

### 3.1 users

用户表，存储账户信息与认证凭据。

| 字段名          | 类型                         | 约束                      | 说明               |
| --------------- | ---------------------------- | ------------------------- | ------------------ |
| `id`            | `uuid`                       | PK, 默认 `gen_random_uuid()` | 用户唯一标识       |
| `username`      | `varchar(50)`                | NOT NULL, UNIQUE          | 登录用户名         |
| `display_name`  | `varchar(100)`               | NOT NULL                  | 显示名称           |
| `password_hash` | `varchar(255)`               | NOT NULL                  | bcrypt 哈希后的密码 |
| `avatar_url`    | `text`                       | 可空                      | 头像 URL           |
| `bio`           | `varchar(300)`               | 可空                      | 个人简介           |
| `is_active`     | `boolean`                    | NOT NULL, 默认 `true`     | 账户是否激活       |
| `created_at`    | `timestamptz`                | NOT NULL, 默认 `now()`    | 创建时间           |
| `updated_at`    | `timestamptz`                | NOT NULL, 默认 `now()`    | 更新时间           |

### 3.2 posts

帖子表。`like_count` 和 `comment_count` 为反范式冗余字段，避免查询 feed 时执行 COUNT 子查询。

| 字段名          | 类型                         | 约束                      | 说明               |
| --------------- | ---------------------------- | ------------------------- | ------------------ |
| `id`            | `uuid`                       | PK, 默认 `gen_random_uuid()` | 帖子唯一标识       |
| `author_id`     | `uuid`                       | NOT NULL, FK → `users.id` | 作者               |
| `content`       | `text`                       | 可空                      | 文字内容           |
| `like_count`    | `integer`                    | NOT NULL, 默认 `0`        | 点赞数 (反范式)    |
| `comment_count` | `integer`                    | NOT NULL, 默认 `0`        | 评论数 (反范式)    |
| `is_deleted`    | `boolean`                    | NOT NULL, 默认 `false`    | 软删除标记         |
| `deleted_at`    | `timestamptz`                | 可空                      | 删除时间           |
| `created_at`    | `timestamptz`                | NOT NULL, 默认 `now()`    | 创建时间           |
| `updated_at`    | `timestamptz`                | NOT NULL, 默认 `now()`    | 更新时间           |

### 3.3 media_assets

媒体资源表。通过 `status` 枚举管理生命周期：上传后为 `pending`，关联帖子后变为 `attached`，未关联的资源可标记为 `orphaned` 进行清理。

| 字段名          | 类型                         | 约束                      | 说明               |
| --------------- | ---------------------------- | ------------------------- | ------------------ |
| `id`            | `uuid`                       | PK, 默认 `gen_random_uuid()` | 资源唯一标识       |
| `uploader_id`   | `uuid`                       | NOT NULL, FK → `users.id` | 上传者             |
| `type`          | `media_type` 枚举            | NOT NULL                  | `image` 或 `video` |
| `status`        | `media_status` 枚举          | NOT NULL, 默认 `pending`  | 生命周期状态       |
| `storage_path`  | `text`                       | NOT NULL                  | 存储相对路径       |
| `public_url`    | `text`                       | NOT NULL                  | 公开访问 URL       |
| `cover_path`    | `text`                       | 可空                      | 视频封面存储路径   |
| `cover_url`     | `text`                       | 可空                      | 视频封面公开 URL   |
| `mime_type`     | `text`                       | NOT NULL                  | MIME 类型          |
| `size_bytes`    | `integer`                    | NOT NULL                  | 文件大小 (字节)    |
| `width`         | `integer`                    | 可空                      | 宽度 (像素)        |
| `height`        | `integer`                    | 可空                      | 高度 (像素)        |
| `duration_secs` | `integer`                    | 可空                      | 视频时长 (秒)      |
| `created_at`    | `timestamptz`                | NOT NULL, 默认 `now()`    | 创建时间           |

### 3.4 post_media_relations

帖子与媒体的关联表 (多对多中间表)。`sort_order` 控制媒体在帖子中的展示顺序。

| 字段名          | 类型                         | 约束                               | 说明             |
| --------------- | ---------------------------- | ---------------------------------- | ---------------- |
| `id`            | `uuid`                       | PK, 默认 `gen_random_uuid()`      | 关系唯一标识     |
| `post_id`       | `uuid`                       | NOT NULL, FK → `posts.id` (CASCADE)| 所属帖子         |
| `media_id`      | `uuid`                       | NOT NULL, FK → `media_assets.id`   | 关联媒体资源     |
| `sort_order`    | `smallint`                   | NOT NULL, 默认 `0`                 | 排序序号         |
| `created_at`    | `timestamptz`                | NOT NULL, 默认 `now()`             | 创建时间         |

### 3.5 post_likes

帖子点赞表。通过 `(post_id, user_id)` 唯一约束防止重复点赞。

| 字段名          | 类型                         | 约束                               | 说明             |
| --------------- | ---------------------------- | ---------------------------------- | ---------------- |
| `id`            | `uuid`                       | PK, 默认 `gen_random_uuid()`      | 点赞唯一标识     |
| `post_id`       | `uuid`                       | NOT NULL, FK → `posts.id` (CASCADE)| 所属帖子         |
| `user_id`       | `uuid`                       | NOT NULL, FK → `users.id`         | 点赞用户         |
| `created_at`    | `timestamptz`                | NOT NULL, 默认 `now()`             | 点赞时间         |

**唯一约束**: `uniq_post_likes (post_id, user_id)` — 每个用户对同一帖子只能点赞一次。

### 3.6 post_comments

帖子评论表。使用软删除 (`is_deleted` + `deleted_at`) 而非物理删除，保留评论历史记录。

| 字段名          | 类型                         | 约束                               | 说明             |
| --------------- | ---------------------------- | ---------------------------------- | ---------------- |
| `id`            | `uuid`                       | PK, 默认 `gen_random_uuid()`      | 评论唯一标识     |
| `post_id`       | `uuid`                       | NOT NULL, FK → `posts.id` (CASCADE)| 所属帖子         |
| `author_id`     | `uuid`                       | NOT NULL, FK → `users.id`         | 评论作者         |
| `content`       | `text`                       | NOT NULL                           | 评论内容         |
| `is_deleted`    | `boolean`                    | NOT NULL, 默认 `false`             | 软删除标记       |
| `deleted_at`    | `timestamptz`                | 可空                               | 删除时间         |
| `created_at`    | `timestamptz`                | NOT NULL, 默认 `now()`             | 评论时间         |

### 3.7 event_log

事件日志表。独立于业务表，用于记录用户行为和系统事件。`payload` 使用 JSONB 存储灵活的事件数据，为后续 AI 分析等扩展预留。

| 字段名          | 类型                         | 约束                      | 说明               |
| --------------- | ---------------------------- | ------------------------- | ------------------ |
| `id`            | `uuid`                       | PK, 默认 `gen_random_uuid()` | 事件唯一标识       |
| `user_id`       | `uuid`                       | 可空                      | 触发用户 (系统事件可为空) |
| `event_type`    | `varchar(100)`               | NOT NULL                  | 事件类型标识       |
| `entity_type`   | `varchar(50)`                | 可空                      | 关联实体类型       |
| `entity_id`     | `uuid`                       | 可空                      | 关联实体 ID        |
| `payload`       | `jsonb`                      | 可空                      | 事件详情 (任意 JSON) |
| `ip_address`    | `varchar(45)`                | 可空                      | 客户端 IP          |
| `user_agent`    | `text`                       | 可空                      | 客户端 User-Agent  |
| `created_at`    | `timestamptz`                | NOT NULL, 默认 `now()`    | 事件时间           |

### 3.8 tags

话题标签表。`name_lower` 为小写标准化版本，用于唯一性约束和查询（不区分大小写）。`post_count` 为反范式冗余字段。

| 字段名          | 类型                         | 约束                      | 说明               |
| --------------- | ---------------------------- | ------------------------- | ------------------ |
| `id`            | `uuid`                       | PK, 默认 `gen_random_uuid()` | 标签唯一标识       |
| `name`          | `varchar(50)`                | NOT NULL                  | 原始大小写，用于显示 |
| `name_lower`    | `varchar(50)`                | NOT NULL, UNIQUE          | 小写标准化，用于去重查询 |
| `post_count`    | `integer`                    | NOT NULL, 默认 `0`        | 关联帖子数 (反范式) |
| `created_at`    | `timestamptz`                | NOT NULL, 默认 `now()`    | 创建时间           |

### 3.9 post_tags

帖子与标签的关联表 (多对多中间表)。复合主键 `(post_id, tag_id)` 防止重复关联。

| 字段名          | 类型                         | 约束                               | 说明             |
| --------------- | ---------------------------- | ---------------------------------- | ---------------- |
| `post_id`       | `uuid`                       | NOT NULL, FK → `posts.id` (CASCADE), PK | 所属帖子         |
| `tag_id`        | `uuid`                       | NOT NULL, FK → `tags.id` (CASCADE), PK  | 关联标签         |
| `created_at`    | `timestamptz`                | NOT NULL, 默认 `now()`             | 创建时间         |

## 4. 索引列表

| 索引名                        | 表                     | 字段                         | 说明                     |
| ----------------------------- | ---------------------- | ---------------------------- | ------------------------ |
| `idx_posts_feed`              | `posts`                | `created_at`                 | Feed 列表时间排序查询    |
| `idx_posts_author`            | `posts`                | `author_id, created_at`      | 用户个人帖子列表查询     |
| `idx_posts_space`             | `posts`                | `space_id, created_at`       | 空间帖子列表查询         |
| `uniq_post_likes`             | `post_likes`           | `post_id, user_id` (UNIQUE)  | 防止重复点赞             |
| `idx_comments_post`           | `post_comments`        | `post_id, created_at`        | 帖子评论列表查询         |
| `idx_event_log_user_id`       | `event_log`            | `user_id`                    | 按用户查询事件           |
| `idx_event_log_event_type`    | `event_log`            | `event_type`                 | 按事件类型查询           |
| `idx_event_log_created_at`    | `event_log`            | `created_at`                 | 按时间范围查询事件       |
| `idx_tags_name_lower`         | `tags`                 | `name_lower`                 | 标签前缀联想查询         |
| `idx_tags_post_count`         | `tags`                 | `post_count DESC`            | 热门标签排序             |
| `idx_post_tags_tag`           | `post_tags`            | `tag_id, created_at`         | 按标签查询帖子           |

此外，所有表的 `id` 字段 (UUID PK) 自动拥有主键索引，`users.username` 的 UNIQUE 约束自动创建唯一索引，`tags.name_lower` 的 UNIQUE 约束自动创建唯一索引。

## 5. 枚举类型

### media_type

媒体资源类型。

| 值        | 说明       |
| --------- | ---------- |
| `image`   | 图片       |
| `video`   | 视频       |

### media_status

媒体资源生命周期状态。

| 值         | 说明                           |
| ---------- | ------------------------------ |
| `pending`  | 已上传, 尚未关联到帖子         |
| `attached` | 已关联到帖子                   |
| `orphaned` | 未被关联且超期, 待清理         |

```
上传文件
  │
  ▼
pending ──(POST /posts 关联)──▶ attached
  │
  └──(超期未关联 / 帖子删除)──▶ orphaned ──(清理任务)──▶ 删除文件 + 数据库记录
```

## 6. 迁移工作流

项目使用 Drizzle Kit 管理数据库迁移：

```
1. 修改 schema 文件 (packages/db/src/schema/*.ts)
       │
       ▼
2. pnpm turbo run db:generate
   (drizzle-kit generate — 生成 SQL 迁移文件)
       │
       ▼
3. 人工审查生成的 SQL 迁移文件
       │
       ▼
4. pnpm turbo run db:migrate
   (drizzle-kit migrate — 执行迁移)
```

Turborepo 中 `db:generate` 和 `db:migrate` 均配置为 `"cache": false`，确保每次执行都是最新状态。
