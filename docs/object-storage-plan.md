# 对象存储与多媒体处理规划

> 状态：已收敛到 Phase 1 方案（2026-04-24）

## 已确认约束

- 运行时只支持腾讯云 COS，不再保留 `local` 模式
- 媒体存储使用私有桶，不走公网匿名读
- 服务端向前端返回签名 URL
- 签名 URL 默认有效期：`8` 小时
- 图片预览格式统一接受 `webp`
- 视频预览格式统一接受 `mp4`
- 音频预览格式统一接受 `m4a`
- 当前先做 Phase 1，但接口和数据模型要给 Phase 2 留扩展位

## 背景

当前媒体系统最初是围绕本地磁盘实现的：

- 当前实现已切到腾讯云 COS；这里保留的是 Phase 1 改造前的问题背景
- 依赖注入入口在 [`StorageModule`](apps/server/src/modules/media/storage/storage.module.ts)
- 抽象接口定义在 [`storage.interface.ts`](apps/server/src/modules/media/storage/storage.interface.ts)
- 媒体上传主流程在 [`media.service.ts`](apps/server/src/modules/media/media.service.ts)
- 当前 `media_assets` 只保存“原文件 URL + 视频封面 URL”，数据模型见 [`packages/db/src/schema/media.ts`](packages/db/src/schema/media.ts)

这套设计能支撑本地上传，但对现在的目标已经不够：

- 生产环境统一走腾讯云 COS 私有桶
- 服务端生成签名 URL，而不是返回固定公开路径
- 图片、视频、录音都要支持压缩、预览、封面、波形等衍生能力
- 后续支持异步处理、转码、分片上传

## 现状问题

### 1. 现有存储抽象仍是“公开文件 URL”模型

改造前的 `IStorageProvider` 只有：

- `save(file, subpath)`
- `saveBuffer(buffer, subpath, filename)`
- `delete(storagePath)`
- `getPublicUrl(storagePath)`

这个接口只适合“保存一个文件并拿到公开 URL”，与私有桶模型不匹配：

- 记录 bucket / region / object key
- 支持按请求重新签发 URL
- 区分持久化标识和临时访问地址
- 按 variant 管理多个衍生文件
- 支持后续分片上传与异步处理

### 2. 数据模型把“存储标识”和“访问地址”绑死了

当前 `media_assets` 直接持久化：

- `storage_path`
- `public_url`
- `cover_path`
- `cover_url`

这会带来两个问题：

- 私有桶下，`public_url` 不是稳定值，而是短期签名结果
- 后续多变体场景下，`cover_url` 这类字段会越堆越乱

同时也意味着：

- 图片预览图、缩略图、不同格式转码没有位置可存
- 视频除了一个 `cover` 外，没有低码率预览版/HLS/转码状态
- 录音没有“压缩版本”“波形文件”“转码状态”等结构化字段

### 3. 上传接口仍是内存中转

当前媒体上传接口使用 `multer.memoryStorage()`，500MB 文件会先进 Node 进程内存，再交给后续处理：

- [`media.controller.ts`](apps/server/src/modules/media/media.controller.ts)
- [`posts.controller.ts`](apps/server/src/modules/posts/posts.controller.ts)

这对大视频和后续对象存储都不理想，主要问题：

- 内存压力大
- 不利于分片上传
- 服务端同步做压缩/抽帧时，请求耗时会被放大

### 4. COS 能力和业务模型还没有清晰边界

“对象存储兼容层”和“多媒体处理能力”实际上是两层职责：

- 存储层负责放文件、删文件、生成访问地址
- 处理层负责压缩、转码、抽帧、波形生成、衍生版本管理

即使现在只做 COS，也不应该把“图片压缩、视频转码、音频转码”直接揉进存储接口，否则后面扩展处理链会越来越难拆。

## 目标

- 支持通过配置文件加载 COS 私有桶配置
- 运行时统一使用腾讯云 COS
- 服务端对外返回签名 URL，而不是固定公开 URL
- 为图片、视频、录音建立统一的“原文件 + 衍生文件”模型
- 不把 COS 的专有处理参数直接泄漏到业务层
- 与当前 `media_assets` 生命周期兼容：`pending -> attached -> orphaned -> cleanup`

## 非目标

- 本期不先做本地存储与 COS 双栈并行
- 本期不先做浏览器直传和 STS 临时凭证
- 本期不先做 HLS、DASH、多码率流媒体平台能力
- 本期不先做全量历史媒体迁移工具

