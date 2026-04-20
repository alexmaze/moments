# 话题标签功能实现规格

> 版本: 1.0
> 日期: 2026-04-19
> 状态: 待实现

## 一、功能概述

### 1.1 核心需求

- 发帖内容中支持 `#标签名` 语法
- 点击标签可筛选全站相关帖子
- 标签详情页展示标签信息和帖子列表
- 发帖时支持前缀联想输入

### 1.2 标签规则（参考微博）

| 规则 | 说明 |
|------|------|
| 字符集 | 中文、英文字母、数字、下划线 |
| 长度限制 | 1-50 字符 |
| 结束边界 | 空白符（空格、换行、Tab 等）或标点符号 |
| 大小写 | 不区分大小写（`#JavaScript` 和 `#javascript` 视为同一标签） |
| 必须含字母 | 纯数字无效（`#123` 不匹配） |
| 去重 | 同一帖子中重复标签只保留一个 |

### 1.3 示例

| 输入内容 | 解析结果 |
|----------|----------|
| `今天去#公园散步` | `['公园']` |
| `#JavaScript #前端开发` | `['JavaScript', '前端开发']` |
| `#话题。继续` | `['话题']` |
| `#JavaScript #javascript` | `['JavaScript']` (去重) |
| `#123` | `[]` (纯数字无效) |
| `https://example.com#section` | `[]` (URL 片段不匹配) |

---

## 二、数据库设计

### 2.1 新增表

#### `tags` 标签表

```sql
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,                    -- 原始大小写，用于显示
  name_lower VARCHAR(50) NOT NULL UNIQUE,       -- 小写，用于唯一性约束和查询
  post_count INTEGER NOT NULL DEFAULT 0,        -- 反范式计数
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tags_name_lower ON tags(name_lower);
CREATE INDEX idx_tags_post_count ON tags(post_count DESC);  -- 热门标签排序
```

#### `post_tags` 帖子-标签关联表

```sql
CREATE TABLE post_tags (
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, tag_id)
);

CREATE INDEX idx_post_tags_tag ON post_tags(tag_id, created_at DESC);  -- 按标签查帖子
```

### 2.2 Drizzle Schema

```typescript
// packages/db/src/schema/tags.ts

import { pgTable, uuid, varchar, integer, timestamp, primaryKey, index, desc } from 'drizzle-orm/pg-core';
import { posts } from './posts';

export const tags = pgTable('tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 50 }).notNull(),
  nameLower: varchar('name_lower', { length: 50 }).notNull().unique(),
  postCount: integer('post_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_tags_name_lower').on(table.nameLower),
  index('idx_tags_post_count').on(desc(table.postCount)),
]);

export const postTags = pgTable('post_tags', {
  postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  tagId: uuid('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.postId, table.tagId] }),
  index('idx_post_tags_tag').on(table.tagId, table.createdAt),
]);

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type PostTag = typeof postTags.$inferSelect;
```

### 2.3 导出

```typescript
// packages/db/src/schema/index.ts (新增)
export * from './tags';
```

---

## 三、Shared 包实现

### 3.1 标签解析工具

