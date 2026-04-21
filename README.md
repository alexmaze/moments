# Moments - 近况

一个开源、支持私有部署的小圈子动态分享平台。

## 简介

近况专注于"小圈子近况分享"这一核心场景，支持多账号、文字/图片/视频/语音混合发帖，以及点赞、评论、帖子编辑等基础互动能力。项目强调轻量、可私有部署、易扩展，为后续 AI 总结、内容分析和关系洞察能力预留空间。

当前帖子编辑交互：
- 作者可从帖子卡片进入详情页编辑模式（`/posts/:id?edit=1`）
- 编辑区复用快捷发表器样式，支持回填正文、附件和原始录音
- 编辑后会重算 `#话题` 与 `@提及`，并正确清理被替换的媒体引用

## 技术栈

| 层面 | 技术 |
|---|---|
| 前端 | React 19 + Vite + Tailwind CSS v4 + TanStack Query |
| 后端 | NestJS + Drizzle ORM + PostgreSQL 16 |
| 认证 | JWT (Passport.js) |
| 媒体 | 本地存储 + ffmpeg 视频封面抽帧 |
| 工程 | pnpm workspaces + Turborepo |
| 部署 | Docker 单容器 |

## 快速开始

```bash
# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env  # 编辑 DATABASE_URL 和 JWT_SECRET

# 启动数据库 + 迁移
docker compose up db -d
pnpm db:migrate

# 启动开发服务
pnpm dev
# 前端: http://localhost:5173
# 后端: http://localhost:3000
```

## 文档

| 文档 | 说明 |
|---|---|
| [产品需求文档](docs/prd.md) | MVP v1 完整 PRD |
| [系统架构](docs/architecture.md) | 技术架构、认证流程、媒体上传流程 |
| [API 参考](docs/api.md) | 全部 API 端点文档 |
| [数据库设计](docs/database.md) | 表结构、ER 关系、索引 |
| [本地开发](docs/development.md) | 开发环境搭建、常用命令 |
| [部署指南](docs/deployment.md) | Docker 生产部署、环境变量、备份 |
| [媒体清理方案](docs/media-cleanup.md) | 废弃媒体生命周期、定时回收与配置项 |

## 项目结构

```
moments/
├── apps/
│   ├── web/          # React SPA 前端
│   └── server/       # NestJS API 后端
├── packages/
│   ├── shared/       # 共享类型 & 校验器
│   └── db/           # Drizzle ORM schema & 迁移
├── docs/             # 项目文档
└── docker/           # Docker 配置
```