## 核心设计建议

## 一、分成两层：存储层 + 处理层

### 1. 存储层：只关心对象的读写与寻址

虽然运行时只支持 COS，但内部仍建议保留一个很薄的存储边界，避免媒体服务直接耦合 COS SDK 细节。边界可以比原来更窄，但要能表达私有桶。

```ts
interface StorageProvider {
  readonly kind: 'tencent-cos';

  putObject(input: {
    key: string;
    body: Buffer | NodeJS.ReadableStream;
    contentType: string;
    contentLength?: number;
    cacheControl?: string;
    metadata?: Record<string, string>;
  }): Promise<StoredObject>;

  deleteObject(key: string): Promise<void>;
  headObject(key: string): Promise<StoredObjectMeta | null>;
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
}
```

`StoredObject` 至少应返回：

- `key`
- `sizeBytes`
- `etag`
- `provider`

说明：

- `save(file, subpath)` 这种“由 provider 自己拼路径”的接口建议淘汰
- 业务层或媒体层应该显式生成 object key，避免目录策略失控
- 私有桶下不建议在数据库里保存签名 URL，应保存稳定的 `object_key`

### 2. 处理层：只关心如何产出衍生版本

建议新增独立的媒体处理接口，而不是把压缩逻辑塞进 `StorageProvider`：

```ts
interface MediaProcessor {
  processImage(input: OriginalAssetContext): Promise<DerivedVariantResult[]>;
  processVideo(input: OriginalAssetContext): Promise<DerivedVariantResult[]>;
  processAudio(input: OriginalAssetContext): Promise<DerivedVariantResult[]>;
}
```

首期可以只有一个实现：

- `CosBackedMediaProcessor`
  - 同步图像压缩仍可由服务端 `sharp` 完成
  - 视频封面抽帧、音频转码、视频转码在 Phase 2 再决定是否接入 COS 数据万象异步任务

这样做的意义：

- 存储边界保持稳定
- Phase 1 不会因为转码策略未定而拖住 COS 接入
- 后续如果改成“服务端 ffmpeg 处理”或“COS 数据万象处理”，业务层都不用大改

## 二、数据模型升级为“资产 + 变体”

### 1. 建议保留 `media_assets` 作为主资产表

`media_assets` 继续承载：

- 业务归属和生命周期
- 原始文件基础元数据
- 主状态和处理状态

在现在的私有桶前提下，`media_assets` 至少要逐步从“保存 URL”转成“保存 object key + 动态签名”。建议新增字段：

- `storage_provider text not null default 'tencent-cos'`
- `bucket text null`
- `object_key text not null`
- `etag text null`
- `checksum_sha256 text null`
- `processing_status text not null default 'ready'`
- `processing_error text null`
- `preview_variant_id uuid null`
- `poster_variant_id uuid null`

其中 `processing_status` 建议取值：

- `pending`
- `processing`
- `ready`
- `failed`

### 2. Phase 2 再新增 `media_asset_variants` 表

建议新表保存所有衍生文件，而不是继续在 `media_assets` 上堆字段。

建议字段：

- `id`
- `asset_id`
- `variant_kind`
- `storage_provider`
- `bucket`
- `object_key`
- `public_url`
- `mime_type`
- `size_bytes`
- `width`
- `height`
- `duration_ms`
- `bitrate_kbps`
- `status`
- `metadata jsonb`
- `created_at`

`variant_kind` 建议先支持：

- `original`
- `image_preview`
- `image_thumb`
- `video_poster`
- `video_preview`
- `audio_preview`
- `audio_waveform`

说明：

- 现在的 `cover_path` / `cover_url` 本质上就是 `video_poster`
- 长远看应迁移到 variants 表，不再单独保留 `cover_*`
- 在过渡期可双写，降低改造风险

## 三、面向业务返回“首选 URL”，底层保留多版本

为了不一次性冲击前端接口，建议 API 在 Phase 1 保持外层结构兼容：

- `publicUrl` 继续存在，但它变成“本次响应动态签出的访问 URL”
- `coverUrl` 继续作为视频封面兼容字段，同样是动态签名结果

但内部逻辑改为：

- 图片 `publicUrl` 在 Phase 1 仍可先指向原文件，Phase 2 再切到 `image_preview`
- 视频 `publicUrl` 在 Phase 1 指向原视频签名 URL
- 录音 `publicUrl` 在 Phase 1 指向原音频签名 URL