```typescript
// packages/shared/src/utils/hashtag.ts

/**
 * 话题标签解析正则表达式
 * 
 * 规则：
 * - 以 # 开头（前面不能是单词字符，避免匹配 URL）
 * - 支持 Unicode 字母、数字、下划线
 * - 长度 1-50 字符
 * - 以空白符或非标签字符结束
 */
const HASHTAG_REGEX = /\B#([\p{L}\p{N}_]{1,50})(?=\s|$|[^\p{L}\p{N}_])/gu;

/**
 * 从文本中解析话题标签
 * @param text 原始文本
 * @returns 标签数组（去重后，保留首次出现的大小写）
 * 
 * @example
 * parseHashtags('#JavaScript #javascript') // ['JavaScript']
 * parseHashtags('今天#天气真好') // ['天气真好']
 * parseHashtags('#话题。结束') // ['话题']
 */
export function parseHashtags(text: string): string[] {
  if (!text) return [];
  
  const matches = [...text.matchAll(HASHTAG_REGEX)];
  const seen = new Set<string>();
  
  return matches
    .map(m => m[1].replace(/[\p{P}]+$/u, ''))  // 移除末尾可能残留的标点
    .filter(tag => /[\p{L}]/u.test(tag))       // 必须包含至少一个字母
    .filter(tag => {
      const lower = tag.toLowerCase();
      if (seen.has(lower)) return false;
      seen.add(lower);
      return true;
    });
}

/**
 * 标签标准化（用于存储和查询）
 * @param tag 原始标签
 * @returns 小写标准化后的标签
 */
export function normalizeHashtag(tag: string): string {
  return tag.toLowerCase().trim();
}

/**
 * 验证标签是否有效
 * @param tag 标签名（不含 #）
 * @returns 是否有效
 */
export function isValidHashtag(tag: string): boolean {
  if (!tag || tag.length > 50) return false;
  if (!/^[\p{L}\p{N}_]+$/u.test(tag)) return false;
  if (!/[\p{L}]/u.test(tag)) return false;  // 必须含字母
  return true;
}

/**
 * 将文本中的标签转换为可渲染的结构
 * @param content 原始文本
 * @returns 渲染片段数组
 * 
 * @example
 * renderContentWithTags('#你好 世界')
 * // [{ type: 'tag', value: '你好' }, { type: 'text', value: ' 世界' }]
 */
export function renderContentWithTags(content: string): Array<{ type: 'tag' | 'text'; value: string }> {
  if (!content) return [];
  
  const result: Array<{ type: 'tag' | 'text'; value: string }> = [];
  let lastIndex = 0;
  
  const regex = /\B#[\p{L}\p{N}_]{1,50}(?=\s|$|[^\p{L}\p{N}_])/gu;
  let match: RegExpExecArray | null;
  
  while ((match = regex.exec(content)) !== null) {
    // 添加标签前的文本
    if (match.index > lastIndex) {
      result.push({ type: 'text', value: content.slice(lastIndex, match.index) });
    }
    
    // 提取标签名（移除 # 前缀和末尾标点）
    let tagName = match[0].slice(1);
    tagName = tagName.replace(/[\p{P}]+$/u, '');
    
    if (/[\p{L}]/u.test(tagName)) {
      result.push({ type: 'tag', value: tagName });
    } else {
      // 无效标签，当作普通文本
      result.push({ type: 'text', value: match[0] });
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // 添加剩余文本
  if (lastIndex < content.length) {
    result.push({ type: 'text', value: content.slice(lastIndex) });
  }
  
  return result;
}
```

### 3.2 类型定义

```typescript
// packages/shared/src/types/tag.types.ts

export interface TagDto {
  id: string;
  name: string;
  postCount: number;
  createdAt: string;
}

export interface TagWithPostsDto extends TagDto {
  posts: {
    data: PostDto[];
    meta: {
      hasMore: boolean;
      nextCursor: string | null;
    };
  };
}

// PostDto 扩展
// packages/shared/src/types/post.types.ts
export interface PostDto {
  id: string;
  content: string | null;
  createdAt: string;
  author: UserDto;
  media: PostMediaDto[];
  likeCount: number;
  commentCount: number;
  isLikedByMe: boolean;
  space: PostSpaceDto | null;
  comments: CommentDto[];
  hasMoreComments: boolean;
  tags: string[];  // 新增：标签名数组
}
```

---

## 四、后端 API 设计

### 4.1 端点列表

| 方法 | 端点 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/tags` | 获取标签列表（前缀联想） | 否 |
| GET | `/api/tags/:name/posts` | 获取标签下的帖子列表 | 否 |
| GET | `/api/posts?tag=name` | Feed 按标签筛选 | 否 |

### 4.2 API 详情

#### GET /api/tags

获取标签列表，支持前缀搜索。

**Query 参数：**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| q | string | 否 | - | 前缀搜索关键词 |
| limit | number | 否 | 10 | 返回数量，最大 50 |

**响应：**

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "JavaScript",
      "postCount": 42,
      "createdAt": "2026-04-19T10:00:00.000Z"
    }
  ]
}
```

