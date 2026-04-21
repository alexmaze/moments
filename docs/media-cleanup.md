# 媒体废弃资源清理方案

> 状态：MVP 已实现（2026-04-21）。
>
> 当前已落地：
> - `media_assets` 新增 `orphaned_at`、`last_cleanup_attempt_at`、`cleanup_error`
> - 统一通过 `MediaService` 做 attached/orphaned 状态流转
> - 替换头像、替换空间封面、删除帖子、删除空间后会触发无引用检查
> - 服务端内置后台清理 worker，默认每小时执行一次
> - 支持 `MEDIA_CLEANUP_ENABLED` / `RETENTION_DAYS` / `BATCH_SIZE` / `DRY_RUN`

## 背景

当前系统已经将帖子附件、用户头像、空间封面统一归口到 `media_assets` 表管理，并通过以下字段/关系识别业务用途：

- `media_assets.status`：`pending` / `attached` / `orphaned`
- `media_assets.purpose`：`post_attachment` / `user_avatar` / `space_cover`
- 业务引用：
  - 帖子附件：`post_media_relations.media_id`
  - 用户头像：`users.avatar_media_id`
  - 空间封面：`spaces.cover_media_id`

现阶段仍缺少一套完整的“废弃媒体回收”机制。目标不是只写一个删文件脚本，而是建立稳定、低误删风险、可审计、可重试的生命周期治理方案。

## 目标

- 自动识别已经无业务引用的媒体资源
- 延迟清理，避免误删刚解绑但可能立即复用的资源
- 同时清理数据库记录和物理文件
- 支持失败重试、限流、灰度放量
- 支持按 `purpose` 维度反查废弃资源

## 非目标

- 本期不处理历史脏数据自动修复
- 本期不做“存储目录全量扫描并反查数据库”的对账系统
- 本期不做管理后台页面

## 术语与状态语义

### `media_assets.status`

- `pending`
  - 文件已上传
  - 还未正式绑定到业务实体
- `attached`
  - 已被帖子、头像或空间封面引用
- `orphaned`
  - 当前已经没有业务引用
  - 等待清理任务回收

### `media_assets.purpose`

- `post_attachment`
- `user_avatar`
- `space_cover`

语义说明：

- `purpose` 表示该资源最后一次正式挂载时的业务用途
- 资源变成 `orphaned` 后，`purpose` 不清空
- 后续可以直接按 `status='orphaned' and purpose=...` 做筛选和治理

## 生命周期

### 1. 上传

用户上传文件后：

- 插入 `media_assets`
- `status = 'pending'`
- `purpose = null`

### 2. 业务挂载

资源正式挂到业务实体时：

- 帖子附件：写 `purpose = 'post_attachment'`
- 用户头像：写 `purpose = 'user_avatar'`
- 空间封面：写 `purpose = 'space_cover'`
- 同时将 `status = 'attached'`

### 3. 解绑

当业务实体替换或删除资源时：

- 若该媒体仍被其他业务实体引用，则保持 `attached`
- 若确认 0 引用，则写为：
  - `status = 'orphaned'`
  - `purpose` 保留不变

### 4. 延迟清理

定时任务扫描满足条件的 `orphaned` 资源：

- 超过保留期
- 再次确认无引用
- 删除物理文件
- 删除数据库记录

## 数据模型

### 当前已有字段

`media_assets` 当前已具备：

- `id`
- `uploader_id`
- `type`
- `status`
- `purpose`
- `storage_path`
- `public_url`
- `cover_path`
- `cover_url`
- `mime_type`
- `size_bytes`
- `width`
- `height`
- `duration_secs`
- `created_at`

### 建议新增字段

为了支持延迟清理和失败重试，建议在 `media_assets` 增加：

- `orphaned_at timestamptz null`
- `last_cleanup_attempt_at timestamptz null`
- `cleanup_error text null`

说明：

- `orphaned_at`
  - 表示资源从什么时候开始进入可回收状态
  - 不建议用 `created_at` 代替
- `last_cleanup_attempt_at`
  - 便于观测任务重试行为
- `cleanup_error`
  - 保存最近一次删除失败原因

### 是否需要 `deleted_at`

本期不强制需要。

推荐的 MVP 策略：

- 清理成功后直接删除 `media_assets` 记录
- 不保留墓碑记录

如果后续需要更强审计，再补 `deleted_at`。

## 状态流转规则

### 上传

```text
null -> pending
purpose = null
```

### 挂到帖子

```text
pending/orphaned -> attached
purpose = post_attachment
orphaned_at = null
cleanup_error = null
```

### 挂到头像

```text
pending/orphaned -> attached
purpose = user_avatar
orphaned_at = null
cleanup_error = null
```

### 挂到空间封面

```text
pending/orphaned -> attached
purpose = space_cover
orphaned_at = null
cleanup_error = null
```

### 解绑后无引用

```text
attached -> orphaned
orphaned_at = now()
purpose 保留
```

## 清理策略

### 延迟删除

不推荐在资源变成 `orphaned` 的瞬间立即删除物理文件。

