# Moments API Reference

所有接口统一前缀 `/api`。需要认证的接口请在请求头中携带 `Authorization: Bearer <token>`。

---

## Auth（认证）

### 注册

```
POST /api/auth/register
```

**认证**: Public

**描述**: 注册新用户账号。

**请求体**:

| 字段          | 类型     | 必填 | 校验规则                                     |
| ------------- | -------- | ---- | -------------------------------------------- |
| `username`    | `string` | 是   | 2-50 字符，仅允许字母、数字、下划线和连字符  |
| `displayName` | `string` | 是   | 1-100 字符                                   |
| `password`    | `string` | 是   | 6-128 字符                                   |

**响应** `200`:

```json
{
  "id": "uuid",
  "username": "alex",
  "displayName": "Alex",
  "avatarUrl": null,
  "bio": null,
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

**错误**:

- `409 Conflict` — 用户名已存在

---

### 登录

```
POST /api/auth/login
```

**认证**: Public

**描述**: 使用用户名和密码登录，返回 JWT access token。

**请求体**:

| 字段       | 类型     | 必填 |
| ---------- | -------- | ---- |
| `username` | `string` | 是   |
| `password` | `string` | 是   |

**响应** `200`:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "username": "alex",
    "displayName": "Alex",
    "avatarUrl": null,
    "bio": null,
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
}
```

**错误**:

- `401 Unauthorized` — 用户名或密码错误

---

### 获取当前用户信息

```
GET /api/auth/me
```

**认证**: Bearer token

**描述**: 获取当前已登录用户的个人信息。

**响应** `200`:

```json
{
  "id": "uuid",
  "username": "alex",
  "displayName": "Alex",
  "avatarUrl": "http://localhost:3000/uploads/avatar.jpg",
  "bio": "Hello world",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

---

## Posts（帖子）

### 获取动态流

```
GET /api/posts
```

**认证**: Bearer token（可选，已登录时返回 `isLikedByMe` 状态）

**描述**: 获取全局动态流，按创建时间倒序排列。使用**游标分页**。

**查询参数**:

| 参数     | 类型     | 必填 | 默认值 | 说明                                    |
| -------- | -------- | ---- | ------ | --------------------------------------- |
| `cursor` | `string` | 否   | —      | 上一页最后一条的 `createdAt` ISO 时间戳 |
| `limit`  | `number` | 否   | `20`   | 每页条数，上限 50                       |

**响应** `200`:

```json
{
  "data": [
    {
      "id": "uuid",
      "content": "今天天气不错",
      "createdAt": "2025-01-01T12:00:00.000Z",
      "author": {
        "id": "uuid",
        "username": "alex",
        "displayName": "Alex",
        "avatarUrl": null
      },
      "media": [
        {
          "id": "uuid",
          "type": "image",
          "publicUrl": "/uploads/2025/01/01/abc.jpg",
          "coverUrl": null,
          "mimeType": "image/jpeg",
          "width": 1920,
          "height": 1080,
          "durationSecs": null,
          "sortOrder": 0
        }
      ],
      "likeCount": 5,
      "commentCount": 3,
      "isLikedByMe": false,
      "comments": [
        {
          "id": "uuid",
          "content": "好看！",
          "createdAt": "2025-01-01T12:30:00.000Z",
          "isDeleted": false,
          "author": {
            "id": "uuid",
            "username": "bob",
            "displayName": "Bob",
            "avatarUrl": null
          }
        }
      ],
      "hasMoreComments": false
    }
  ],
  "meta": {
    "hasMore": true,
    "nextCursor": "2025-01-01T11:00:00.000Z"
  }
}
```

> **内嵌评论预览**: 每条帖子内嵌前 10 条评论（按时间正序），`hasMoreComments` 为 `true` 时表示还有更多评论可通过 `GET /api/posts/:postId/comments?page=2&limit=10` 加载。

---

### 创建帖子

```
POST /api/posts
```

**认证**: Bearer token

**描述**: 创建新帖子。帖子需要包含文本内容或至少一个媒体附件（或两者兼有）。

**请求体**:

| 字段       | 类型       | 必填 | 校验规则                              |
| ---------- | ---------- | ---- | ------------------------------------- |
| `content`  | `string`   | 否   | 不超过 5000 字符                      |
| `mediaIds` | `string[]` | 否   | UUID v4 数组，引用已上传的媒体资源 ID |

> `content` 和 `mediaIds` 至少需要提供一个。`mediaIds` 引用的媒体必须属于当前用户且状态为 `pending`。

**响应** `201`: 返回创建的帖子详情（结构同动态流中的单条帖子）。

**错误**:

- `400 Bad Request` — 既无文本也无媒体 / 媒体资源无效或不属于当前用户

---

### 获取帖子详情

```
GET /api/posts/:id
```

**认证**: Bearer token（可选）

**描述**: 根据 ID 获取单条帖子详情。

**路径参数**:

| 参数 | 类型   | 说明    |
| ---- | ------ | ------- |
| `id` | `UUID` | 帖子 ID |

**响应** `200`: 返回单条帖子详情（结构同动态流中的单条帖子）。

**错误**:

- `404 Not Found` — 帖子不存在或已删除

---

### 删除帖子

```
DELETE /api/posts/:id
```

**认证**: Bearer token

**描述**: 删除自己的帖子（软删除）。

**路径参数**:

| 参数 | 类型   | 说明    |
| ---- | ------ | ------- |
| `id` | `UUID` | 帖子 ID |

**响应** `200`:

```json
{
  "success": true
}
```

**错误**:

- `403 Forbidden` — 不能删除他人的帖子
- `404 Not Found` — 帖子不存在

---

## Media（媒体）

### 上传媒体文件

```
POST /api/media/upload
```

**认证**: Bearer token

**描述**: 上传图片或视频文件。上传后的媒体资源处于 `pending` 状态，创建帖子时通过 `mediaIds` 引用后变为 `attached`。

**请求体**: `multipart/form-data`

| 字段   | 类型   | 必填 | 说明           |
| ------ | ------ | ---- | -------------- |
| `file` | `File` | 是   | 文件，上限 500MB |

**支持的文件类型**:

| 分类 | MIME 类型                                      |
| ---- | ---------------------------------------------- |
| 图片 | `image/jpeg`, `image/png`, `image/webp`, `image/gif` |
| 视频 | `video/mp4`, `video/quicktime`, `video/webm`         |

**响应** `201`:

```json
{
  "id": "uuid",
  "type": "image",
  "publicUrl": "/uploads/2025/01/01/abc.jpg",
  "coverUrl": null,
  "mimeType": "image/jpeg",
  "sizeBytes": 204800,
  "width": 1920,
  "height": 1080,
  "durationSecs": null
}
```

> 视频文件会自动提取首帧作为封面（`coverUrl`），并解析宽高和时长（`durationSecs`，单位秒）。

**错误**:

- `400 Bad Request` — 未上传文件 / 不支持的文件类型

---

### 获取媒体信息

```
GET /api/media/:id
```

**认证**: Bearer token

**描述**: 根据 ID 获取媒体资源详情。

**路径参数**:

| 参数 | 类型     | 说明    |
| ---- | -------- | ------- |
| `id` | `string` | 媒体 ID |

**响应** `200`: 返回媒体资源的完整记录。

**错误**:

- `400 Bad Request` — 媒体不存在

---

## Users（用户）

### 获取用户主页

```
GET /api/users/:username
```

**认证**: Bearer token（可选）

**描述**: 根据用户名获取用户公开资料，包含帖子总数。

**路径参数**:

| 参数       | 类型     | 说明   |
| ---------- | -------- | ------ |
| `username` | `string` | 用户名 |

**响应** `200`:

```json
{
  "id": "uuid",
  "username": "alex",
  "displayName": "Alex",
  "avatarUrl": "http://localhost:3000/uploads/avatar.jpg",
  "bio": "Hello world",
  "postCount": 42,
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

**错误**:

- `404 Not Found` — 用户不存在

---

### 搜索用户

```
GET /api/users/search
```

**认证**: Bearer token

**描述**: 搜索用户，用于 @提及 联想。支持按用户名或昵称前缀匹配。

**Query 参数**:

| 参数   | 类型     | 必填 | 默认值 | 说明           |
| ------ | -------- | ---- | ------ | -------------- |
| `q`    | `string` | 是   | -      | 搜索关键词     |
| `limit`| `number` | 否   | 10     | 返回数量，最大 50 |

**响应** `200`:

```json
[
  {
    "id": "uuid",
    "username": "alex",
    "displayName": "Alex",
    "avatarUrl": "http://localhost:3000/uploads/avatar.jpg"
  }
]
```

**排序规则**: 按用户名精确匹配优先，然后按昵称前缀匹配。

---

### 获取用户的帖子列表

```
GET /api/users/:username/posts
```

**认证**: Bearer token（可选）

**描述**: 获取指定用户的帖子列表，按创建时间倒序排列。使用**游标分页**。

**路径参数**:

| 参数       | 类型     | 说明   |
| ---------- | -------- | ------ |
| `username` | `string` | 用户名 |

**查询参数**:

| 参数     | 类型     | 必填 | 默认值 | 说明                                    |
| -------- | -------- | ---- | ------ | --------------------------------------- |
| `cursor` | `string` | 否   | —      | 上一页最后一条的 `createdAt` ISO 时间戳 |
| `limit`  | `number` | 否   | `20`   | 每页条数，上限 50                       |

**响应** `200`: 结构同 `GET /api/posts` 的分页响应。

**错误**:

- `404 Not Found` — 用户不存在

---

### 更新个人资料

```
PATCH /api/users/me
```

**认证**: Bearer token

**描述**: 更新当前登录用户的个人资料，仅传入需要修改的字段。

**请求体**:

| 字段          | 类型     | 必填 | 校验规则        |
| ------------- | -------- | ---- | --------------- |
| `displayName` | `string` | 否   | 不超过 100 字符 |
| `bio`         | `string` | 否   | 不超过 300 字符 |

**响应** `200`:

```json
{
  "id": "uuid",
  "username": "alex",
  "displayName": "New Name",
  "avatarUrl": "http://localhost:3000/uploads/avatar.jpg",
  "bio": "Updated bio",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

---

### 上传头像

```
POST /api/users/me/avatar
```

**认证**: Bearer token

**描述**: 上传并更新当前用户的头像。

**请求体**: `multipart/form-data`

| 字段   | 类型   | 必填 | 说明              |
| ------ | ------ | ---- | ----------------- |
| `file` | `File` | 是   | 图片文件，上限 10MB |

**响应** `200`:

```json
{
  "id": "uuid",
  "username": "alex",
  "displayName": "Alex",
  "avatarUrl": "/uploads/2025/01/01/avatar.jpg",
  "bio": "Hello world",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

---

## Likes（点赞）

### 切换点赞状态

```
POST /api/posts/:postId/like
```

**认证**: Bearer token

**描述**: 切换帖子的点赞状态（Toggle）。已点赞则取消，未点赞则添加。

**路径参数**:

| 参数     | 类型   | 说明    |
| -------- | ------ | ------- |
| `postId` | `UUID` | 帖子 ID |

**响应** `200`:

```json
{
  "liked": true,
  "likeCount": 6
}
```

**错误**:

- `404 Not Found` — 帖子不存在或已删除

---

## Comments（评论）

### 获取帖子评论列表

```
GET /api/posts/:postId/comments
```

**认证**: Bearer token（可选）

**描述**: 获取指定帖子的评论列表，按创建时间正序排列。使用**偏移量分页**。

**路径参数**:

| 参数     | 类型   | 说明    |
| -------- | ------ | ------- |
| `postId` | `UUID` | 帖子 ID |

**查询参数**:

| 参数    | 类型     | 必填 | 默认值 | 说明     |
| ------- | -------- | ---- | ------ | -------- |
| `page`  | `number` | 否   | `1`    | 页码     |
| `limit` | `number` | 否   | `20`   | 每页条数 |

**响应** `200`:

```json
{
  "data": [
    {
      "id": "uuid",
      "content": "好看！",
      "createdAt": "2025-01-01T12:30:00.000Z",
      "isDeleted": false,
      "author": {
        "id": "uuid",
        "username": "bob",
        "displayName": "Bob",
        "avatarUrl": null
      }
    }
  ],
  "meta": {
    "total": 15,
    "page": 1,
    "pageSize": 20,
    "hasMore": false
  }
}
```

---

### 发表评论

```
POST /api/posts/:postId/comments
```

**认证**: Bearer token

**描述**: 在指定帖子下发表评论。

**路径参数**:

| 参数     | 类型   | 说明    |
| -------- | ------ | ------- |
| `postId` | `UUID` | 帖子 ID |

**请求体**:

| 字段        | 类型     | 必填 | 校验规则   | 说明                       |
| ----------- | -------- | ---- | ---------- | -------------------------- |
| `content`   | `string` | 是   | 1-500 字符 | 评论内容                   |
| `replyToId` | `UUID`   | 否   | -          | 回复的父评论 ID（回复时使用）|

**响应** `201`:

```json
{
  "id": "uuid",
  "content": "好看！",
  "createdAt": "2025-01-01T12:30:00.000Z",
  "isDeleted": false,
  "author": {
    "id": "uuid",
    "username": "bob",
    "displayName": "Bob",
    "avatarUrl": null
  }
}
```

**错误**:

- `404 Not Found` — 帖子不存在或已删除

---

### 删除评论

```
DELETE /api/comments/:id
```

**认证**: Bearer token

**描述**: 删除自己的评论（软删除）。

**路径参数**:

| 参数 | 类型   | 说明    |
| ---- | ------ | ------- |
| `id` | `UUID` | 评论 ID |

**响应**: `204 No Content`（无响应体）

**错误**:

- `403 Forbidden` — 不能删除他人的评论
- `404 Not Found` — 评论不存在或已删除

---

## Tags（标签）

### 获取标签列表

```
GET /api/tags
```

**认证**: Public

**描述**: 获取标签列表，支持前缀搜索联想。按帖子数量降序排列。

**查询参数**:

| 参数    | 类型     | 必填 | 默认值 | 说明             |
| ------- | -------- | ---- | ------ | ---------------- |
| `q`     | `string` | 否   | —      | 前缀搜索关键词   |
| `limit` | `number` | 否   | `10`   | 返回数量，上限 50 |

**响应** `200`:

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "JavaScript",
      "postCount": 42,
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### 获取标签下的帖子列表

```
GET /api/tags/:name/posts
```

**认证**: Bearer token（可选）

**描述**: 获取指定标签下的帖子列表，支持按最新或热门排序。

**路径参数**:

| 参数   | 类型     | 说明   |
| ------ | -------- | ------ |
| `name` | `string` | 标签名 |

**查询参数**:

| 参数     | 类型     | 必填 | 默认值   | 说明                                       |
| -------- | -------- | ---- | -------- | ------------------------------------------ |
| `cursor` | `string` | 否   | —        | 上一页最后一条的 `createdAt` ISO 时间戳    |
| `limit`  | `number` | 否   | `20`     | 每页条数，上限 50                          |
| `sort`   | `string` | 否   | `latest` | 排序方式：`latest`（最新）/ `hot`（热门）  |

**响应** `200`:

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
      "nextCursor": "2025-01-01T11:00:00.000Z"
    }
  }
}
```

**错误**:

- `404 Not Found` — 标签不存在（返回 `tag: null`）