**排序规则：**
- 无 `q` 参数：按 `postCount` 降序（热门标签）
- 有 `q` 参数：按 `postCount` 降序（使用频率联想）

#### GET /api/tags/:name/posts

获取指定标签下的帖子列表。

**路径参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| name | string | 标签名（URL 编码） |

**Query 参数：**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| cursor | string | 否 | - | 分页游标（ISO 时间戳） |
| limit | number | 否 | 20 | 每页数量，最大 50 |
| sort | string | 否 | latest | 排序方式：`latest` / `hot` |

**响应：**

```json
{
  "tag": {
    "id": "uuid",
    "name": "JavaScript",
    "postCount": 42
  },
  "posts": {
    "data": [ /* PostDto[] */ ],
    "meta": {
      "hasMore": true,
      "nextCursor": "2026-04-19T09:00:00.000Z"
    }
  }
}
```

**排序规则：**
- `latest`：按 `posts.createdAt` 降序
- `hot`：按 `posts.likeCount + posts.commentCount` 降序

#### GET /api/posts?tag=name

主 Feed 支持按标签筛选。

**Query 参数（扩展）：**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| cursor | string | 否 | - | 分页游标 |
| limit | number | 否 | 20 | 每页数量 |
| tag | string | 否 | - | 标签名筛选 |

**响应：** 与现有 Feed API 一致

---

## 五、后端实现

### 5.1 新增模块

```
apps/server/src/modules/tags/
├── tags.module.ts
├── tags.service.ts
├── tags.controller.ts
└── dto/
    └── tag-query.dto.ts
```

### 5.2 TagsService

