# 本地开发指南

## 前置要求

- Node.js 22+
- pnpm 10+
- PostgreSQL 16（Docker/Podman 或本地安装）
- ffmpeg（可选，视频封面抽帧需要）

## 安装

```bash
git clone <repo-url> moments
cd moments
pnpm install
```

## 环境配置

```bash
cp config.example.yaml config.yaml
```

编辑 `config.yaml`，至少设置：

```yaml
database:
  url: postgresql://moments:moments_dev@localhost:5432/moments

auth:
  jwtSecret: dev_secret_at_least_32_characters_long

storage:
  tencentCos:
    secretId: your-dev-secret-id
    secretKey: your-dev-secret-key
    region: ap-shanghai
    bucket: your-bucket-name
```

如需验证废弃媒体回收，可在 `media.cleanup` 下调整：

```yaml
media:
  cleanup:
    enabled: true
    retentionDays: 7
    pendingMaxAgeHours: 24
    batchSize: 100
    dryRun: false       # 只打日志，不删文件和数据库记录
```

`config.yaml` 已被 gitignore，不会提交到仓库。

## 启动数据库

用 Docker/Podman：

```bash
docker compose up db -d
```

或用已有 PostgreSQL，确保 `config.yaml` 中 `database.url` 指向正确地址。

## 数据库迁移

```bash
# 应用迁移（首次或 schema 变更后）
pnpm db:migrate

# 查看数据（Drizzle Studio）
pnpm db:studio
```

## 启动开发服务

```bash
pnpm dev
```

Turborepo 同时启动：
- **后端** NestJS: `http://localhost:3000`（API 前缀 `/api`）
- **前端** Vite: `http://localhost:5173`（proxy `/api` → 3000）

媒体访问现在直接使用接口返回的 COS 签名 URL，不再通过本地 `/uploads` 静态目录代理。

访问 `http://localhost:5173` 开始使用。

## 常用命令

| 命令 | 说明 |
|---|---|
| `pnpm dev` | 启动全部开发服务 |
| `pnpm build` | 构建全部包 |
| `pnpm db:generate` | 修改 schema 后生成迁移 SQL |
| `pnpm db:migrate` | 应用数据库迁移 |
| `pnpm db:studio` | 打开 Drizzle Studio（数据浏览器） |
| `pnpm --filter @moments/server dev` | 仅启动后端 |
| `pnpm --filter @moments/web dev` | 仅启动前端 |

## 数据库迁移工作流

修改 `packages/db/src/schema/` 中的表定义后：

```bash
# 1. 生成迁移文件
pnpm db:generate
# → 生成 packages/db/src/migrations/XXXX_xxx.sql

# 2. 审查生成的 SQL
cat packages/db/src/migrations/XXXX_*.sql

# 3. 应用迁移
pnpm db:migrate
```

本次对象存储 Phase 1 落地后，拉取最新代码必须执行一次 `pnpm db:migrate`，以补齐：
- `media_assets.orphaned_at`
- `media_assets.last_cleanup_attempt_at`
- `media_assets.cleanup_error`
- `media_assets.storage_provider`
- `media_assets.bucket`
- `media_assets.object_key`
- `media_assets.etag`

## 包依赖关系

```
@moments/shared   ← 共享类型 & Zod 校验器（无外部依赖）
     ↑
@moments/config   ← YAML 配置加载 + 类型定义
     ↑
@moments/db       ← Drizzle schema + 迁移 + DB client
     ↑
@moments/server   ← NestJS API（依赖 shared + config + db）
@moments/web      ← React SPA（依赖 shared，开发时 proxy 到 server）
```

构建顺序由 Turborepo 自动处理：shared → config → db → server/web 并行。

## 创建测试账号

注册接口开放，可通过 API 或前端注册页创建：

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","displayName":"Test User","password":"password123"}'
```
