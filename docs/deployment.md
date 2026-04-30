# 部署指南

## Docker 生产部署

### 前置要求

- Docker 或 Podman
- Docker Compose
- 腾讯云 COS 私有桶

### 快速部署

```bash
cd docker

# 准备配置文件
cp ../config.example.yaml ../config.yaml
```

编辑 `../config.yaml`，填入实际值：

```yaml
app:
  nodeEnv: production

database:
  url: postgresql://moments:your-secure-db-password@db:5432/moments

auth:
  jwtSecret: your-secret-key-at-least-32-chars
  adminUsernames:
    - admin

storage:
  driver: tencent-cos
  tencentCos:
    secretId: your-cos-secret-id
    secretKey: your-cos-secret-key
    region: ap-shanghai
    bucket: your-bucket-1250000000
```

启动：

```bash
docker compose -f docker-compose.prod.yml up -d
```

首次启动会自动构建镜像并初始化数据库。

### 配置文件

所有配置统一存放在项目根目录的 `config.yaml`（gitignored）。Docker Compose 将该文件只读挂载到容器内 `/app/config.yaml`。

完整配置结构请参考 [`config.example.yaml`](../config.example.yaml)。

| 配置项 | 必需 | 默认值 | 说明 |
|---|---|---|---|
| `app.port` | 否 | `3000` | 服务端口 |
| `app.nodeEnv` | 否 | `development` | 生产环境设为 `production` |
| `database.url` | **是** | — | PostgreSQL 连接字符串 |
| `auth.jwtSecret` | **是** | — | JWT 签名密钥，至少 32 字符 |
| `auth.adminUsernames` | 否 | `[]` | 管理员用户名列表（YAML 数组） |
| `storage.tencentCos.secretId` | **是** | — | COS SecretId |
| `storage.tencentCos.secretKey` | **是** | — | COS SecretKey |
| `storage.tencentCos.region` | **是** | — | COS 地域 |
| `storage.tencentCos.bucket` | **是** | — | COS 桶名 |
| `media.cleanup.enabled` | 否 | `true` | 是否启用废弃媒体后台清理任务 |
| `media.cleanup.retentionDays` | 否 | `7` | `orphaned` 媒体保留天数 |
| `media.cleanup.pendingMaxAgeHours` | 否 | `24` | `pending` 上传超过该时间未绑定则清理 |
| `media.cleanup.batchSize` | 否 | `100` | 每轮清理的最大条数 |
| `media.cleanup.dryRun` | 否 | `false` | 只输出命中日志，不实际删除 |

Docker Compose 中 `db` 服务的 `POSTGRES_USER` / `POSTGRES_PASSWORD` 仍可通过 shell 变量设置（默认 `moments` / `moments_prod`），用于 PostgreSQL 自身初始化。

### Dockerfile 多阶段构建

```
Stage 1 (deps)    → node:22-alpine, pnpm install --frozen-lockfile
Stage 2 (builder) → 复制源码, pnpm turbo run build（构建全部包）
Stage 3 (runner)  → node:22-alpine + ffmpeg, 仅复制:
                     - apps/server/dist → /app/dist
                     - apps/web/dist → /app/public（NestJS serve 静态资源）
                     - node_modules（运行时依赖）
```

最终镜像包含 ffmpeg（用于视频封面抽帧）。

应用启动后会在服务端进程内启动一个轻量后台 worker，默认每小时扫描一次过期 `orphaned` 媒体。删除前会再次校验帖子附件、用户头像、空间封面三类引用，避免误删刚被重新绑定的资源。

### docker-compose.prod.yml 服务

| 服务 | 镜像 | 端口 | 说明 |
|---|---|---|---|
| `db` | postgres:16-alpine | 不暴露 | PostgreSQL，数据持久化到 `postgres_data` volume |
| `app` | 自建（Dockerfile） | 3000 | NestJS 应用，serve 前端 SPA + API |

### 数据持久化

当前应用内只持久化数据库：

- `postgres_data` — 数据库文件

媒体文件保存在腾讯云 COS，不再挂载本地上传目录 volume。

### 备份

```bash
# 数据库备份
docker compose -f docker-compose.prod.yml exec db pg_dump -U moments moments > backup.sql

# 数据库恢复
cat backup.sql | docker compose -f docker-compose.prod.yml exec -T db psql -U moments moments
```

媒体文件备份、版本策略、生命周期规则请通过 COS 控制台或对象存储备份体系处理。

### 更新部署

```bash
cd docker
git pull
pnpm db:migrate
docker compose -f docker-compose.prod.yml up -d --build
```

如果准备先观察命中范围，再正式启用删除，可在 `config.yaml` 中设置：

```yaml
media:
  cleanup:
    dryRun: true
```

确认日志输出符合预期后，改回 `false` 并重启应用。

### 反向代理（可选）

生产环境建议在前面加 Nginx/Caddy 做 HTTPS 终止：

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    client_max_body_size 500m;  # 匹配媒体上传限制

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

媒体访问不再由应用通过 `/uploads/*` 静态托管，而是由后端 API 返回 COS 私有桶签名 URL。