```typescript
// apps/server/src/modules/tags/tags.service.ts

import { Injectable, Inject } from '@nestjs/common';
import { eq, desc, lt, and, inArray, sql, ilike } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { type DrizzleClient, tags, postTags, posts } from '@moments/db';
import { normalizeHashtag } from '@moments/shared';

@Injectable()
export class TagsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleClient,
  ) {}

  /**
   * 获取标签列表（前缀联想）
   */
  async getTags(query?: string, limit = 10) {
    const safeLimit = Math.min(limit, 50);
    
    const conditions = query
      ? ilike(tags.nameLower, `${normalizeHashtag(query)}%`)
      : undefined;

    const rows = await this.db
      .select()
      .from(tags)
      .where(conditions)
      .orderBy(desc(tags.postCount))
      .limit(safeLimit);

    return {
      data: rows.map(row => ({
        id: row.id,
        name: row.name,
        postCount: row.postCount,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  /**
   * 获取标签下的帖子列表
   */
  async getTagPosts(
    tagName: string,
    cursor?: string,
    limit = 20,
    sort: 'latest' | 'hot' = 'latest',
    currentUserId?: string,
  ) {
    const safeLimit = Math.min(limit, 50);
    const nameLower = normalizeHashtag(tagName);

    // 查找标签
    const [tag] = await this.db
      .select()
      .from(tags)
      .where(eq(tags.nameLower, nameLower))
      .limit(1);

    if (!tag) {
      return {
        tag: null,
        posts: { data: [], meta: { hasMore: false, nextCursor: null } },
      };
    }

    // 构建查询条件
    const conditions = [
      eq(posts.isDeleted, false),
      eq(postTags.tagId, tag.id),
    ];
    if (cursor) {
      conditions.push(lt(posts.createdAt, new Date(cursor)));
    }

    // 排序
    const orderBy = sort === 'hot'
      ? [desc(sql`${posts.likeCount} + ${posts.commentCount}`), desc(posts.createdAt)]
      : [desc(posts.createdAt)];

    // 查询帖子
    const postRows = await this.db
      .select({ post: posts })
      .from(postTags)
      .innerJoin(posts, eq(postTags.postId, posts.id))
      .where(and(...conditions))
      .orderBy(...orderBy)
      .limit(safeLimit + 1);

    const hasMore = postRows.length > safeLimit;
    const resultPosts = hasMore ? postRows.slice(0, safeLimit) : postRows;

    if (resultPosts.length === 0) {
      return {
        tag: {
          id: tag.id,
          name: tag.name,
          postCount: tag.postCount,
        },
        posts: { data: [], meta: { hasMore: false, nextCursor: null } },
      };
    }

    // 复用 PostsService.enrichPosts() 逻辑
    // TODO: 调用 postsService.enrichPosts()
    const enrichedPosts = await this.enrichTagPosts(
      resultPosts.map(r => r.post),
      currentUserId,
    );

    const lastPost = resultPosts[resultPosts.length - 1];
    return {
      tag: {
        id: tag.id,
        name: tag.name,
        postCount: tag.postCount,
      },
      posts: {
        data: enrichedPosts,
        meta: {
          hasMore,
          nextCursor: hasMore ? lastPost.post.createdAt.toISOString() : null,
        },
      },
    };
  }

  /**
   * 创建或获取标签（内部方法）
   */
  async upsertTag(tagName: string, tx: any): Promise<string> {
    const nameLower = normalizeHashtag(tagName);
    
    const [tag] = await tx
      .insert(tags)
      .values({ name: tagName, nameLower })
      .onConflictDoUpdate({
        target: tags.nameLower,
        set: { postCount: sql`${tags.postCount} + 1` },
      })
      .returning();

    return tag.id;
  }

  /**
   * 关联帖子与标签（内部方法）
   */
  async linkPostTags(postId: string, tagNames: string[], tx: any) {
    for (const tagName of tagNames) {
      const tagId = await this.upsertTag(tagName, tx);
      await tx.insert(postTags).values({ postId, tagId });
    }
  }

  /**
   * 取消帖子与标签的关联（内部方法）
   */
  async unlinkPostTags(postId: string, tx: any) {
    // 获取帖子的所有标签
    const postTagRows = await tx
      .select({ tagId: postTags.tagId })
      .from(postTags)
      .where(eq(postTags.postId, postId));

    if (postTagRows.length === 0) return;

    const tagIds = postTagRows.map(r => r.tagId);

    // 删除关联
    await tx.delete(postTags).where(eq(postTags.postId, postId));

    // 递减标签计数
    for (const tagId of tagIds) {
      await tx
        .update(tags)
        .set({ postCount: sql`${tags.postCount} - 1` })
        .where(eq(tags.id, tagId));
    }
  }

  // enrichTagPosts 实现类似 PostsService.enrichPosts()
  // 此处省略，实际实现时应复用或提取公共方法
  private async enrichTagPosts(postRows: any[], currentUserId?: string) {
    // ... 参考 PostsService.enrichPosts() 实现
  }
}
```

### 5.3 TagsController

```typescript
// apps/server/src/modules/tags/tags.controller.ts

import { Controller, Get, Param, Query, UseGuards, Optional } from '@nestjs/common';
import { TagsService } from './tags.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  @Public()
  async getTags(
    @Query('q') q?: string,
    @Query('limit') limit?: number,
  ) {
    return this.tagsService.getTags(q, limit);
  }

  @Get(':name/posts')
  @Public()
  async getTagPosts(
    @Param('name') name: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @Query('sort') sort?: 'latest' | 'hot',
    @CurrentUser() currentUserId?: string,
  ) {
    return this.tagsService.getTagPosts(
      decodeURIComponent(name),
      cursor,
      limit,
      sort,
      currentUserId?.id,
    );
  }
}
```

### 5.4 PostsService 扩展

