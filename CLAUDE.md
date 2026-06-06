# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目本质

Papyrus 是一个**静态站点生成器**，把 `papyrus.config.json` 中列出的多个 GitHub repo 里的 markdown 笔记，在构建时聚合成一个 Astro 站点。运行时无服务端 —— 所有内容在构建期固化进 `dist/`。

## 常用命令

```bash
pnpm install
cp .env.example .env                 # 填入 GITHUB_TOKEN（避免 rate limit）

# Dev：dev 不会跑 prebuild，所以首次必须手动跑一次生成 .cache/articles.json
pnpm tsx scripts/prebuild.ts
pnpm dev                             # http://localhost:4321

pnpm build                           # = prebuild + astro build + pagefind 索引
pnpm preview

pnpm typecheck                       # astro check && tsc --noEmit
pnpm test                            # vitest 单测（tests/unit/**/*.test.ts）
pnpm test:watch
pnpm test -- markdown                # 跑单个测试文件
pnpm test:e2e                        # Playwright；webServer 会自动 build+preview，需 .cache 已就绪
```

## 架构

### 构建流水线（三步串行）

1. **`scripts/prebuild.ts`** —— 读 `papyrus.config.json`，调 GitHub API 拉所有 repo 的 `.md` 文件 + 最后提交时间 + 内嵌相对路径图片，写入 `.cache/articles.json`。这一步是**所有 Astro 页面的唯一数据源**。
2. **`astro build`** —— `src/pages/` 下的页面在 `getStaticPaths` 里同步读 `.cache/articles.json`，渲染出所有静态路由。
3. **`pagefind --site dist`** —— 扫描已渲染的 HTML，产出 `dist/pagefind/` 静态全文索引。运行时 `SearchModal` 通过 `import('/pagefind/pagefind.js')` 动态加载。

⚠️ 改了内容拉取 / 渲染逻辑后必须重跑 prebuild，否则 dev/preview 仍读旧 `.cache`。

### 数据流

```
papyrus.config.json
   ↓ loadConfig (zod 校验)
   ↓ loadAllArticles → GitHub API（@octokit/rest）
   ↓                  → processImages（下载到 public/images/{repo}/{hash}.{ext}）
.cache/articles.json
   ↓ 同步 readFile in getStaticPaths
src/pages/[repo]/[...path].astro  → renderMarkdown → HTML + TOC
   ↓
dist/  → pagefind 索引
```

### 关键模块（`src/lib/`）

- `config.ts` —— Zod schema 强校验 `papyrus.config.json`：`slug` 必须 `[a-z0-9-]` 且全站唯一；`source` 必须形如 `github.com/owner/repo`。
- `github.ts` —— Octokit 封装；`listMarkdownFiles` 用 `git.getTree(recursive)` 一次拉全树。
- `content-loader.ts` —— frontmatter 用正则手解析（不引 gray-matter）；文章 `date` 优先用 frontmatter，否则 fallback 到最后一次 commit 时间。
- `markdown.ts` —— unified 管道：`remark-parse → gfm → math → rehype → slug → extractToc → rewriteMdLinks → autolink-headings → katex → shiki → stringify`。两个**自定义 rehype 插件**：
  - `extractToc`：从 h1/h2/h3 抽 TOC，按 `1./1.1/1.1.1` 编号写入 `toc.text`；编号**只在 TOC**，不改正文 hast。缺 h1 时降级（h2 起编号为 `1.`，h3 为 `1.1`）。
  - `rewriteMdLinks`：把站内 `xxx.md` / `../foo.md#anchor` 重写成 `/{repoSlug}/{resolvedPath}`；外链 / 锚点 / 绝对路径不动。
- `tree.ts` —— 把扁平的 `Article[]` 折叠成目录树（`buildTree`），目录在前、按 `localeCompare` 排序。
- `images.ts` —— 相对路径图片下载到 `public/images/{slug}/{sha1[:12]}.{ext}`，幂等（已存在跳过）。`public/images/` 在 `.gitignore`。

### 路由

只有三种路由：

- `/` —— `src/pages/index.astro`，repo 卡片列表。
- `/{repo}/` —— `src/pages/[repo]/index.astro`，单 repo 文章列表 + 左侧树。
- `/{repo}/{...path}` —— `src/pages/[repo]/[...path].astro`，文章页（左树 + 正文 + 右 TOC）。`path` 不含 `.md`。

`getStaticPaths` 全部从 `.cache/articles.json` 派生。

### 主题与样式

- Tailwind + CSS 变量（`src/styles/global.css`）。颜色 token 全部走 `var(--c-*)`；`darkMode: "class"`，`BaseLayout` 内联 `<script is:inline>` 在 head 里同步切 `.dark`，避免暗色首屏白闪。
- Shiki 配 `defaultColor: false` 输出 `--shiki-light/--shiki-dark` 双变量，由 `global.css` 按 `html.dark` 切。改 shiki 配置时要保持这套机制，否则 dark/light 切换会失效。
- `prose.css` 是手写的，不用 `@tailwindcss/typography`。

## 路径别名

`~/*` → `src/*`，在 `tsconfig.json`、`astro.config.mjs`（vite alias）、`vitest.config.ts` 三处都配了，新增构建工具时记得同步。

## 测试约定

- 单测：vitest + msw（`tests/unit/github.test.ts` 用 msw 拦 GitHub API，**不要**改成真打网络）。
- E2E：Playwright `tests/e2e/smoke.spec.ts`，`playwright.config.ts` 的 `webServer` **跳过 prebuild** 直接 `astro build + preview`，所以本地跑 e2e 前必须先有 `.cache/articles.json`。

## 部署

Vercel：`pnpm build` + output `dist/`。需要 `GITHUB_TOKEN` 环境变量。内容自动更新走 GitHub repo webhook → Vercel Deploy Hook 触发重建（详见 `README.md`）。
