# 消息通知功能需求文档

> 版本: 1.0
> 日期: 2026-04-21
> 状态: 已完成

## 一、功能概述

### 1.1 背景

当前 Moments 已支持以下互动行为：

- 发帖时 `@` 用户
- 评论帖子
- 回复评论
- 点赞帖子

但系统尚未提供统一的消息通知入口。用户需要自行回到帖子或评论上下文才能发现互动，导致以下问题：

- 被 `@` 后无法及时感知
- 帖子收到评论后缺少回流入口
- 评论被回复后缺少明确提醒
- 点赞行为虽然会累积计数，但互动对象不容易感知

因此需要补充一个站内消息通知中心，承接互动事件，帮助用户快速回到相关内容。

### 1.2 目标

- 让用户能在站内集中查看与自己相关的互动消息
- 提供清晰的未读状态与入口提示
- 支持从通知快速跳转到对应帖子或评论上下文
- 保持实现复杂度可控，优先完成 MVP 可用版本

### 1.3 本期不做

- App Push 推送
- 邮件通知
- 短信通知
- WebSocket 实时到达
- 可配置的通知订阅开关
- 系统公告类通知
- 管理后台通知运营能力

---

## 二、范围定义

### 2.1 通知类型

本期仅支持以下 5 类通知：

| 类型 | 触发条件 | 接收人 |
|------|----------|--------|
| `mention_in_post` | 用户在帖子正文中被 `@` | 被提及用户 |
| `mention_in_comment` | 用户在评论内容中被 `@` | 被提及用户 |
| `comment_on_post` | 他人评论了我的帖子 | 帖子作者 |
| `reply_to_comment` | 他人回复了我的评论 | 被回复评论作者 |
| `like_on_post` | 他人点赞了我的帖子 | 帖子作者 |

说明：

- “被评论”与“被回复”分开建模，因为用户预期不同，跳转落点也不同
- 本期不支持“评论被点赞”“回复被点赞”“空间动态通知”等衍生类型

### 2.2 通知中心定位

通知中心是一个站内收件箱页面，负责：

- 按时间倒序展示通知列表
- 区分已读 / 未读
- 展示未读数量
- 支持标记全部已读
- 支持点击跳转到对应内容

### 2.3 交付形态

- Web 端新增通知入口
- 顶部或底部导航显示未读角标
- 新增通知列表页
- 后端新增通知存储、查询、已读接口

---

## 三、用户故事

### 3.1 被提及时

- 作为用户，我希望在别人发帖或评论里 `@` 我时收到提醒
- 作为用户，我点击提醒后能直接看到对应帖子和相关评论内容

### 3.2 帖子被评论时

- 作为帖子作者，我希望在别人评论我的帖子时收到提醒
- 作为帖子作者，我点击提醒后能直接进入帖子详情并定位到评论区

### 3.3 评论被回复时

- 作为评论作者，我希望在别人回复我时收到提醒
- 作为评论作者，我点击提醒后能直接看到回复我的那条评论及其上下文

### 3.4 帖子被点赞时

- 作为帖子作者，我希望知道谁给我的帖子点了赞
- 作为帖子作者，我不需要每个点赞都过于打扰，希望系统支持适度聚合

---

## 四、核心交互

### 4.1 入口

建议在全局主导航中新增“通知”入口。

入口要求：

- 在所有登录后主页面可见
- 未读数大于 `0` 时显示角标
- 角标显示规则：
  - `1-99`：显示具体数字
  - `99+`：显示 `99+`

### 4.2 列表展示

通知列表按“最近触发时间”倒序排列，每项至少展示：

- 触发人头像
- 触发人昵称
- 通知类型文案
- 内容摘要
- 触发时间
- 已读 / 未读状态

示例文案：

- `Alex 在帖子中提到了你`
- `Bob 评论了你的帖子`
- `Cindy 回复了你的评论`
- `David 等 3 人赞了你的帖子`

### 4.3 点击跳转

| 类型 | 跳转目标 |
|------|----------|
| `mention_in_post` | 对应帖子详情页 |
| `mention_in_comment` | 对应帖子详情页，并尽量定位到对应评论 |
| `comment_on_post` | 对应帖子详情页，并滚动到该评论附近 |
| `reply_to_comment` | 对应帖子详情页，并滚动到回复链路附近 |
| `like_on_post` | 对应帖子详情页 |