同时逐步补充更明确的响应结构：

```json
{
  "id": "...",
  "type": "image",
  "publicUrl": "...",
  "coverUrl": null,
  "variants": {
    "original": "...",
    "preview": "...",
    "thumb": "..."
  },
  "processingStatus": "ready"
}
```

## 腾讯云 COS 方案建议

## 一、Provider 选型

优先建议：

- 基础对象操作使用 COS 官方 Node SDK
- 暂不接 S3 兼容层

原因：

- 腾讯云基础存储能力和 S3 有相似面，但不是所有高级能力都适合硬套 S3 抽象
- 如果后面要用 COS 数据万象、转码、样式、截图等能力，官方 SDK 和官方术语更稳

结论：当前仓库只保留 `tencent-cos` 这一种运行时 provider。

但代码层仍建议保留 `StorageProvider` 接口和 `STORAGE_PROVIDER` 注入 token：

- 这不是为了支持本地模式
- 而是为了避免 `MediaService` 直接绑死 COS SDK 细节
- 后续换实现时，改动面可控

## 二、配置文件模型

建议增加一个独立配置文件，例如：

[`config/storage.example.yaml`](config/storage.example.yaml)

推荐结构：

```yaml
storage:
  driver: tencent-cos
  signedUrlTtlSeconds: 28800
  keyPrefix: moments

  tencentCos:
    secretId: ${TENCENT_COS_SECRET_ID}
    secretKey: ${TENCENT_COS_SECRET_KEY}
    region: ap-shanghai
    bucket: your-bucket-1250000000
    useHttps: true
    enableCi: true
    timeoutMs: 30000
    privateBucket: true

media:
  image:
    maxWidth: 2560
    previewWidth: 1600
    thumbnailWidth: 480
    previewFormat: webp
    previewQuality: 82

  video:
    posterWidth: 1280
    previewMaxWidth: 1280
    previewVideoBitrateKbps: 1800
    previewAudioBitrateKbps: 96
    previewFormat: mp4

  audio:
    previewCodec: aac
    previewBitrateKbps: 64
    waveformSamples: 64
```

实现建议：

- 配置文件由服务端启动时加载
- 用 `zod` 或 `class-validator` 做结构校验
- 支持 `${ENV_VAR}` 插值，避免密钥硬编码进仓库

Phase 1 必要配置建议：

- `bucket`
- `region`
- `secretId`
- `secretKey`
- `signedUrlTtlSeconds=28800`
- `keyPrefix`

## 三、COS 上的对象 key 规划

建议统一 object key 规则，避免后期目录混乱：

```text
{keyPrefix}/{env}/{yyyy}/{MM}/{dd}/{assetId}/original.{ext}
{keyPrefix}/{env}/{yyyy}/{MM}/{dd}/{assetId}/image-preview.webp
{keyPrefix}/{env}/{yyyy}/{MM}/{dd}/{assetId}/image-thumb.webp
{keyPrefix}/{env}/{yyyy}/{MM}/{dd}/{assetId}/video-poster.jpg
{keyPrefix}/{env}/{yyyy}/{MM}/{dd}/{assetId}/video-preview.mp4
{keyPrefix}/{env}/{yyyy}/{MM}/{dd}/{assetId}/audio-preview.m4a
{keyPrefix}/{env}/{yyyy}/{MM}/{dd}/{assetId}/audio-waveform.json
```

好处：

- 同一资产的原文件和变体天然归组
- 清理 orphaned 资源时，逻辑更简单
- 后续做迁移、审计、补处理更方便

## 多媒体高级功能建议

## COS 内置能力边界

先回答一个关键问题：COS 并不是“所有媒体都有内置预览图方案”。严格说，依赖的是 COS + 数据万象（CI）能力，而且不同媒体类型支持方式不同。

### 1. 图片

图片是 COS 里最成熟的一类：

- 支持基于 URL 参数或样式规则做缩放、裁剪、格式转换
- 支持转成 `webp`
- 很适合做按需预览图

但要注意：

- 你现在用的是私有桶，前端不能直接拼一个原始 URL 再随便加处理参数
- 服务端如果返回签名 URL，需要确认签名和处理参数的拼接方式一致
- 如果后面要接 CDN，缓存键也要把处理参数算进去

