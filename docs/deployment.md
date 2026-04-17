# 部署指南

## Docker 生产部署

### 前置要求

- Docker 或 Podman
- Docker Compose

### 快速部署

```bash
cd docker

# 设置必需的环境变量
export JWT_SECRET="your-secret-key-at-least-32-chars"
export DB_PASSWORD="your-secure-db-password"
export BASE_URL="https://your-domain.com"  # 可选，默认 http://localhost:3000

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
| `BASE_URL` | 否 | `http://localhost:3000` | 对外访问地址，影响媒体文件 URL |
| `UPLOAD_DIR` | 否 | `/app/uploads` | 媒体存储目录（Docker 内挂载为 volume） |
| `PORT` | 否 | `3000` | 服务端口 |
| `NODE_ENV` | 否 | `production` | 环境标识 |

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

### docker-compose.prod.yml 服务

| 服务 | 镜像 | 端口 | 说明 |
|---|---|---|---|
| `db` | postgres:16-alpine | 不暴露 | PostgreSQL，数据持久化到 `postgres_data` volume |
| `app` | 自建（Dockerfile） | 3000 | NestJS 应用，serve 前端 SPA + API + 媒体文件 |

### 数据持久化

两个 Docker volume：
- `postgres_data` — 数据库文件
- `uploads_data` — 用户上传的媒体文件

### 备份

```bash
# 数据库备份
docker compose -f docker-compose.prod.yml exec db pg_dump -U moments moments > backup.sql

# 数据库恢复
cat backup.sql | docker compose -f docker-compose.prod.yml exec -T db psql -U moments moments

# 媒体文件备份
docker cp $(docker compose -f docker-compose.prod.yml ps -q app):/app/uploads ./uploads-backup
```

### 更新部署

```bash
cd docker
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

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

注意设置 `BASE_URL` 为 HTTPS 地址，否则媒体文件 URL 会生成 HTTP 链接。