说明：

- 由于当前前端已有帖子详情页与评论区，v1 可以先通过帖子详情页承接
- “定位到某条评论”允许作为增强项，不要求首版必须精准锚定，但接口应预留 `commentId`

### 4.4 已读规则

- 用户进入通知中心列表页时，不自动全量已读
- 通知项曝光（50% 可见）时，静默调用已读 API，前端状态不变（保留红点和未读背景高亮），下次刷新后未读状态消失
- 这样用户仍能识别哪些是新消息，同时后端已正确记录已读
- 用户可手动执行"全部标记已读"

---

## 五、业务规则

### 5.1 基础规则

- 只为“别人对我产生的互动”创建通知
- 自己触发自己的行为不创建通知
- 目标内容被删除或不可见后，对应通知仍可保留历史记录，但点击时应给出兜底提示

### 5.2 去重与聚合规则

#### `@` 通知

- 同一条帖子内多次 `@` 同一用户，只产生 1 条通知
- 同一条评论内多次 `@` 同一用户，只产生 1 条通知
- 该规则可依赖现有 `mentions` 去重逻辑或在通知层兜底

#### 评论通知

- 每条评论单独产生 1 条通知
- 同一用户连续评论多次，不做聚合

原因：

- 评论通常携带独立内容，聚合后会损失可读性

#### 回复通知

- 每条回复单独产生 1 条通知
- 如果回复别人评论时同时 `@` 了对方，只保留 1 条"回复了你的评论"通知，不再额外发送 `mention_in_comment`
- 回复帖子作者的评论时，只发 `reply_to_comment`，不发 `comment_on_post`（回复语义强于评论）

原因：

- 对同一接收人而言，"回复"语义强于"评论"，双发会显得重复

#### 点赞通知

- 点赞通知按“帖子 + 接收人”聚合
- 聚合窗口建议为 `24 小时`
- 在窗口内新增点赞时，更新同一条通知：
  - `actorCount` 增加
  - `latestActorId` 更新
  - `lastEventAt` 更新
- 展示文案使用“某人等 N 人赞了你的帖子”

说明：

- 取消点赞不回滚已生成通知
- 若用户反复点赞/取消/再点赞，只在再次点赞时视为新事件

### 5.3 空间内容的可见性

当前系统要求只有空间成员才能与空间帖子互动，因此通知查询时也应遵守当前可见性模型：

- 接收人若仍具备查看目标帖子的权限，则通知可正常跳转
- 若目标空间、帖子或评论已删除，或用户已失去访问权限，则通知列表保留，但详情跳转提示“内容不可用”

### 5.4 删除场景

| 场景 | 处理方式 |
|------|----------|
| 帖子被删除 | 通知保留，显示“相关帖子已不可用” |
| 评论被删除 | 通知保留，摘要显示“相关评论已删除” |
| 用户改昵称/头像 | 通知列表展示最新用户资料，不做快照 |
| 触发人账号不存在 | 显示“某用户”兜底文案 |

---

## 六、通知列表展示要求

### 6.1 列表字段

每条通知建议返回以下信息：

- `id`
- `type`
- `isRead`
- `createdAt`
- `lastEventAt`
- `actorCount`
- `latestActor`
- `actorsPreview`
- `post`
- `comment`
- `replyToComment`
- `contentPreview`
- `navigationTarget`

### 6.2 内容摘要规则

| 类型 | 摘要内容 |
|------|----------|
| `mention_in_post` | 帖子正文前 `80` 字 |
| `mention_in_comment` | 评论正文前 `80` 字 |
| `comment_on_post` | 评论正文前 `80` 字 |
| `reply_to_comment` | 回复正文前 `80` 字，同时可附带原评论前 `40` 字 |
| `like_on_post` | 帖子正文前 `80` 字；若纯媒体帖可显示“[图片/视频/音频帖]” |

### 6.3 已读态视觉

- 未读项具有更高视觉权重
- 已读项弱化但不隐藏
- 支持分页或无限滚动加载

---

## 七、数据设计建议

### 7.1 设计原则