结论：

- 图片预览可以利用 COS/CI 能力
- 但 Phase 1 不建议先把“图片按需处理 URL 生成逻辑”做成业务主链路
- 更稳的做法是 Phase 2 直接固化生成 `image_preview.webp`

### 2. 视频

视频没有一个像图片那样统一、廉价、同步的“预览图方案”。常见内置能力是：

- 截帧生成封面
- 提交异步转码任务
- 输出 MP4、HLS 等转码结果

这里要分开看：

- “封面图”是可以做的
- “低码率预览视频”本质是转码产物，不是简单 URL 样式

结论：

- 视频封面适合继续保留
- 视频 preview 需要当成转码任务，不要按“图片样式”思路理解

### 3. 音频

音频更不存在“内置预览图”这回事。常见可用能力是：

- 转码为 `m4a`
- 获取元数据
- 配合处理链生成波形文件

结论：

- 音频 preview 的本质是“统一转码后的可播放版本”
- 波形是额外衍生数据，不是 COS 自动就会给你的成品

### 总结

如果把“预览”拆开，COS 能帮的程度是：

- 图片预览：强，适合做
- 视频封面：可以
- 视频预览视频：可以，但属于异步转码
- 音频预览：可以，但属于异步转码
- 音频波形：通常仍要你自己生成或由独立处理链生成

所以我的建议不变：

- Phase 1 只先做 COS 私有桶存储 + 签名 URL + 保留现有元数据流程
- 图片/视频/音频的“高级预览版本”放到 Phase 2 作为正式处理链

## 一、图片

### MVP

- 保留原图 `original`
- 生成 `image_preview`
  - 建议格式：`webp`
  - 宽度上限：`1600`
  - 质量：`80-85`
- 生成 `image_thumb`
  - 用于列表、通知、小卡片
  - 宽度：`320-480`

### 后续增强

- 支持 AVIF
- 支持占位图（blurhash / tiny preview）
- 支持基于设备 DPR 返回不同尺寸

### 说明

图片是最适合优先做“原图 + 预览图”分离的类型，因为收益最高、实现最稳、对前端侵入最小。

## 二、视频

### MVP

- 保留原视频 `original`
- 继续生成 `video_poster`
  - jpg/webp 均可，建议先 jpg 保守
- 生成 `video_preview`
  - 720p 或 1280 宽上限
  - H.264 + AAC
  - 低码率版本供移动端播放

### 后续增强

- HLS 多码率转码
- 指定时间点封面选择
- 短预览片段（3-6 秒）
- 审核、水印、转封装

### 说明

视频不要只做“封面”，否则对象存储的收益只是搬家，没有解决带宽与首屏成本。

## 三、录音

### MVP

- 保留原录音 `original`
- 生成统一播放格式 `audio_preview`
  - 优先 `m4a(aac)`
  - 解决浏览器兼容和体积问题
- 生成 `audio_waveform`
  - JSON 数组，供前端波形渲染

### 后续增强

- 语音转写
- 降噪/音量归一化
- 音频切片与流式播放

### 说明

录音的“高级功能”不一定是缩略图，而是：

- 统一编码
- 体积压缩
- 波形
- 时长和可播放性稳定

## 处理流水线建议

## 一、从同步上传改为“上传成功后异步处理”

Phase 2 的目标流程建议如下：

1. 客户端上传原文件
2. 服务端先落原文件到 provider
3. `media_assets` 写入 `processing_status = pending`
4. 投递处理任务
5. 后台 worker 生成 variants
6. 处理完成后写 `processing_status = ready`

原因：

- 图片压缩还可以同步做
- 视频转码、音频转码不适合放在 HTTP 请求内
- 后续接 COS CI、队列、重试都会更自然

## 二、建议引入媒体处理任务队列

可以先做轻量版：

- 数据库轮询 worker
- 或服务内定时扫描 `processing_status='pending'`

后续再升级：

- Redis + BullMQ
- 云消息队列

任务表不一定首期就上，但至少要有：

- `processing_status`
- `processing_error`
- `last_processed_at`

## 三、删除与清理策略同步升级

当前清理逻辑已经会删主文件和 `coverPath`。引入 variants 后，清理逻辑要改为：

- 删原文件对象
- 删所有 variant 对象
- 最后删数据库记录

这意味着现有清理实现需要从“删除两个路径”升级成“删除一个资产名下所有对象”。

