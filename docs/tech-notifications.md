# 消息通知功能技术实现方案

> 版本: 1.0
> 日期: 2026-04-21
> 状态: 已完成
> 关联文档: [feature-notifications.md](./feature-notifications.md)

## 一、目标

基于现有 Moments 技术栈，为站内通知中心提供一套可渐进演进的实现方案，覆盖：

- 通知数据建模
- 后端写入与查询链路
- 前端页面、角标与跳转
- 分阶段开发顺序

本方案默认首版只做 Web 端站内通知，不引入实时推送和异步消息队列。

---

## 二、现状评估

### 2.1 已有能力

当前代码库已经具备通知功能所需的大部分事件源：

- 帖子 `@`：`apps/server/src/modules/posts/posts.service.ts`
- 评论 `@` 与回复：`apps/server/src/modules/comments/comments.service.ts`
- 点赞：`apps/server/src/modules/likes/likes.service.ts`
- 提及持久化：`packages/db/src/schema/mentions.ts`
- 帖子详情承接页：`apps/web/src/pages/PostDetailPage.tsx`
- 评论区展示：`apps/web/src/components/post/CommentSection.tsx`

### 2.2 缺失能力

当前缺少：

- 通知表结构
- 通知读写 service
- 通知查询接口
- 未读数接口
- 已读状态维护
- 前端通知页与全局角标
- 从通知跳回帖子/评论的统一协议

---

## 三、总体方案

### 3.1 方案选择

首版采用“单主表 + 可选 actor 明细表”的方式，不额外引入事件总线。

这样做的原因：

- 当前业务规模较小，同步写库足够
- 事件源明确，接入点集中
- 能快速完成 MVP
- 后续仍可平滑演进为异步通知事件处理

### 3.2 架构分层

建议新增一个独立 `notifications` 模块。

后端结构建议：

- `packages/db/src/schema/notifications.ts`
- `apps/server/src/modules/notifications/notifications.module.ts`
- `apps/server/src/modules/notifications/notifications.service.ts`
- `apps/server/src/modules/notifications/notifications.controller.ts`
- `apps/server/src/modules/notifications/dto/*.ts`

前端结构建议：

- `apps/web/src/pages/NotificationsPage.tsx`
- `apps/web/src/api/notifications.api.ts`
- `apps/web/src/hooks/useNotifications.ts`
- `apps/web/src/components/notifications/*`

---

## 四、数据库设计

### 4.1 枚举

新增通知类型枚举：

```ts
notification_type = [
  'mention_in_post',
  'mention_in_comment',
  'comment_on_post',
  'reply_to_comment',
  'like_on_post',
]
```

### 4.2 主表

建议新增 `notifications`：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `uuid` | 主键 |
| `recipientId` | `uuid` | 接收人 |
| `type` | `enum` | 通知类型 |
| `isRead` | `boolean` | 是否已读 |
| `readAt` | `timestamptz` | 已读时间 |
| `actorCount` | `integer` | 聚合人数 |
| `latestActorId` | `uuid` | 最近触发者 |
| `postId` | `uuid` | 关联帖子 |
| `commentId` | `uuid` | 触发评论 |
| `replyToCommentId` | `uuid` | 被回复评论 |
| `contentPreview` | `text` | 冗余摘要 |
| `aggregationKey` | `varchar` | 聚合键 |
| `createdAt` | `timestamptz` | 首次创建时间 |
| `lastEventAt` | `timestamptz` | 最近触发时间 |

索引建议：

- `(recipient_id, last_event_at desc)`
- `(recipient_id, is_read, last_event_at desc)`
- `(aggregation_key)` 非唯一索引

### 4.3 参与人表

建议新增 `notification_actors`，仅用于聚合通知展示最近触发人。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `uuid` | 主键 |
| `notificationId` | `uuid` | 归属通知 |
| `actorId` | `uuid` | 触发人 |
| `createdAt` | `timestamptz` | 插入时间 |

约束建议：

- `(notification_id, actor_id)` 唯一

说明：

- 这样可以避免同一个人重复写入 actor 预览
- 对点赞聚合场景尤其有用

### 4.4 Migration

建议新增一条 migration，例如：

- `packages/db/src/migrations/0016_notifications.sql`

同时更新：

- `packages/db/src/schema/index.ts`
- `packages/db/src/schema/relations.ts`

---

## 五、Shared 类型设计

### 5.1 类型新增

建议在 `apps/web/src/types/dto.ts` 和 `packages/shared/src/types` 中新增：

- `NotificationType`
- `NotificationActorDto`
- `NotificationItemDto`
- `NotificationListResponseDto`
- `UnreadNotificationCountDto`

### 5.2 建议结构

```ts
export type NotificationType =
  | 'mention_in_post'
  | 'mention_in_comment'
  | 'comment_on_post'
  | 'reply_to_comment'
  | 'like_on_post';

export interface NotificationActorDto {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface NotificationItemDto {
  id: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
  lastEventAt: string;
  actorCount: number;
  latestActor: NotificationActorDto | null;
  actorsPreview: NotificationActorDto[];
  post: { id: string } | null;
  comment: { id: string; contentPreview: string | null } | null;
  replyToComment: { id: string; contentPreview: string | null } | null;
  contentPreview: string | null;
  navigationTarget: { postId: string; commentId?: string } | null;
}
```