```typescript
// apps/server/src/modules/posts/posts.service.ts

// 在 create() 方法中新增标签处理
async create(dto: CreatePostDto, authorId: string) {
  // ... 现有逻辑 ...

  const post = await this.db.transaction(async (tx) => {
    // 插入帖子
    const [newPost] = await tx.insert(posts).values({
      authorId,
      content: hasContent ? dto.content!.trim() : null,
      spaceId: dto.spaceId ?? null,
    }).returning();

    // 处理媒体
    // ... 现有逻辑 ...

    // 处理空间计数
    // ... 现有逻辑 ...

    // 【新增】处理标签
    if (hasContent && dto.content!.trim()) {
      const tagNames = parseHashtags(dto.content!);
      if (tagNames.length > 0) {
        await this.tagsService.linkPostTags(newPost.id, tagNames, tx);
      }
    }

    return newPost;
  });

  return this.getById(post.id, authorId);
}

// 在 deleteOwn() 方法中新增标签清理
async deleteOwn(id: string, userId: string) {
  // ... 现有校验逻辑 ...

  await this.db.transaction(async (tx) => {
    // 软删除帖子
    await tx
      .update(posts)
      .set({ isDeleted: true, deletedAt: new Date() })
      .where(eq(posts.id, id));

    // 【新增】取消标签关联并递减计数
    await this.tagsService.unlinkPostTags(id, tx);

    // 空间计数递减
    // ... 现有逻辑 ...
  });

  return { success: true };
}

// 在 enrichPosts() 方法中新增标签批量加载
private async enrichPosts(
  postRows: (typeof posts.$inferSelect)[],
  postIds: string[],
  currentUserId?: string,
) {
  // ... 现有批量加载逻辑 ...

  // 【新增】批量加载标签
  const postTagRows = await this.db
    .select({
      postId: postTags.postId,
      tagName: tags.name,
    })
    .from(postTags)
    .innerJoin(tags, eq(postTags.tagId, tags.id))
    .where(inArray(postTags.postId, postIds));

  const tagsByPost = new Map<string, string[]>();
  for (const row of postTagRows) {
    const list = tagsByPost.get(row.postId) || [];
    list.push(row.tagName);
    tagsByPost.set(row.postId, list);
  }

  // 组装返回
  return postRows.map((post) => {
    // ... 现有字段 ...
    return {
      // ... existing fields ...
      tags: tagsByPost.get(post.id) || [],
    };
  });
}

// 【新增】getFeed 支持标签筛选
async getFeed(
  cursor?: string,
  limit = 20,
  currentUserId?: string,
  tagName?: string,  // 新增参数
) {
  const safeLimit = Math.min(limit, 50);

  const conditions = [eq(posts.isDeleted, false)];
  if (cursor) {
    conditions.push(lt(posts.createdAt, new Date(cursor)));
  }

  let postRows;

  if (tagName) {
    // 按标签筛选
    const nameLower = normalizeHashtag(tagName);
    postRows = await this.db
      .select({ post: posts })
      .from(postTags)
      .innerJoin(tags, eq(postTags.tagId, tags.id))
      .innerJoin(posts, eq(postTags.postId, posts.id))
      .where(and(
        eq(tags.nameLower, nameLower),
        ...conditions,
      ))
      .orderBy(desc(posts.createdAt))
      .limit(safeLimit + 1);
    postRows = postRows.map(r => r.post);
  } else {
    // 原有逻辑
    postRows = await this.db
      .select()
      .from(posts)
      .where(and(...conditions))
      .orderBy(desc(posts.createdAt))
      .limit(safeLimit + 1);
  }

  // ... 后续处理不变 ...
}
```

### 5.5 PostsController 扩展

```typescript
// apps/server/src/modules/posts/posts.controller.ts

@Get()
@Public()
async getFeed(
  @Query('cursor') cursor?: string,
  @Query('limit') limit?: number,
  @Query('tag') tag?: string,  // 新增
  @CurrentUser() currentUserId?: string,
) {
  return this.postsService.getFeed(
    cursor,
    limit,
    currentUserId?.id,
    tag ? decodeURIComponent(tag) : undefined,
  );
}
```

### 5.6 模块注册