通知系统建议采用“两层模型”：

- 事件层：记录原始触发事实
- 收件箱层：面向用户查询的通知项，可做聚合

如果希望先以实现速度优先，v1 也可以直接采用单表方案，但字段上要预留聚合能力。

### 7.2 建议表结构

#### `notifications` 通知主表

```sql
CREATE TYPE notification_type AS ENUM (
  'mention_in_post',
  'mention_in_comment',
  'comment_on_post',
  'reply_to_comment',
  'like_on_post'
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES users(id),
  type notification_type NOT NULL,
  actor_count INTEGER NOT NULL DEFAULT 1,
  latest_actor_id UUID REFERENCES users(id),
  post_id UUID REFERENCES posts(id),
  comment_id UUID REFERENCES post_comments(id),
  reply_to_comment_id UUID REFERENCES post_comments(id),
  triggered_by_event_key VARCHAR(120),
  content_preview TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_event_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_recipient_time
  ON notifications(recipient_id, last_event_at DESC);

CREATE INDEX idx_notifications_recipient_unread
  ON notifications(recipient_id, is_read, last_event_at DESC);
```

字段说明：

- `recipient_id`：接收人
- `type`：通知类型
- `actor_count`：聚合人数，非聚合型固定为 `1`
- `latest_actor_id`：最近一次触发该通知的人
- `post_id`：关联帖子
- `comment_id`：触发评论
- `reply_to_comment_id`：被回复的评论
- `triggered_by_event_key`：幂等键，用于避免重复创建
- `content_preview`：冗余摘要，减少查询拼装成本

#### `notification_actors` 通知参与人表

用于支持“David、Alex 等 3 人”展示。

```sql
CREATE TABLE notification_actors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_actors_notification
  ON notification_actors(notification_id, created_at DESC);
```

说明：

- 对点赞聚合型通知建议保留近 N 个 actor 记录
- 非聚合型通知也可不落该表，直接由 `latest_actor_id` 满足展示

### 7.3 幂等键建议

| 类型 | 建议幂等键 |
|------|------------|
| `mention_in_post` | `mention:post:{postId}:{mentionedUserId}` |
| `mention_in_comment` | `mention:comment:{commentId}:{mentionedUserId}` |
| `comment_on_post` | `comment:{commentId}:post_author:{recipientId}` |
| `reply_to_comment` | `reply:{commentId}:reply_to:{recipientId}` |
| `like_on_post` | `like:aggregate:{postId}:{recipientId}:{yyyymmdd}` 或按窗口查询 |

---

## 八、后端能力需求

### 8.1 事件写入

在以下动作发生后触发通知写入：

- 创建帖子后，处理帖子正文 `@`
- 创建评论后：
  - 处理评论正文 `@`
  - 处理“评论我的帖子”
  - 处理“回复我的评论”
- 点赞帖子成功后，处理“点赞我的帖子”

建议：

- 与主业务事务解耦，允许先同步写入，后续再演进为异步事件
- 但至少保证“不影响主链路成功率”

### 8.2 查询接口

建议新增接口：

#### 获取通知列表

```http
GET /api/notifications?cursor=<isoTime>&limit=20&filter=all|unread
```

返回：

- 通知列表
- `unreadCount`
- 分页信息

#### 获取未读数

```http
GET /api/notifications/unread-count
```

用途：

- 页面初始化
- 导航角标刷新

#### 标记单条已读

```http
POST /api/notifications/:id/read
```

#### 批量标记全部已读

```http
POST /api/notifications/read-all
```

### 8.3 接口返回示例

```json
{
  "data": [
    {
      "id": "uuid",
      "type": "reply_to_comment",
      "isRead": false,
      "createdAt": "2026-04-21T10:00:00.000Z",
      "lastEventAt": "2026-04-21T10:00:00.000Z",
      "actorCount": 1,
      "latestActor": {
        "id": "uuid",
        "displayName": "Alex",
        "username": "alex",
        "avatarUrl": null
      },
      "actorsPreview": [
        {
          "id": "uuid",
          "displayName": "Alex",
          "username": "alex",
          "avatarUrl": null
        }
      ],
      "post": {
        "id": "uuid"
      },
      "comment": {
        "id": "uuid",
        "contentPreview": "这个角度拍得很好"
      },
      "replyToComment": {
        "id": "uuid",
        "contentPreview": "昨天那张更好看"
      },
      "navigationTarget": {
        "postId": "uuid",
        "commentId": "uuid"
      }
    }
  ],
  "meta": {
    "hasMore": true,
    "nextCursor": "2026-04-21T09:00:00.000Z",
    "unreadCount": 7
  }
}
```