推荐策略：

- 先标记为 `orphaned`
- 等待保留期结束后再清理

默认保留期建议：

- 7 天

可配置为：

- 7 天
- 30 天

### 清理对象

每条媒体可能需要删除：

- 主文件：`storage_path`
- 视频封面：`cover_path`，如果存在

注意：

- 视频封面和主文件必须视为同一资源的一部分
- 清理时二者一起处理

## 定时任务设计

### 任务形态

推荐实现为服务端定时任务，而不是人工脚本。

建议：

- 每小时执行一次，或每天执行一次
- 每次按批次处理

### 查询条件

候选资源满足：

- `status = 'orphaned'`
- `orphaned_at <= now() - retention_period`

### 删除前二次确认

删除前必须再次确认该媒体没有被重新绑定：

- 不存在 `post_media_relations.media_id = media.id`
- 不存在 `users.avatar_media_id = media.id`
- 不存在 `spaces.cover_media_id = media.id`

如果发现已重新绑定：

- 跳过删除
- 可顺手修正为 `attached`

### 执行流程

1. 查询一批过期 `orphaned` 媒体
2. 对每条媒体再次检查引用关系
3. 若仍无引用，删除文件
4. 若文件删除成功，删除 `media_assets` 记录
5. 若删除失败，记录错误并等待下次重试

### 批次大小

建议默认：

- 每次 100 条

原因：

- 避免单次任务执行过长
- 降低 I/O 峰值
- 便于灰度放量

## 配置项

建议增加环境变量：

```env
MEDIA_CLEANUP_ENABLED=true
MEDIA_CLEANUP_RETENTION_DAYS=7
MEDIA_CLEANUP_BATCH_SIZE=100
MEDIA_CLEANUP_DRY_RUN=false
```

说明：

- `MEDIA_CLEANUP_ENABLED`
  - 是否启用定时清理
- `MEDIA_CLEANUP_RETENTION_DAYS`
  - 废弃资源保留天数
- `MEDIA_CLEANUP_BATCH_SIZE`
  - 单次清理上限
- `MEDIA_CLEANUP_DRY_RUN`
  - 只打印日志，不做实际删除

## 错误处理与重试

### 删除成功

满足以下条件之一可视为文件删除成功：

- 文件真实删除成功
- 文件本来就不存在

对于“文件不存在”：

- 仍允许继续删除数据库记录
- 因为目标是最终消除脏数据

### 删除失败

如果删除存储文件时出现异常：

- 不删除数据库记录
- 更新：
  - `last_cleanup_attempt_at = now()`
  - `cleanup_error = error message`

下次任务自动重试，无需单独队列。

### 并发场景

必须处理竞态：

- 资源被任务扫描到后，用户又把它重新设置为头像/封面

处理原则：

- 删除前再次检查引用
- 有引用则跳过，不删

## 审计与可观测性

任务日志至少应包含：

- `mediaId`
- `purpose`
- `status`
- `storagePath`
- `coverPath`
- 删除结果
- 错误信息

建议输出统计指标：

- 扫描总数
- 删除成功数
- 删除失败数
- 因重新绑定而跳过的数量
- 按 `purpose` 分组统计

## 对业务代码的约束

所有状态变更必须统一走媒体服务，不允许在业务模块里手写 `media_assets.status`。

推荐保留统一入口：

- `markAttached(ids, purpose)`
- `attachAsset(id, purpose)`
- `markOrphanedIfUnreferenced(id)`

额外约束：

- 资源重新挂载时必须清空：
  - `orphaned_at`
  - `cleanup_error`
- 资源变 `orphaned` 时必须写入：
  - `orphaned_at = now()`

## MVP 实施范围

第一版建议只做以下内容：

1. 数据库字段补齐
- `orphaned_at`
- `last_cleanup_attempt_at`
- `cleanup_error`

2. 业务层状态流转补齐
- `orphaned` 时写 `orphaned_at`
- `attached` 时清 `orphaned_at` 和 `cleanup_error`

3. 定时清理任务
- 扫描过期 `orphaned`
- 删除主文件与视频封面
- 成功后删除 `media_assets` 行
- 失败记录错误并等待重试

4. dry-run 支持
- 用于上线前验证命中范围

## 验收标准

- 替换头像后，旧头像媒体在无引用时变成 `orphaned`
- 替换空间封面后，旧封面媒体在无引用时变成 `orphaned`
- 删除帖子后，未被其他业务引用的附件变成 `orphaned`
- 超过保留期的 `orphaned` 媒体会被自动清理
- 视频主文件和封面文件会一起清理
- 已重新绑定的资源不会被误删
- 删除失败的资源会被记录并在后续任务中重试
- 可以直接按 `status='orphaned' and purpose=...` 查询废弃资源

## 后续迭代

第二阶段可考虑：

- 管理后台手动触发清理
- 清理报表页面
- 按 `purpose` 配置不同保留期
- 存储层全盘扫描与数据库对账
- 对“长期 pending 未挂载资源”引入独立清理策略