```typescript
// apps/server/src/modules/tags/tags.module.ts

import { Module } from '@nestjs/common';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';

@Module({
  controllers: [TagsController],
  providers: [TagsService],
  exports: [TagsService],  // 供 PostsModule 使用
})
export class TagsModule {}

// apps/server/src/app.module.ts
import { TagsModule } from './modules/tags/tags.module';

@Module({
  imports: [
    // ... existing modules
    TagsModule,
  ],
})
export class AppModule {}
```

---

## 六、前端实现

### 6.1 文件结构

```
apps/web/src/
├── pages/
│   └── TagPage.tsx              # 新增：标签详情页
├── components/
│   └── feed/
│       └── PostContent.tsx      # 新增：标签高亮渲染组件
├── api/
│   └── tags.api.ts              # 新增：标签 API
├── hooks/
│   └── useTags.ts               # 新增：标签相关 hooks
└── types/
    └── dto.ts                   # 扩展 PostDto
```

### 6.2 API 客户端

```typescript
// apps/web/src/api/tags.api.ts

import { apiClient } from './client';

export interface TagDto {
  id: string;
  name: string;
  postCount: number;
  createdAt: string;
}

export interface TagPostsResponse {
  tag: {
    id: string;
    name: string;
    postCount: number;
  } | null;
  posts: {
    data: PostDto[];
    meta: {
      hasMore: boolean;
      nextCursor: string | null;
    };
  };
}

export const tagsApi = {
  /**
   * 获取标签列表（前缀联想）
   */
  getTags: async (q?: string, limit = 10): Promise<{ data: TagDto[] }> => {
    const params = new URLSearchParams();
    if (q) params.append('q', q);
    params.append('limit', String(limit));
    const res = await apiClient.get(`/api/tags?${params}`);
    return res.data;
  },

  /**
   * 获取标签下的帖子列表
   */
  getTagPosts: async (
    name: string,
    cursor?: string,
    limit = 20,
    sort: 'latest' | 'hot' = 'latest',
  ): Promise<TagPostsResponse> => {
    const params = new URLSearchParams();
    if (cursor) params.append('cursor', cursor);
    params.append('limit', String(limit));
    params.append('sort', sort);
    const res = await apiClient.get(`/api/tags/${encodeURIComponent(name)}/posts?${params}`);
    return res.data;
  },
};
```

### 6.3 Hooks

```typescript
// apps/web/src/hooks/useTags.ts

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { tagsApi } from '@/api/tags.api';

export const tagKeys = {
  all: ['tags'] as const,
  list: (q?: string) => [...tagKeys.all, 'list', q] as const,
  posts: (name: string, sort: 'latest' | 'hot') => [...tagKeys.all, 'posts', name, sort] as const,
};

/**
 * 获取标签列表（用于联想）
 */
export function useTags(q?: string, limit = 10) {
  return useQuery({
    queryKey: tagKeys.list(q),
    queryFn: () => tagsApi.getTags(q, limit),
    enabled: !!q,  // 只在有输入时请求
    staleTime: 60 * 1000,  // 1 分钟
  });
}

/**
 * 获取标签下的帖子列表（无限滚动）
 */
export function useTagPosts(name: string, sort: 'latest' | 'hot' = 'latest') {
  return useInfiniteQuery({
    queryKey: tagKeys.posts(name, sort),
    queryFn: ({ pageParam }) => tagsApi.getTagPosts(name, pageParam, 20, sort),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.posts.meta.nextCursor,
    enabled: !!name,
    staleTime: 60 * 1000,
  });
}
```

### 6.4 PostContent 组件