## 推荐实施顺序

## Phase 1: COS 私有桶接入

目标：尽快把“私有桶 + 签名 URL + 现有上传流程迁移到 COS”做通。

范围：

- 扩展 `StorageProvider` 接口
- 新增 `TencentCosStorageProvider`
- 增加配置文件加载与校验
- `media_assets` 补充稳定 object 标识字段
- API 返回动态签名 URL
- 删除 `LocalStorageProvider` 和 `/uploads` 静态托管依赖
- 暂时保留 `cover_url/public_url` 字段用于兼容，但语义调整为“最近一次生成的访问 URL”或逐步废弃

这阶段不强行做完整 variants 表，重点是把底层存储模型从“本地公开文件”切到“COS 私有对象 + 动态签名访问”。

### Phase 1 推荐落地切法

1. 新增 COS 配置加载模块
2. 重写 `storage.interface.ts`，把核心标识收敛到 `objectKey`
3. 新增 `cos.storage.ts`
4. `media_assets` 增加 `storage_provider/bucket/object_key/etag`
5. `MediaService` 上传后保存稳定对象标识，不再依赖 `/uploads/...`
6. `getById`、帖子列表、通知列表等对外返回媒体 URL 的地方，统一动态签名
7. `main.ts` 去掉 `/uploads` 静态托管
8. 清理任务删除 COS 对象而不是本地文件

## Phase 2: 变体模型与异步处理

目标：把“高级功能”做成结构化能力，而不是零散字段。

范围：

- 新增 `media_asset_variants`
- 引入 `processing_status`
- 图片 `webp preview/thumb`
- 视频 `poster/mp4 preview`
- 录音 `m4a preview/waveform`
- 清理逻辑升级为删除全资产对象集合

## Phase 3: 直传与大文件优化

目标：解决大视频上传体验和服务端压力。

范围：

- 浏览器直传 COS
- STS 临时凭证或预签名上传
- 分片上传 / 断点续传
- 服务端只负责签发上传参数和落库确认

## 对当前代码的直接影响

优先会触达这些位置：

- [`storage.interface.ts`](apps/server/src/modules/media/storage/storage.interface.ts)
- [`storage.module.ts`](apps/server/src/modules/media/storage/storage.module.ts)
- [`local.storage.ts`](apps/server/src/modules/media/storage/local.storage.ts)
- [`media.service.ts`](apps/server/src/modules/media/media.service.ts)
- [`media.controller.ts`](apps/server/src/modules/media/media.controller.ts)
- [`packages/db/src/schema/media.ts`](packages/db/src/schema/media.ts)
- [`docs/deployment.md`](docs/deployment.md)
- [`docs/architecture.md`](docs/architecture.md)

另外，前端接口最终也应为 `processingStatus` 和 `variants` 做兼容准备：

- [`apps/web/src/api/media.api.ts`](apps/web/src/api/media.api.ts)
- [`packages/shared/src/types/media.types.ts`](packages/shared/src/types/media.types.ts)

## 我建议的最终路线

如果目标是“先做对，再做大”，建议按下面路线走：

1. 先把底层存储切到 COS 私有桶，并统一签名 URL 返回策略
2. 不把压缩/转码能力塞进 provider，而是单独留 `MediaProcessor` 演进位
3. Phase 1 保持现有 API 外形尽量兼容，快速完成 COS 接入
4. Phase 2 再上 `media_asset_variants`，正式支持图片/视频/录音预览版本
5. Phase 3 再做浏览器直传和分片上传

这条路线的优点是：

- 风险分层，容易上线
- 不会因为一开始追求“转码/预览一把梭”把模型做乱
- 先把“存得对、取得到、删得掉”打稳，再上处理链

## 待确认问题

开始实现前，建议先定这几件事：

- 签名 URL 是否统一 `8` 小时
- API 是否允许继续返回 `publicUrl/coverUrl`，但语义改为临时签名链接
- Phase 1 是否暂不要求历史数据自动迁移
- 是否接受上传后先只保留原文件与视频封面，预览变体留在 Phase 2

当前这些问题已经基本有答案，所以下一刀建议非常明确：

- Phase 1 只做 COS 私有桶接入、签名 URL、现有流程迁移
- Phase 2 增加图片 `webp preview`、视频 `mp4 preview`、音频 `m4a preview`
- Phase 3 再做浏览器直传与大文件上传优化
