---
name: release
description: 发布新版本流程。当用户说"发布新版本"、"release"时触发。支持语义化版本：patch/修订版本(z++)、minor/次版本(y++)、major/主版本(x++)。未指定时询问用户选择。
license: MIT
---

## 版本发布流程

当用户请求发布新版本时，按以下步骤执行：

### 1. 获取最新版本号

```bash
git fetch --tags
git tag --sort=-v:refname | head -5
```

取最新 tag，格式为 `v{x.y.z}`。

### 2. 确定版本类型

根据用户指令确定版本递增规则：

| 用户说法 | 版本类型 | 递增规则 | 示例 |
|---------|---------|---------|------|
| patch、修订版本 | Patch | z++ | v0.1.2 → v0.1.3 |
| minor、次版本 | Minor | y++, z=0 | v0.1.2 → v0.2.0 |
| major、主版本 | Major | x++, y=0, z=0 | v0.1.2 → v1.0.0 |

**如果用户未明确指定版本类型，必须先询问：**

```
当前版本：v0.1.2
请选择新版本类型：
1. Patch (修订版本) → v0.1.3 — 修复 bug、小改动
2. Minor (次版本) → v0.2.0 — 新功能、向后兼容
3. Major (主版本) → v1.0.0 — 重大变更、不兼容改动
```

等待用户选择后再继续。

### 3. 提交当前改动

如果有未提交的改动，先提交：

```bash
git add -A
git commit -m "<commit message>"
```

### 4. 创建并推送 tag

```bash
git tag <new-version>
git push origin main
git push origin <new-version>
```

### 注意事项

- Tag 触发 GitHub Actions 自动构建 Docker 镜像
- 镜像版本号由 `APP_VERSION` build arg 注入
- 确保 Dockerfile 中 ARG 正确参与缓存计算
- 遵循语义化版本规范：https://semver.org/lang/zh-CN/