```tsx
// apps/web/src/components/feed/PostContent.tsx

import { Link } from 'react-router-dom';
import { memo } from 'react';
import { renderContentWithTags } from '@moments/shared';

interface PostContentProps {
  content: string;
  className?: string;
}

export const PostContent = memo(function PostContent({ content, className }: PostContentProps) {
  if (!content) return null;

  const parts = renderContentWithTags(content);

  return (
    <p className={className}>
      {parts.map((part, i) => {
        if (part.type === 'tag') {
          return (
            <Link
              key={i}
              to={`/tags/${encodeURIComponent(part.value)}`}
              className="text-primary hover:underline font-medium"
              onClick={(e) => e.stopPropagation()}  // 阻止冒泡到 PostCard Link
            >
              #{part.value}
            </Link>
          );
        }
        return <span key={i}>{part.value}</span>;
      })}
    </p>
  );
});
```

### 6.5 修改 PostCard

```tsx
// apps/web/src/components/feed/PostCard.tsx

// 替换原有的内容渲染
// 原来:
//   <p className="text-foreground/90 whitespace-pre-wrap break-words">{post.content}</p>
// 改为:
import { PostContent } from './PostContent';

// 在 JSX 中
<PostContent 
  content={post.content} 
  className="text-foreground/90 whitespace-pre-wrap break-words" 
/>
```

### 6.6 TagPage 页面

```tsx
// apps/web/src/pages/TagPage.tsx

import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTagPosts } from '@/hooks/useTags';
import FeedList from '@/components/feed/FeedList';
import { ArrowLeft, Hash } from 'lucide-react';

export default function TagPage() {
  const { name } = useParams<{ name: string }>();
  const { t } = useTranslation('tags');
  const [sort, setSort] = useState<'latest' | 'hot'>('latest');

  const decodedName = name ? decodeURIComponent(name) : '';
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = 
    useTagPosts(decodedName, sort);

  const tag = data?.pages[0]?.tag;

  if (!decodedName) {
    return <NotFoundPage />;
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="p-2 -ml-2 hover:bg-muted rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Hash className="w-6 h-6 text-primary" />
              <h1 className="text-xl font-bold">{decodedName}</h1>
            </div>
          </div>
          
          {tag && (
            <p className="text-muted-foreground text-sm mt-1 ml-11">
              {t('postCount', { count: tag.postCount })}
            </p>
          )}

          {/* Sort Toggle */}
          <div className="flex gap-2 mt-3 ml-11">
            <button
              onClick={() => setSort('latest')}
              className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                sort === 'latest'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {t('sort.latest')}
            </button>
            <button
              onClick={() => setSort('hot')}
              className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                sort === 'hot'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {t('sort.hot')}
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : isError ? (
          <div className="text-center py-8 text-muted-foreground">
            {t('error.loadFailed')}
          </div>
        ) : !tag ? (
          <div className="text-center py-8 text-muted-foreground">
            {t('error.notFound')}
          </div>
        ) : (
          <FeedList
            posts={data?.pages.flatMap(p => p.posts.data) ?? []}
            isLoading={isFetchingNextPage}
            hasMore={hasNextPage ?? false}
            onLoadMore={fetchNextPage}
          />
        )}
      </main>
    </div>
  );
}
```

### 6.7 路由配置

```tsx
// apps/web/src/App.tsx

import TagPage from '@/pages/TagPage';

// 在 <Route element={<AppLayout />}> 内新增
<Route path="/tags/:name" element={<TagPage />} />
```

### 6.8 i18n 翻译

```json
// apps/web/src/i18n/locales/zh-CN/tags.json
{
  "postCount": "{{count}} 篇帖子",
  "sort": {
    "latest": "最新",
    "hot": "热门"
  },
  "error": {
    "loadFailed": "加载失败，请重试",
    "notFound": "该标签不存在"
  }
}

// apps/web/src/i18n/locales/en/tags.json
{
  "postCount": "{{count}} posts",
  "sort": {
    "latest": "Latest",
    "hot": "Hot"
  },
  "error": {
    "loadFailed": "Failed to load, please try again",
    "notFound": "Tag not found"
  }
}
```

```typescript
// apps/web/src/i18n/index.ts (新增命名空间导入)
import tagsZH from './locales/zh-CN/tags.json';
import tagsEN from './locales/en/tags.json';

// 在 resources 中添加
zhCN: {
  // ... existing namespaces
  tags: tagsZH,
},
en: {
  // ... existing namespaces
  tags: tagsEN,
}
```

