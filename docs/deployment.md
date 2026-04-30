# 部署指南

## Docker 生产部署

### 前置要求

- Docker 或 Podman
- Docker Compose
- 腾讯云 COS 私有桶
- 一份存储配置文件，参考 [`config/storage.example.json`](/Users/alex/Dev/workspace/alex/moments/config/storage.example.json)

### 快速部署

```bash
cd docker

# 设置必需的环境变量
export JWT_SECRET="your-secret-key-at-least-32-chars"
export DB_PASSWORD="your-secure-db-password"
export TENCENT_COS_SECRET_ID="your-secret-id"
export TENCENT_COS_SECRET_KEY="your-secret-key"

# 准备存储配置文件
mkdir -p ../config
cp ../config/storage.example.json ../config/storage.json

# 启动
docker compose -f docker-compose.prod.yml up -d
```

首次启动会自动构建镜像并初始化数据库。

### 环境变量

| 变量 | 必需 | 默认值 | 说明 |
|---|---|---|---|
| `JWT_SECRET` | **是** | 无 | JWT 签名密钥，至少 32 字符 |
| `DB_USER` | 否 | `moments` | PostgreSQL 用户名 |
| `DB_PASSWORD` | 否 | `moments_prod` | PostgreSQL 密码，生产环境务必修改 |
| `DATABASE_URL` | 否 | 自动拼接 | 数据库连接字符串（Docker 内部自动生成） |
| `STORAGE_CONFIG_FILE` | 否 | `config/storage.json` | 存储配置文件路径 |
| `TENCENT_COS_SECRET_ID` | **是** | 无 | COS SecretId，用于配置文件插值 |
| `TENCENT_COS_SECRET_KEY` | **是** | 无 | COS SecretKey，用于配置文件插值 |
| `MEDIA_CLEANUP_ENABLED` | 否 | `true` | 是否启用废弃媒体后台清理任务 |
| `MEDIA_CLEANUP_RETENTION_DAYS` | 否 | `7` | `orphaned` 媒体保留天数 |
| `MEDIA_CLEANUP_BATCH_SIZE` | 否 | `100` | 每轮清理的最大条数 |
| `MEDIA_CLEANUP_DRY_RUN` | 否 | `false` | 只输出命中日志，不实际删除文件和数据库记录 |
| `PORT` | 否 | `3000` | 服务端口 |
| `NODE_ENV` | 否 | `production` | 环境标识 |

### 存储配置文件

当前生产环境只支持腾讯云 COS 私有桶。服务端在返回媒体数据时会动态签发临时 URL，默认有效期 8 小时。

部署前需要在宿主机准备：

- `config/storage.json`
- `TENCENT_COS_SECRET_ID`
- `TENCENT_COS_SECRET_KEY`

示例：

```json
{
  "storage": {
    "driver": "tencent-cos",
    "signedUrlTtlSeconds": 28800,
    "keyPrefix": "moments",
    "tencentCos": {
      "secretId": "${TENCENT_COS_SECRET_ID}",
      "secretKey": "${TENCENT_COS_SECRET_KEY}",
      "region": "ap-shanghai",
      "bucket": "your-bucket-1250000000",
      "useHttps": true,
      "timeoutMs": 30000
    }
  }
}
```

### Dockerfile 多阶段构建

```
Stage 1 (deps)    → node:22-alpine, pnpm install --frozen-lockfile
Stage 2 (builder) → 复制源码, pnpm turbo run build（构建全部 4 个包）
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

如果准备先观察命中范围，再正式启用删除，可先设置：

```env
MEDIA_CLEANUP_DRY_RUN=true
```

确认日志输出符合预期后，再改回 `false` 并重启应用。

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
