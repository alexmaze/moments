# Moments 移动端技术选型

## Context

Moments 是一个开源、可自托管的私密社交圈应用，目前仅有 Web 端（React 19 + NestJS 11）。用户希望开发 Android + iOS 客户端，提供完整的原生体验，同时尽量复用现有 TypeScript 代码。

**开发者画像**: 个人独立开发者，主要 Web/TypeScript 背景，移动端经验有限。
**需求**: 推送通知、离线浏览、拍照/录像直接发帖、后台上传。

---

## 一、框架对比

### 评估矩阵

| 维度 | React Native (Expo) | Flutter | 原生 (SwiftUI + Compose) | Capacitor |
|---|---|---|---|---|
| **TS 代码复用** | ★★★★★ 直接 import `@moments/shared`，类型/Zod/工具函数零修改 | ★☆☆☆☆ Dart 语言，所有类型需重写 | ★☆☆☆☆ Swift/Kotlin 各写一份 | ★★★★★ 直接复用 Web 代码 |
| **React 经验迁移** | ★★★★★ 同为 React + hooks，TanStack Query / Zustand 直接可用 | ★★☆☆☆ Widget 树思维不同，需学 Dart | ★☆☆☆☆ 全新语言和范式 | ★★★★★ 就是 Web 技术 |
| **原生体验** | ★★★★☆ 原生组件渲染，60fps FlashList，手势系统成熟 | ★★★★★ 自绘引擎，动画流畅 | ★★★★★ 原生标杆 | ★★☆☆☆ WebView 包装，滚动/手势有差距 |
| **推送通知** | ★★★★★ `expo-notifications` + Expo Push Service，开箱即用 | ★★★★☆ `firebase_messaging`，需配 FCM | ★★★★★ 原生 API | ★★★☆☆ 需 Capacitor 插件 |
| **离线支持** | ★★★★☆ TanStack Query offlineFirst + expo-sqlite + MMKV | ★★★★☆ sqflite + Hive | ★★★★★ CoreData / Room | ★★☆☆☆ 有限 |
| **相机/媒体** | ★★★★☆ `expo-camera` + `expo-image-picker` + `expo-video` | ★★★★☆ `camera` + `image_picker` | ★★★★★ 原生 API | ★★★☆☆ 插件支持 |
| **后台上传** | ★★★☆☆ `react-native-background-upload`（需 dev client） | ★★★☆☆ `flutter_uploader` | ★★★★★ NSURLSession / WorkManager | ★★☆☆☆ 受限 |
| **Monorepo 集成** | ★★★★☆ Metro 支持 pnpm workspace（需配置） | ★★☆☆☆ Dart 独立工具链，难融入 pnpm | ★☆☆☆☆ Xcode/Gradle 独立项目 | ★★★★☆ Web 技术原生融合 |
| **独立开发者效率** | ★★★★★ 一套代码两平台 + EAS 云构建 + OTA 更新 | ★★★★☆ 一套代码两平台，但学习曲线 | ★★☆☆☆ 两套代码两个 IDE | ★★★★☆ Web 经验直接用 |
| **综合评分 (/50)** | **42** | **31** | **25** | **32** |

### 推荐: React Native + Expo Managed Workflow

核心理由:

1. **代码复用收益最大化**: `@moments/shared` 的所有类型定义、Zod 校验器、工具函数（hashtag 解析、mention 解析、baby-age 计算）可零修改直接 import。API client 模式（axios + interceptor + response unwrap）可抽取为共享包后双端复用。

2. **知识迁移无缝**: React + hooks + TanStack Query + Zustand 的整套开发模式完全一致。你不需要学新语言，只需要学移动端的 UI 原语（`View` / `Text` / `ScrollView` 替代 `div` / `span`）。

3. **Expo Managed Workflow 的独立开发者优势**:
   - **EAS Build**: 云端构建 iOS/Android 二进制包，不需要本地 Xcode 或 Android Studio 环境（但有更好）
   - **EAS Update**: OTA 热更新 JS bundle，修 bug 不需要重新提交 App Store 审核
   - **expo-notifications**: 封装了 APNs + FCM 的统一推送 API，对自托管 OSS 项目友好（使用者不需要配 Apple 推送证书）

4. **淘汰理由**:
   - **Flutter**: 需要学 Dart，所有 TypeScript 类型和业务逻辑必须重写，与现有 monorepo 无法共享代码
   - **原生开发**: 两套代码库维护成本过高，个人开发者不可持续
   - **Capacitor**: WebView 渲染在社交信息流场景（大量图片、视频缩略图、无限滚动）的性能和交互体验有明显差距

---

## 二、推荐架构

### 2.1 Monorepo 结构变更