---

## 六、后端实现方案

### 6.1 模块职责

`NotificationsService` 建议承接两类职责：

- 写入通知
- 查询与已读管理

建议暴露的方法：

- `createMentionInPostNotifications(...)`
- `createMentionInCommentNotifications(...)`
- `createCommentOnPostNotification(...)`
- `createReplyToCommentNotification(...)`
- `createLikeOnPostNotification(...)`
- `listForUser(...)`
- `getUnreadCount(...)`
- `markAsRead(...)`
- `markAllAsRead(...)`

### 6.2 写入接入点

#### 帖子创建后

接入 `PostsService.create` 流程。

现有行为：

- 已经会在帖子创建后解析 `@`
- 已经写入 `mentions`

新增行为：

- 在 `replacePostMentions` 之后补充通知写入
- 为每个被提及用户创建 `mention_in_post`

注意：

- 排除作者自己
- 依赖 `parseMentions` 的去重结果

#### 评论创建后

接入 `CommentsService.create` 流程。

新增行为：

- 若 `replyToId` 存在且回复对象作者不是评论作者，给原评论作者发 `reply_to_comment`（优先于 `comment_on_post`）
- 否则若评论作者不是帖子作者，给帖子作者发 `comment_on_post`
- 若评论中存在 `@`：
  - 正常创建 `mention_in_comment`
  - 但若该用户正好是被回复评论作者，则跳过 `mention_in_comment`，避免与 `reply_to_comment` 重复

#### 点赞成功后

接入 `LikesService.toggle` 流程。

新增行为：

- 仅在“从未点赞 -> 点赞成功”时创建通知
- 仅当点赞人不是帖子作者时处理
- 查找当前聚合窗口内是否已有同一帖子、同一接收人的 `like_on_post`
- 若有则更新
- 若无则新建

### 6.3 聚合键策略

建议统一通过 `aggregationKey` 实现。

| 类型 | aggregationKey |
|------|----------------|
| `mention_in_post` | `mention:post:{postId}:{recipientId}` |
| `mention_in_comment` | `mention:comment:{commentId}:{recipientId}` |
| `comment_on_post` | `comment:{commentId}:recipient:{recipientId}` |
| `reply_to_comment` | `reply:{commentId}:recipient:{recipientId}` |
| `like_on_post` | `like:{postId}:{recipientId}:{windowStart}` |

实现上，点赞聚合窗口建议按日切桶，先用自然日或 24 小时窗口都可以，首版优先简单实现：

- 推荐：按自然日切桶
- 原因：SQL 查询简单，便于幂等

如果要严格按 24 小时滚动窗口，可后续再调优。

### 6.4 查询接口

建议新增以下 API：

#### `GET /api/notifications`

参数：

- `cursor?: string`
- `limit?: number`
- `filter?: 'all' | 'unread'`

行为：

- 按 `lastEventAt desc, id desc` 排序
- 返回 `actorsPreview`
- 返回 `unreadCount`

#### `GET /api/notifications/unread-count`

行为：

- 仅返回当前用户未读总数

#### `POST /api/notifications/:id/read`

行为：

- 若该通知属于当前用户，则置为已读
- 幂等

#### `POST /api/notifications/read-all`

行为：

- 批量更新当前用户全部未读通知

### 6.5 DTO 与 Controller

建议新增：

- `list-notifications.query.ts`
- `mark-notification-read.dto.ts` 或直接 path param

Controller 方法：

- `listMine`
- `getUnreadCount`
- `markRead`
- `markAllRead`

### 6.6 查询拼装

列表查询建议一次性返回渲染所需字段，避免前端二次拼装。

建议查询时补齐：

- `latestActor` 用户资料
- 最近 3 个 `actorsPreview`
- 帖子 id
- 评论摘要
- 被回复评论摘要

摘要生成建议：

- 文本取前 `80` 字
- 纯媒体帖子兜底文案由服务端统一给出，如 `[图片/视频/音频帖]`

### 6.7 删除与不可见处理

实现原则：

- 查询通知时允许目标内容为空
- 前端收到 `navigationTarget` 为 `null` 或打开详情失败时展示 toast

后端不建议在内容删除时级联删除通知，否则会让未读数和用户感知跳变。

---

## 七、前端实现方案

### 7.1 路由

在 `apps/web/src/App.tsx` 中新增：

- `/notifications`

### 7.2 导航入口

在 `AppLayout.tsx` 中补充通知入口：

- 桌面端顶部导航增加一个 tab
- 移动端底部导航增加一个 tab
- 支持未读角标

建议图标：

- `Bell`

### 7.3 API 层

新增 `apps/web/src/api/notifications.api.ts`：

- `getNotifications(params)`
- `getUnreadNotificationCount()`
- `markNotificationRead(id)`
- `markAllNotificationsRead()`

### 7.4 Hook 层