---

## 七、发帖联想（后续迭代）

### 7.1 需求

- 用户输入 `#` 后触发联想
- 根据后续字符进行前缀搜索
- 显示下拉列表供选择

### 7.2 实现方案（概述）

1. **监听输入**：在 QuickComposer 的 textarea `onChange` 中检测 `#` 输入
2. **触发联想**：`#` 后输入第一个字符后调用 `useTags(query)` 
3. **定位浮层**：使用 `textarea.selectionStart` 计算光标位置，定位下拉菜单
4. **键盘交互**：↑↓ 选择、Enter 确认、Esc 关闭
5. **插入标签**：选中后替换当前输入的 `#xxx` 为 `#完整标签名 `

### 7.3 参考组件

- `SpaceSelector` 的浮层 UI 模式
- 可选方案：引入 `@tiptap/extension-mention` 或轻量 mention 库

---

## 八、实现步骤

### Phase 1: 数据库与基础架构

1. [ ] 创建 `packages/db/src/schema/tags.ts`
2. [ ] 在 `packages/db/src/schema/index.ts` 导出
3. [ ] 运行 `pnpm db:generate` 生成迁移
4. [ ] 运行 `pnpm db:migrate` 应用迁移

### Phase 2: Shared 包

5. [ ] 创建 `packages/shared/src/utils/hashtag.ts`
6. [ ] 扩展 `packages/shared/src/types/tag.types.ts`
7. [ ] 扩展 `packages/shared/src/types/post.types.ts` 添加 `tags` 字段

### Phase 3: 后端

8. [ ] 创建 `apps/server/src/modules/tags/` 模块
9. [ ] 实现 `TagsService` 和 `TagsController`
10. [ ] 修改 `PostsService.create()` 添加标签提取
11. [ ] 修改 `PostsService.deleteOwn()` 添加标签清理
12. [ ] 修改 `PostsService.enrichPosts()` 批量加载标签
13. [ ] 修改 `PostsService.getFeed()` 支持标签筛选
14. [ ] 在 `AppModule` 注册 `TagsModule`

### Phase 4: 前端

15. [ ] 创建 `apps/web/src/api/tags.api.ts`
16. [ ] 创建 `apps/web/src/hooks/useTags.ts`
17. [ ] 创建 `apps/web/src/components/feed/PostContent.tsx`
18. [ ] 修改 `PostCard` 使用 `PostContent`
19. [ ] 创建 `apps/web/src/pages/TagPage.tsx`
20. [ ] 在 `App.tsx` 添加路由
21. [ ] 添加 i18n 翻译文件

### Phase 5: 测试与文档

22. [ ] 手动测试完整流程
23. [ ] 更新 `docs/api.md` 添加标签 API
24. [ ] 更新 `docs/database.md` 添加标签表
25. [ ] 更新 `CLAUDE.md` 记录新功能

---

## 九、注意事项

### 9.1 性能考虑

- 标签联想 API 应有限流（如每秒最多 5 次请求）
- 热门标签列表可缓存（Redis 或内存缓存）
- `postCount` 更新应在事务中保证一致性

### 9.2 边界情况

- 标签名过长（>50 字符）应被截断或忽略
- 无效标签（纯数字）应被忽略
- 标签在帖子删除时自动递减计数
- 标签 `postCount` 降为 0 时是否保留？（建议保留，保留历史）

### 9.3 安全考虑

- 标签名不应包含 HTML 特殊字符（正则已限制）
- API 参数应做 URL 解码
- 防止标签刷量（同一用户短时间大量发帖带同一标签）

---

## 十、后续迭代

- [ ] 发帖时标签联想输入
- [ ] 热门标签展示（首页/空间页侧边栏）
- [ ] 标签管理功能（合并、重命名、删除）
- [ ] 标签关注/订阅功能
- [ ] 标签统计图表（发帖趋势）