```
moments/
├── apps/
│   ├── web/                     # 现有 React SPA
│   ├── server/                  # 现有 NestJS API
│   └── mobile/                  # 新增: Expo 应用
│       ├── app/                 # Expo Router 文件路由
│       │   ├── (auth)/          # 未认证路由组
│       │   │   ├── login.tsx
│       │   │   └── register.tsx
│       │   ├── (tabs)/          # 已认证 Tab 路由组
│       │   │   ├── _layout.tsx  # Bottom Tab Navigator
│       │   │   ├── index.tsx    # Feed (首页)
│       │   │   ├── explore.tsx  # 发现/搜索
│       │   │   ├── notifications.tsx
│       │   │   └── profile.tsx
│       │   ├── post/[id].tsx    # 帖子详情
│       │   ├── user/[username].tsx
│       │   ├── space/[slug].tsx
│       │   └── _layout.tsx      # Root layout (auth guard)
│       ├── components/          # RN 组件
│       ├── hooks/               # RN 特有 hooks
│       ├── stores/              # Zustand stores (同 web 模式)
│       ├── lib/                 # API client / 上传 / 推送 / 存储
│       ├── constants/           # 主题 token
│       ├── app.json
│       ├── metro.config.js
│       └── tsconfig.json
├── packages/
│   ├── shared/                  # 现有 (无需改动)
│   ├── api-client/              # 新增: 从 web 抽取的共享 API client
│   │   ├── src/
│   │   │   ├── client.ts        # axios 实例工厂 (injectable getToken)
│   │   │   ├── auth.api.ts
│   │   │   ├── posts.api.ts
│   │   │   ├── media.api.ts
│   │   │   ├── ... (其余 API 模块)
│   │   │   └── index.ts
│   │   └── package.json
│   ├── config/                  # 现有
│   └── db/                      # 现有
├── .npmrc                       # 新增: node-linker=hoisted (Metro 需要)
└── pnpm-workspace.yaml          # 更新: 已包含 apps/* 和 packages/*
```

### 2.2 关键库选型

| 关注点 | 库 | 理由 |
|---|---|---|
| **路由导航** | Expo Router v4 | 文件路由，自动 deep linking，基于 React Navigation v7 |
| **服务端状态** | TanStack Query v5 | 与 Web 端一致，`offlineFirst` 模式支持离线 |
| **客户端状态** | Zustand v5 | 与 Web 端一致，持久化层换为 MMKV |
| **列表渲染** | FlashList (`@shopify/flash-list`) | 图片密集型 Feed 性能远优于 FlatList |
| **图片加载** | `expo-image` | 磁盘/内存缓存、blurhash 占位、优先级加载 |
| **视频播放** | `expo-video` | SDK 50+ 硬件加速播放 |
| **相机** | `expo-camera` + `expo-image-picker` | 拍照/录像 + 相册选择 |
| **推送通知** | `expo-notifications` | Expo Push Service 统一封装 APNs/FCM |
| **KV 存储** | `react-native-mmkv` | C++ 内存映射，比 AsyncStorage 快 10-100x |
| **结构化缓存** | `expo-sqlite` + Drizzle ORM | 类型安全的离线 Feed 缓存 |
| **安全存储** | `expo-secure-store` | JWT 存 iOS Keychain / Android Keystore |
| **后台上传** | `react-native-background-upload` | iOS NSURLSession / Android WorkManager |
| **网络状态** | `expo-network` | 驱动 TanStack Query online/offline 状态 |
| **触觉反馈** | `expo-haptics` | 点赞、下拉刷新等交互反馈 |

### 2.3 代码复用策略

**直接复用 (零修改)**:
- `@moments/shared` 全部内容: 所有 DTO 类型、Zod 校验器、工具函数
- 查询 key 工厂模式、乐观更新逻辑

**抽取为共享包 `@moments/api-client`**:
- 现有 `apps/web/src/api/` 下 9 个 API 模块，改造为平台无关
- API client 工厂接受 `getToken` 函数注入:

```ts
// packages/api-client/src/client.ts
export function createApiClient(options: {
  baseURL: string;
  getToken: () => Promise<string | null>;
  onUnauthorized: () => void;
}) { ... }

// Web 端使用:
createApiClient({
  baseURL: '/api',
  getToken: async () => useAuthStore.getState().token,
  onUnauthorized: () => useAuthStore.getState().clearAuth(),
})

// Mobile 端使用:
createApiClient({
  baseURL: 'https://your-server.com/api',
  getToken: () => SecureStore.getItemAsync('jwt-token'),
  onUnauthorized: () => { /* 导航到登录页 */ },
})
```

**需要 Mobile 重新实现的部分**:

| Web 实现 | Mobile 对应 | 复杂度 |
|---|---|---|
| CSS/Tailwind 样式 | StyleSheet / NativeWind | 中 |
| `<img>` / `<video>` | `expo-image` / `expo-video` | 低 |
| `<input type="file">` | `expo-image-picker` | 低 |
| `localStorage` | `expo-secure-store` (JWT) + MMKV (偏好) | 低 |
| `IntersectionObserver` | FlashList `onEndReached` | 低 |
| Lexical 富文本编辑器 | 简化的 TextInput + mention 弹窗 | 中高 |
| `window.matchMedia` (暗色) | React Native `useColorScheme()` | 低 |

