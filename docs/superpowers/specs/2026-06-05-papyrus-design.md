# Papyrus — 设计文档

> 日期：2026-06-05
> 状态：草案，已与用户在 brainstorming 阶段确认

## 1. 项目目标与定位

**一句话**：把分散在多个 GitHub repo 里的 markdown 笔记，零运维地聚合成一个静态站点博客，纯阅读，不带编辑。

**核心用户故事**：

1. 我有若干 GitHub repo（例：`tech-notes` / `reading` / `life` / `algo` / `papers` / `talks`），每个里面有一堆 .md 文件，可能还嵌套目录。
2. 我希望一个统一的 web 站点把它们都展示出来：首页是各 repo 的入口卡片，点进去是该 repo 的文章列表（树状导航），点文章是三栏阅读视图（左 repo 树 + 中正文 + 右 TOC）。
3. 我在任何已配置的 repo 里 push 新 .md，几分钟内站点自动更新，不需要手动跑构建。
4. 全程不需要数据库、不需要后端服务、不需要 CMS。

**明确不做（YAGNI）**：

- ❌ 在线编辑 markdown
- ❌ 用户登录 / 评论 / 点赞 / 阅读量统计
- ❌ RSS / 邮件订阅
- ❌ Mermaid 流程图
- ❌ 私有 repo 支持（MVP 仅 public repo）
- ❌ 多语言 i18n
- ❌ 移动端适配（仅 PC 浏览器，目标视口 ≥ 1280px）

## 2. 技术栈

| 项 | 选择 | 理由 |
|---|---|---|
| 框架 | **Astro** | 内容站首选；默认零 JS；content collections 原生支持 markdown；生态完善（Shiki/KaTeX/Pagefind 集成简单） |
| 样式 | **Tailwind CSS** | 开发快、易做精致细节；与 Astro 集成成熟 |
| 包管理 | **pnpm** | 标准选择 |
| 运行时 | Node ≥ 20 | 构建期；运行时（CDN）无后端 |
| 部署平台 | **Vercel** | 免费 tier、Astro 支持最好、deploy hook 现成 |
| 测试 | Vitest（单元）+ Playwright（E2E） | 现代标准 |

## 3. 架构与同步机制

### 3.1 整体数据流

```
[GitHub Repos]                  [构建 / 部署]                  [用户浏览器]
  tech-notes/  ─┐
  reading/      ├──► GitHub API ──► Astro Build ──► 静态 HTML ──► Vercel CDN ──► 用户
  life/         │     (Octokit)      (SSG + 搜索索引)
  ...          ─┘
        │
        └── push 事件 ──► Webhook ──► Vercel Deploy Hook ──► 触发新构建
```

构建产物为纯静态资产（HTML/CSS/JS + Pagefind 索引），部署到任何 CDN/对象存储皆可。**没有数据库，没有后端服务。**

### 3.2 配置文件：`papyrus.config.json`

格式：JSON（不含函数 / 注释；用 Zod schema 校验）。

```json
{
  "site": {
    "name": "Papyrus",
    "description": "我把笔记都搬到这里了",
    "url": "https://blog.example.com"
  },
  "repos": [
    {
      "slug": "tech-notes",
      "title": "技术笔记",
      "description": "前端、后端、基础设施的实战记录",
      "icon": "📘",
      "source": "github.com/me/tech-notes",
      "branch": "main"
    }
  ]
}
```

字段：

| 字段 | 必填 | 说明 |
|---|---|---|
| `site.name` | ✅ | 显示在 Logo / 标签页 |
| `site.description` | ✅ | meta description / OG description |
| `site.url` | ✅ | 站点根 URL（用于 sitemap、canonical） |
| `repos[].slug` | ✅ | URL 中的标识；必须唯一；只能 `[a-z0-9-]` |
| `repos[].title` | ✅ | 首页卡片标题 |
| `repos[].description` | ✅ | 首页卡片描述 |
| `repos[].icon` | ✅ | 首页卡片 emoji（单个 emoji 字符） |
| `repos[].source` | ✅ | `github.com/{owner}/{repo}` 格式 |
| `repos[].branch` | 可选 | 默认 `main` |

**约束**：用户只声明 repo 元数据，**repo 内有哪些 .md、目录如何嵌套、何时新增了文件 — 均由构建脚本自动扫描，配置文件无需维护。**

