# Papyrus

把多个 GitHub repo 里的 markdown 笔记，零运维地聚合成一个静态博客。

## 本地开发

```bash
pnpm install
cp .env.example .env  # 填入 GITHUB_TOKEN（避免 rate limit）
pnpm dev              # 注意：dev 不会自动跑 prebuild，先跑一次：
pnpm tsx scripts/prebuild.ts
pnpm dev
```

## 构建

```bash
pnpm build
pnpm preview   # 本地预览
```

构建过程：prebuild (拉取 GitHub) → astro build → pagefind 建索引。

## 配置

编辑 `papyrus.config.json`：

```json
{
  "site": { "name": "...", "description": "...", "url": "..." },
  "repos": [
    { "slug": "tech-notes", "title": "...", "description": "...",
      "icon": "📘", "source": "github.com/me/tech-notes", "branch": "main" }
  ]
}
```

约束：`slug` 在站内唯一；`source` 必须公开 repo。

## 部署到 Vercel

1. Push 本仓库到 GitHub
2. 在 Vercel 新建项目，导入该 repo
3. 环境变量：`GITHUB_TOKEN`（值为一个 PAT，`public_repo` 权限）
4. Build Command 保持默认（`pnpm build`），Output Directory 设 `dist`
5. 在 Vercel 项目 → Settings → Git → Deploy Hooks 创建一个 hook，复制 URL

## 设置自动更新（每个内容 repo 一次性配置）

对每个 `papyrus.config.json` 中列出的 repo：

1. 打开该 repo → Settings → Webhooks → Add webhook
2. Payload URL：上一步 Vercel Deploy Hook URL
3. Content type：`application/json`
4. Events：仅勾选 `push`

效果：任何 push 到该 repo → 1–3 分钟内 Vercel 触发新构建 → 站点更新。

## 定时兜底

在 Vercel 项目里另设一个 daily cron deploy（Project → Settings → Cron Jobs），防止漏 webhook。

## 加入新 repo

编辑 `papyrus.config.json` 添加一项 → 给该 repo 配 webhook → push 任意文件触发首次构建。

## 验收清单

部署后人工跑一遍：

- [ ] 首页 N 个 repo 卡片显示正确
- [ ] 暗色模式切换无白闪
- [ ] 任意 repo 任意文章页能打开，代码高亮 / 数学 / 图片都对
- [ ] ⌘K 搜索能搜到内容
- [ ] 在某 repo push 新 .md → 1-3 分钟后站点可访问