---

## 三、后端改造需求

### 3.1 Refresh Token (必需)

当前 7 天 JWT 无刷新机制，移动端用户会频繁遇到「打开 App 后被登出」的体验问题。

**方案**:
- Access Token: 15 分钟有效期
- Refresh Token: 90 天有效期，存数据库，可撤销

**新增表**: `refresh_tokens`（id, user_id, token_hash, device_hint, expires_at, last_used）
**新增端点**:
- `POST /api/auth/refresh` — 刷新令牌
- `POST /api/auth/logout` — 撤销 refresh token
- `GET /api/auth/sessions` — 列出活跃设备（后续可做）
- `DELETE /api/auth/sessions/:id` — 撤销指定设备

### 3.2 推送通知基础设施

**新增表**: `device_tokens`（id, user_id, expo_push_token, platform, last_seen）
**新增端点**:
- `POST /api/devices/register` — 注册设备推送 token
- `DELETE /api/devices/unregister` — 注销设备

**后端推送服务**: 使用 `expo-server-sdk`（npm 包），在现有 `NotificationsService` 的事件触发点集成推送调用。

### 3.3 CORS 配置

React Native 的网络请求是原生请求（非浏览器），**生产环境不受 CORS 限制**。但开发环境（Expo Web 预览）建议配置:

```ts
app.enableCors({
  origin: ['http://localhost:5173', 'https://your-domain.com'],
});
```

### 3.4 改造优先级

| 改造项 | 优先级 | 工作量 |
|---|---|---|
| Refresh Token 机制 | 高 (Phase 1 必需) | ~1 天 |
| 设备 Token 注册/注销端点 | 高 (Phase 3) | 2-3 小时 |
| `expo-server-sdk` 推送服务 | 高 (Phase 3) | 4-6 小时 |
| 各事件触发点接入推送 | 高 (Phase 3) | 4-6 小时 |
| CORS 配置 | 低 | 30 分钟 |
| 会话管理端点 | 低 (锦上添花) | 3-4 小时 |

---

## 四、分阶段实施路线

### Phase 1 — 基础框架 + 只读 Feed (第 1-3 周)

- Monorepo 脚手架: Expo 项目 + Metro 配置 + `.npmrc`
- 抽取 `@moments/api-client` 共享包
- 后端: 实现 Refresh Token 机制
- 认证流程: 登录/注册页 + JWT 安全存储
- Feed 页: FlashList + PostCard + 图片展示 + 分页加载 + 下拉刷新
- 个人主页: 头像、简介、帖子列表

**交付物**: TestFlight + Android 内部测试版，现有用户可登录并浏览 Feed

### Phase 2 — 核心交互 (第 4-6 周)

- 发帖: 文字 + 图片/视频选择 + 两阶段媒体上传 + 上传进度
- 拍照/录像: `expo-camera` 直接拍摄
- 点赞: 乐观更新
- 评论: 列表 + 发布 + 回复
- @ 提及: 输入时搜索建议
- Hashtag: 点击跳转
- Space 浏览: 列表 + 详情 + 加入/退出

**交付物**: 核心功能对齐 Web 端，公开测试

### Phase 3 — 原生特性 (第 7-10 周)

- 推送通知: 后端设施 + 移动端注册 + 深链接跳转
- 后台上传: 队列管理 + 断点续传 + 状态指示
- 离线浏览: TanStack Query offlineFirst + SQLite 缓存 + 离线 Banner
- 草稿保存: MMKV 持久化未完成的帖子

**交付物**: 提交 App Store + Play Store 审核的 v1.0

### Phase 4 — 打磨 + 开源就绪 (第 11-14 周)

- 触觉反馈、骨架屏加载、空状态设计
- 自托管者构建文档 (`BUILDING.md`)
- EAS Build CI 集成 (GitHub Actions)
- 错误边界 + Sentry 崩溃上报
- App Store / Play Store 素材准备

---

## 五、风险与缓解

| 风险 | 可能性 | 缓解措施 |
|---|---|---|
| Metro 在 pnpm workspace 下解析失败 | 中 | `.npmrc` 设置 `node-linker=hoisted`，CI 中验证构建 |
| Expo SDK 大版本升级 breaking change | 中 | 每季度预留 2-4 小时跟进迁移指南 |
| 后台上传在 iOS 低电量模式下不可靠 | 中 | SQLite 队列持久化 + 重试 + 状态可见 |
| 富文本编辑器 (Lexical) 无 RN 版本 | 已知 | 移动端简化为 TextInput + 独立 mention/tag 弹窗 |
| Apple 审核被拒 | 低 | 社交应用无特殊合规风险，准备好隐私政策即可 |