新增 `apps/web/src/hooks/useNotifications.ts`：

- `useNotifications(filter)`
- `useUnreadNotificationCount()`
- `useMarkNotificationRead()`
- `useMarkAllNotificationsRead()`

如果项目已使用 React Query，则沿用现有缓存策略：

- 列表和未读数分别建 query key
- 单条已读成功后本地更新缓存
- 全部已读后统一置零并更新列表

### 7.5 页面结构

`NotificationsPage` 建议拆成：

- `NotificationList`
- `NotificationListItem`
- `NotificationEmptyState`

列表项至少展示：

- 头像
- 文案
- 摘要
- 时间
- 未读圆点

### 7.6 跳转协议

点击通知时：

1. 调用 `markNotificationRead`
2. 跳转到 `/posts/:postId`
3. 若存在 `commentId`，则附带 query 参数

建议路由形式：

- `/posts/:id?commentId=xxx`

后续在帖子详情页中读取 `commentId`，滚动到评论组件对应节点。

首版若不做锚点，也保留该 query 参数，方便下一步接入。

### 7.7 国际化

建议新增命名空间：

- `apps/web/src/i18n/locales/zh-CN/notifications.json`
- `apps/web/src/i18n/locales/en/notifications.json`

至少包含：

- 页面标题
- 空状态
- 全部已读
- 各通知文案模板
- 内容不可用提示

---

## 八、实施顺序

### Phase 1：数据与后端骨架

- 新增 schema、relations、migration
- 建立 notifications module
- 跑通列表 / 未读数 / 已读接口

验收结果：

- 能手工插数并从接口读出通知

### Phase 2：事件接入

- 帖子 `@` 接入
- 评论 / 回复 / 评论内 `@` 接入
- 点赞聚合接入

验收结果：

- 用户操作后可自动生成正确通知

### Phase 3：前端页面与导航

- 新增通知页
- 新增桌面 / 移动导航入口
- 新增未读角标
- 支持标记已读、全部已读

验收结果：

- 用户可完整浏览和处理通知

### Phase 4：跳转体验优化

- 帖子详情支持读取 `commentId`
- 评论项增加锚点
- 通知点击后滚动到目标评论

验收结果：

- 评论/回复通知能更准确落到上下文

---

## 九、测试建议

### 9.1 后端测试重点

- 自己 `@` 自己不发通知
- 同一实体重复 `@` 不重复通知
- 评论帖子时给帖子作者发通知
- 回复评论时给评论作者发通知
- 回复并 `@` 同一人时不重复通知
- 点赞只在成功点赞时创建通知
- 取消点赞不删除历史通知
- 点赞聚合更新 `actorCount` 和 `lastEventAt`
- 单条已读和全部已读幂等

### 9.2 前端测试重点

- 导航角标与接口返回一致
- 列表未读态展示正确
- 点击通知后能已读并跳转
- “全部已读”后列表和角标同步更新
- 空状态与异常状态显示正确

---

## 十、风险与取舍

### 10.1 同步写通知的事务复杂度

风险：

- 在评论和点赞链路中继续叠加写库逻辑，会让 service 更重

取舍：

- 首版接受这一复杂度
- 通过 `NotificationsService` 集中封装，避免业务逻辑散落

### 10.2 点赞聚合规则过早复杂化

风险：

- 如果严格做 24 小时滚动窗口，会增加查询与幂等实现复杂度

取舍：

- 首版先按自然日聚合
- 产品上仍可解释为“最近一段时间”

### 10.3 评论精准定位

风险：

- 现有评论列表分页和渲染结构未必天然支持定位

取舍：

- 首版先保证跳到帖子详情
- 第二阶段再做评论锚点

---

## 十一、建议的首批改动清单

后端：

- `packages/db/src/schema/notifications.ts`
- `packages/db/src/schema/index.ts`
- `packages/db/src/schema/relations.ts`
- `packages/db/src/migrations/0016_notifications.sql`
- `apps/server/src/modules/notifications/*`
- `apps/server/src/app.module.ts`
- `apps/server/src/modules/posts/posts.service.ts`
- `apps/server/src/modules/comments/comments.service.ts`
- `apps/server/src/modules/likes/likes.service.ts`

前端：

- `apps/web/src/App.tsx`
- `apps/web/src/components/layout/AppLayout.tsx`
- `apps/web/src/pages/NotificationsPage.tsx`
- `apps/web/src/api/notifications.api.ts`
- `apps/web/src/hooks/useNotifications.ts`
- `apps/web/src/types/dto.ts`
- `apps/web/src/i18n/locales/zh-CN/notifications.json`
- `apps/web/src/i18n/locales/en/notifications.json`

---

## 十二、结论

通知功能在当前项目里不属于高风险开发项，因为事件源和帖子详情承接页都已经存在。真正需要设计清楚的是：

- 数据模型如何支持去重和聚合
- 评论回复与 `@` 的去重规则
- 未读状态如何与前端角标保持一致

按本文方案推进，可以先以较低复杂度完成一版可用 MVP，再逐步增强为更完整的通知系统。