### 3.3 新增 / 改名 / 删除文件的同步逻辑

构建期对每个 repo 执行：

1. 调用 GitHub Trees API（`GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1`）拉取整棵文件树。
2. 过滤出所有 `*.md` 文件。
3. 对每个 .md：
   - 调用 Contents API 拉文件内容。
   - 调用 Commits API（`GET /repos/{owner}/{repo}/commits?path={path}&per_page=1`）取该路径的最后一次 commit 时间，作为文章日期。
4. 渲染为 HTML + 写入搜索索引。

→ **新增/改名/删除任意 .md，下一次构建后即生效，配置文件不动。**

### 3.4 构建触发（双路径叠加）

- **即时触发**：每个 repo 上配置 GitHub webhook（`push` 事件）→ 指向 Vercel Deploy Hook URL → 触发新构建。从 push 到站点更新约 1–3 分钟。一次性配置。
- **定时兜底**：Vercel 项目内配置每天一次的 cron deploy，防止漏 webhook / repo 被改名等。

### 3.5 GitHub API 速率限制

- 未认证：60 次/小时/IP；构建大概率超限。
- 认证（`GITHUB_TOKEN`，PAT 或 GitHub App）：5000 次/小时。
- 部署到 Vercel 时通过环境变量注入。本地开发用 `.env`。
- 单次构建 API 调用数估算：每 repo `1 (tree) + N (contents) + N (last commit) = 2N+1`。100 篇文章 ≈ 200+ 次调用，认证后绰绰有余。

## 4. URL 结构与页面类型

### 4.1 URL 设计

| URL | 页面 | 内容 |
|---|---|---|
| `/` | 首页 | Repo 网格 |
| `/[repo]` | Repo 入口 | 该 repo 文章列表（按时间倒序）+ 左侧树状导航 |
| `/[repo]/[...path]` | 文章页 | 三栏（左 repo 树 + 中正文 + 右 TOC） |
| `/404` | 找不到 | 静态 404 |

文章 URL = repo 内文件路径去掉 `.md` 后缀。例：`tech-notes/frontend/react-hooks.md` → `/tech-notes/frontend/react-hooks`。

repo 内改名 → URL 变化 → 旧链接 404（MVP 接受；后续可加 redirect manifest）。

### 4.2 页面 layouts（共 4 种）

- **HomeLayout**：site header + Hero + Repo Grid
- **RepoLayout**：site header + 左侧树状目录 + 右侧文章列表
- **ArticleLayout**：site header + 左 repo 树 + 中正文 + 右 TOC（三栏）
- **SearchModal**：⌘K 弹窗，不是独立路由

### 4.3 视口

设计目标：**≥ 1280px**。
最低优雅渲染：1024px。
< 1024px：不做适配，按原样渲染（可能拥挤或横向滚动），不主动阻断。

## 5. 内容处理流水线

每篇 .md 在构建期经过的处理链（remark/rehype）：

```
Raw .md
  ├── 1. 解析 frontmatter（可选 override 元数据：title / date / icon 等）
  ├── 2. 解析为 AST
  ├── 3. 语法高亮       Shiki（github-light + github-dark 双主题，构建期完成）
  ├── 4. 数学公式       remark-math + rehype-katex
  ├── 5. 图片处理       见 5.1
  ├── 6. 标题锚点       rehype-slug + rehype-autolink-headings（同时生成 TOC 数据）
  └── 7. 输出 HTML
```

### 5.1 图片处理