---

## 九、前端能力需求

### 9.1 页面

建议新增：

- 通知列表页 `NotificationsPage`

建议信息结构：

- 顶部标题
- “全部已读”按钮
- 筛选 Tab：全部 / 未读
- 通知列表
- 空状态

### 9.2 角标

建议在全局导航增加通知角标：

- 启动时请求一次未读数
- 进入通知页后按实际已读状态更新
- 执行“全部已读”后立即更新为 `0`

### 9.3 空状态

区分两种空状态：

- 没有任何通知：`还没有新的互动`
- 没有未读通知：`全部消息都看过了`

### 9.4 跳转体验

点击通知后的处理顺序：

1. 调用“标记已读”
2. 跳转帖子详情页
3. 若存在 `commentId`，尝试滚动定位

---

## 十、优先级与分期

### 10.1 P1：通知 MVP

本期必须完成：

- 站内通知中心页面
- 未读角标
- 5 类通知写入
- 点赞通知按帖子聚合
- 单条已读 / 全部已读
- 点击跳转帖子详情页

### 10.2 P2：增强体验

后续可追加：

- 评论精准锚点定位
- 通知类型筛选
- 用户通知偏好设置
- 空间相关系统通知
- 浏览器 Push / App Push
- WebSocket 实时刷新

---

## 十一、验收标准

### 11.1 功能验收

- 用户在帖子中被他人 `@` 后，可在通知中心看到提醒
- 用户在评论中被他人 `@` 后，可在通知中心看到提醒
- 用户的帖子被他人评论后，可在通知中心看到提醒
- 用户的评论被他人回复后，可在通知中心看到提醒
- 用户的帖子被他人点赞后，可在通知中心看到提醒
- 用户自己的行为不会给自己发通知
- 未读数与列表未读状态一致
- 点击通知后可进入对应帖子详情
- “全部标记已读”后，未读角标清零

### 11.2 边界验收

- 同一评论回复同时包含 `@` 时，不重复发两类通知给同一人
- 同一帖子内重复 `@` 同一人，不产生重复通知
- 帖子或评论删除后，历史通知仍可查看，但跳转有合理提示
- 点赞通知不会因为取消点赞而消失

---

## 十二、实现建议

### 12.1 推荐实现顺序

1. 建表与 schema
2. 后端通知 service 与写入逻辑
3. 通知列表 / 未读数 / 已读接口
4. 前端通知页与角标
5. 点赞聚合优化
6. 评论锚点体验优化

### 12.2 当前代码库的接入点

- 发帖 `@`：`apps/server/src/modules/posts/posts.service.ts`
- 评论 / 回复 / 评论内 `@`：`apps/server/src/modules/comments/comments.service.ts`
- 点赞：`apps/server/src/modules/likes/likes.service.ts`
- 前端帖子详情承接页：`apps/web/src/pages/PostDetailPage.tsx`
- 评论区承接组件：`apps/web/src/components/post/CommentSection.tsx`

---

## 十三、待确认项

以下问题当前先按默认方案落文档，进入开发前可再确认一次：

1. 通知入口放在顶部 Header 还是底部主导航
2. 点赞聚合窗口是否固定 `24 小时`
3. 通知列表是否需要按类型筛选
4. 列表是否支持“删除通知”
5. 首版是否需要评论精准定位，还是只进帖子详情即可

---

## 十四、结论

消息通知功能建议先聚焦“站内通知中心”这一条主线，不把需求扩展到推送、偏好配置和实时系统。基于当前已有的帖子、评论、回复、点赞和 `mentions` 能力，可以较低成本完成一版可用的通知 MVP。

首版最关键的是三件事：

- 明确定义通知类型和去重规则
- 统一未读状态与跳转链路
- 控制点赞类通知的噪音，避免列表被刷屏