- **相对路径图片**（`![](./assets/x.png)`）：构建期下载到 `public/images/{repo}/{contentHash}.{ext}` → 由 Astro `<Image>` 优化（WebP + 多分辨率 srcset）。
- **绝对 URL 图片**：保留原 URL，添加 `loading="lazy"`。
- **点击放大**：[medium-zoom](https://github.com/francoischalifour/medium-zoom)（~3KB），对所有 `.prose img` 自动绑定。
- **失败兜底**：404 时显示灰色 placeholder + 文件名。

### 5.2 元数据来源（优先级）

| 字段 | 优先级 1 | 优先级 2（fallback） |
|---|---|---|
| 标题 | frontmatter `title` | **文件名（去掉 `.md`）** |
| 日期 | frontmatter `date` | **git 最后 commit 时间** |
| 图标 | frontmatter `icon` | 无 |

**没有摘要字段**，列表页只显示标题 + meta。

### 5.3 前端运行时 JS 预算

| 模块 | 估算大小（gzip） |
|---|---|
| 暗色模式切换 | ~1KB |
| 图片点击放大（medium-zoom） | ~3KB |
| 搜索（Pagefind，按需加载） | 主脚本 ~10KB + 索引 ~50KB/千篇 |
| **总计目标** | **≤ 60KB** |

首页和列表页：0 JS（纯静态）。

## 6. 视觉系统

### 6.1 设计 tokens（colors）

| 角色 | Light | Dark | 用途 |
|---|---|---|---|
| `bg` | `#ffffff` | `#0b0d10` | 页面背景 |
| `bg-elev` | `#fafafa` | `#15181d` | 侧栏 / 卡片 |
| `border` | `#f1f5f9` | `#1f2937` | 分隔线 |
| `text` | `#1f2937` | `#e5e7eb` | 正文 |
| `text-mute` | `#64748b` | `#94a3b8` | 次要信息 |
| `text-faint` | `#94a3b8` | `#64748b` | 占位 / 标签 |
| `accent` | `#2563eb` | `#60a5fa` | 链接 / 当前项 / 品牌 |
| `code-bg` | `#0f172a` | `#0b0d10` | 代码块（浅深色都用深底，减少切换跳动） |

### 6.2 字体（系统字体栈，不引入 Web Font）

```css
--font-sans: -apple-system, "Segoe UI", "PingFang SC",
             "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
--font-mono: "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
```

### 6.3 字号节奏（content area）

| 元素 | 字号 / 行高 |
|---|---|
| 正文 `p` | 15px / 1.72 |
| `h1` | 30px / 1.25 · 700 |
| `h2` | 22px / 1.4 · 700 |
| `h3` | 17px / 1.4 · 600 |
| 行内 `code` | 13.5px |
| 代码块 | 13px / 1.6 |

### 6.4 暗色模式

- Tailwind `darkMode: 'class'`，切换根节点 `class="dark"`。
- 三档：浅色 / 深色 / 跟随系统。
- 偏好持久化到 `localStorage`。
- 在 `<head>` 内联一段同步 `<script>` 读取偏好并立即应用，避免 FOUC。

### 6.5 容器与节奏

- 文章正文最大宽度：720px
- 三栏总宽：1280px（左 240 + 中 1fr + 右 220）
- 圆角：6px（小元素）、8px（card/input）、12px（大卡片）
- 垂直节奏：8px 网格

## 7. 项目结构

```
papyrus/
├── papyrus.config.json
├── astro.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── pnpm-lock.yaml
├── .env.example                    # GITHUB_TOKEN
├── README.md
│
├── src/
│   ├── pages/
│   │   ├── index.astro
│   │   ├── [repo]/
│   │   │   ├── index.astro
│   │   │   └── [...path].astro
│   │   └── 404.astro
│   │
│   ├── layouts/
│   │   ├── BaseLayout.astro        # <html> + 暗色模式 inline script + site header
│   │   ├── HomeLayout.astro
│   │   ├── RepoLayout.astro
│   │   └── ArticleLayout.astro
│   │
│   ├── components/
│   │   ├── SiteHeader.astro
│   │   ├── RepoCard.astro
│   │   ├── RepoTree.astro          # 左侧树（递归）
│   │   ├── ArticleTOC.astro
│   │   ├── ArticleList.astro
│   │   ├── ThemeToggle.astro
│   │   ├── SearchModal.astro       # ⌘K，client island
│   │   └── Prose.astro
│   │
│   ├── lib/
│   │   ├── github.ts               # 唯一接触 GitHub API 的地方
│   │   ├── content-loader.ts       # 唯一接触 config 的地方
│   │   ├── markdown.ts             # 唯一组装 remark/rehype 的地方
│   │   ├── images.ts
│   │   ├── tree.ts                 # 扁平 → 嵌套
│   │   └── types.ts
│   │
│   ├── styles/
│   │   ├── global.css              # Tailwind base + CSS 变量
│   │   └── prose.css               # 文章正文排版
│   │
│   └── content/
│       └── config.ts               # Astro content collections
│
├── public/
│   └── images/                     # 构建期下载的图片（gitignore）
│
├── scripts/
│   └── prebuild.ts                 # 构建前拉取 repos 到本地缓存
│
├── tests/
│   ├── fixtures/                   # 假 repo 树，供 unit + e2e 共用
│   ├── unit/
│   │   ├── tree.test.ts
│   │   ├── markdown.test.ts
│   │   └── github.test.ts
│   └── e2e/
│       └── smoke.spec.ts
│
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-06-05-papyrus-design.md
```

### 7.1 模块边界

- **`lib/github.ts`** — 唯一接触 GitHub API 的地方。换数据源（GitLab/Gitee）只改这一处。
- **`lib/content-loader.ts`** — 唯一接触 `papyrus.config.json` 的地方。负责"配置 → 归一化文章列表"。
- **`lib/markdown.ts`** — 唯一组装 remark/rehype 链的地方。改高亮主题、加新插件都集中在这里。
- **`components/Prose.astro` + `styles/prose.css`** — 文章正文所有排版样式。

## 8. 测试策略

### 8.1 单元测试（Vitest）

| 模块 | 测试内容 |
|---|---|
| `lib/tree.ts` | 扁平文件路径 → 嵌套树；空数组 / 单文件 / 深嵌套等边界 |
| `lib/markdown.ts` | 输入含代码 / 数学 / 图片 / 标题的 markdown，断言 HTML 含正确 class、anchor id、KaTeX 输出（snapshot 锁定） |
| `lib/github.ts` | `msw` mock API；测试"递归拉树 + 提取 commit 时间"两个核心函数；测试 rate limit / 404 错误处理 |

### 8.2 E2E（Playwright，1 个 smoke spec）

```
首页加载 → 看到 ≥ 1 个 RepoCard
↓
点 RepoCard → 进入 repo 页 → 左侧有树
↓
点树里某文章 → 进入文章页 → 右侧有 TOC，正文有内容
↓
按 ⌘K → 输入关键字 → 看到结果
↓
点暗色模式按钮 → body 有 .dark class
```

### 8.3 Fixtures

`tests/fixtures/` 下放一个迷你的"假 repo 树"（3–5 篇 .md，含嵌套、含数学、含代码、含图片），单元 + e2e 共用，不依赖真实 GitHub API。

### 8.4 构建期校验

`scripts/prebuild.ts` 执行：

- ✅ 用 Zod 校验 `papyrus.config.json` schema；失败 → 终止
- ⚠️ 每个 repo 至少能拉到 1 个 .md；否则 warning（可能配错 repo/branch）
- ⚠️ 内部链接（如 `[link](./other.md)`）目标存在；否则 warning，不阻断

### 8.5 部署后人工验收清单

- [ ] 首页 N 个 repo 卡片显示正确
- [ ] 暗色模式切换无白闪（FOUC）
- [ ] 任意 repo 任意文章页能打开，代码高亮 / 数学 / 图片都对
- [ ] ⌘K 搜索能搜到内容
- [ ] 在某 repo 里 push 新 .md → 1–3 分钟后站点可访问到

## 9. 里程碑（供 implementation plan 参考）

| # | 里程碑 | 关键产出 |
|---|---|---|
| M1 | 框架骨架 | Astro 项目跑起来；Tailwind 配好；BaseLayout + SiteHeader + ThemeToggle；浅/深色模式无白闪 |
| M2 | 数据层 | `lib/github.ts` + `lib/tree.ts` + `lib/content-loader.ts`；用 fixtures 跑通；单测过 |
| M3 | Markdown 渲染 | `lib/markdown.ts`：Shiki + KaTeX + 锚点 + 图片处理；snapshot 测试通过 |
| M4 | 三种页面 | 首页（RepoCard）+ Repo 页（RepoTree + 列表）+ 文章页（三栏 + Prose + TOC） |
| M5 | 搜索 | Pagefind 集成；⌘K 弹窗 |
| M6 | 测试与部署 | Playwright smoke spec；接入 Vercel + Deploy Hook + 一个真实 repo 的 webhook；定时 deploy 兜底 |

## 10. 开放问题（实现期再决定）

- frontmatter override 的字段集（除 title / date / icon 外是否还要支持 `hidden: true` 隐藏某篇文章？）
- 内部链接 `[link](./other.md)` 需不需要自动转换为站点内 URL？（推荐：是，构建期改写）
- 暗色模式切换的初始值，当 `localStorage` 未设置时默认是"跟随系统"还是"浅色"？（推荐：跟随系统）
