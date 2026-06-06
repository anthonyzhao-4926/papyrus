# Papyrus

把分散在多个 GitHub 仓库里的 Markdown 笔记，**零运维**地聚合成一个统一的静态博客。

你只管在自己的笔记仓库里写 `.md`、`git push`；Papyrus 在构建期通过 GitHub API 把它们全部拉下来，渲染成一个带搜索、暗色模式、目录树、标签聚合的 Astro 静态站点，部署到 Vercel 后自动更新。运行时**无任何服务端**——所有内容在构建时固化进 `dist/`。

---

## 目录

- [特性](#特性)
- [工作原理](#工作原理)
- [快速开始](#快速开始)
  - [前置要求](#前置要求)
  - [获取 GitHub Token](#获取-github-token)
  - [安装与本地运行](#安装与本地运行)
- [配置 `papyrus.config.json`](#配置-papyrusconfigjson)
  - [`site`](#site)
  - [`tags`（可选）](#tags可选)
  - [`repos`](#repos)
- [笔记编写约定](#笔记编写约定)
- [命令清单](#命令清单)
- [部署到 Vercel](#部署到-vercel)
- [自动更新](#自动更新)
- [加入新 repo](#加入新-repo)
- [项目结构](#项目结构)
- [测试](#测试)
- [故障排查](#故障排查)
- [验收清单](#验收清单)

---

## 特性

- **多仓聚合**：一份配置列出任意多个 GitHub 仓库，统一成一个站点。
- **纯静态**：构建期固化为 HTML，运行时零服务端，可白嫖任意静态托管。
- **全文搜索**：基于 [Pagefind](https://pagefind.app/)，`⌘K` 唤起，索引在构建期生成，搜索在浏览器本地完成。
- **Markdown 全家桶**：GFM、数学公式（KaTeX）、代码高亮（Shiki，双主题）、自动锚点、目录（TOC）自动编号、站内 `.md` 链接重写、相对路径图片自动下载托管。
- **目录树导航**：扁平文章自动折叠成 Notion 风左侧目录树。
- **标签聚合页**：`/tag/{slug}` 把跨仓的笔记本按标签归类。
- **暗色模式**：`class` 策略 + head 内联脚本，**无首屏白闪**。

---

## 工作原理

构建是**三步串行**流水线：

```
papyrus.config.json
   │  loadConfig（Zod 强校验）
   ▼
scripts/prebuild.ts ──► GitHub API（@octokit/rest）
   │   · 拉每个 repo 的全部 .md（git tree recursive）
   │   · 取每个文件最后一次 commit 时间
   │   · 下载正文里相对路径图片到 public/images/{slug}/
   ▼
.cache/articles.json    ← 所有 Astro 页面的唯一数据源
   │  getStaticPaths 同步 readFile
   ▼
astro build ──► dist/   ← 渲染出全部静态路由
   │
   ▼
pagefind --site dist ──► dist/pagefind/   ← 静态全文索引
```

1. **`scripts/prebuild.ts`** —— 读配置、调 GitHub API、写 `.cache/articles.json`。这是后续所有页面的**唯一数据源**。
2. **`astro build`** —— `src/pages/` 下的页面在 `getStaticPaths` 里同步读 `.cache/articles.json`，渲染出所有静态路由。
3. **`pagefind --site dist`** —— 扫描已渲染的 HTML，产出 `dist/pagefind/` 全文索引；运行时 `SearchModal` 通过 `import('/pagefind/pagefind.js')` 动态加载。

> ⚠️ **改了内容拉取 / 渲染逻辑后必须重跑 prebuild**，否则 dev / preview 仍读旧的 `.cache/articles.json`。

只有三种路由：

| 路由 | 页面 | 内容 |
|---|---|---|
| `/` | `src/pages/index.astro` | 首页，repo 卡片列表 |
| `/{repo}/` | `src/pages/[repo]/index.astro` | 单 repo 文章列表 + 左侧目录树 |
| `/{repo}/{...path}` | `src/pages/[repo]/[...path].astro` | 文章页（左树 + 正文 + 右 TOC），`path` 不含 `.md` |
| `/tag/{slug}` | `src/pages/tag/[slug].astro` | 标签聚合页 |

---

## 快速开始

### 前置要求

- **Node.js** ≥ 18（建议 20+）
- **pnpm** 9.x（仓库锁定 `pnpm@9.15.0`）。没装就 `npm i -g pnpm`
- 一个 **GitHub Personal Access Token**（见下）

### 获取 GitHub Token

Token 的作用是给构建期调用 GitHub API 的请求做认证。**不设也能跑**，但未认证请求只有 **60 次/小时**，拉多个 repo 的文件树几乎必然不够，所以强烈建议配置（认证后 5000 次/小时）。所需权限极小：**只读公开仓库**。

**方式一：Classic Token（最简单）**

1. 打开 <https://github.com/settings/tokens> （头像 → Settings → Developer settings → Personal access tokens → Tokens (classic)）
2. **Generate new token** → **Generate new token (classic)**
3. 填写：
   - **Note**：随便写，如 `papyrus-build`
   - **Expiration**：按需，建议设个有效期
   - **Select scopes**：只勾 **`public_repo`**（在 `repo` 分组下）。若你的配置里有**私有仓库**，则勾选整个 **`repo`**
4. 拉到底 **Generate token**，**立即复制** `ghp_xxxx...`（刷新后不再显示）

**方式二：Fine-grained Token（更安全，推荐）**

1. <https://github.com/settings/tokens?type=beta> → **Generate new token**
2. **Repository access**：选 `Public Repositories (read-only)`，或指定具体仓库
3. **Permissions** → Repository permissions → **Contents** 设为 **Read-only**（本项目只读 `.md` 与提交时间，这一项即够）
4. 生成并复制

拿到后写入 `.env`：

```bash
cp .env.example .env
```

```dotenv
# .env
GITHUB_TOKEN=ghp_你复制的token
```

> 部署到 Vercel 时不放 `.env`，而是在 Vercel 项目的 Environment Variables 里加 `GITHUB_TOKEN`（见[部署](#部署到-vercel)）。

### 安装与本地运行

```bash
pnpm install
cp .env.example .env                 # 填入 GITHUB_TOKEN
cp papyrus.config.example.json papyrus.config.json   # 改成你自己的仓库

# 关键：dev 不会自动跑 prebuild，首次必须手动生成 .cache/articles.json
pnpm tsx scripts/prebuild.ts

pnpm dev                             # http://localhost:4321
```

之后每次改了 `papyrus.config.json` 或想拉取最新内容，重跑一次 `pnpm tsx scripts/prebuild.ts` 即可。

---

## 配置 `papyrus.config.json`

完整字段示例见 [`papyrus.config.example.json`](./papyrus.config.example.json)，可直接复制做起点：

```bash
cp papyrus.config.example.json papyrus.config.json
```

配置由 `src/lib/config.ts` 中的 **Zod schema 强校验**，不合法会在 prebuild 阶段直接报错。

### `site`

| 字段 | 必填 | 说明 |
|---|---|---|
| `name` | ✓ | 站点名 |
| `description` | ✓ | 站点描述 / hero tagline |
| `heroTitle` | — | 首页 hero 第一行；缺省 `"把零散的想法"` |
| `heroHighlight` | — | 首页 hero 第二行（渐变高亮）；缺省 `"沉淀成可以回看的东西。"` |
| `heroEyebrow` | — | hero 上方小标签；缺省按当年 + ISO 周数自动生成 |

### `tags`（可选）

`tags` 是一个 `slug → { title, icon, description }` 字典；`repos[].tags` 通过 slug 引用它。slug 须匹配 `[a-z0-9-]+`。

| 字段 | 必填 | 说明 |
|---|---|---|
| `title` | ✓ | 显示名（如「学习」） |
| `icon` | — | emoji 或字符图标 |
| `description` | — | `/tag/{slug}` 页顶部描述；支持占位符 `{count}`（笔记本数）和 `{title}`（tag 标题）；缺省回退默认句式 |

> 约束：`repos[].tags` 引用的每个 tag **必须**先在顶层 `tags` 字典里声明，否则校验失败。

### `repos`

至少需要 1 个 repo。

| 字段 | 必填 | 说明 |
|---|---|---|
| `slug` | ✓ | 路由片段，须匹配 `[a-z0-9-]+`，且**全站唯一** |
| `title` | ✓ | 笔记本名 |
| `description` | ✓ | 笔记本描述 |
| `icon` | ✓ | emoji |
| `source` | ✓ | 须形如 `github.com/owner/repo` |
| `branch` | — | 默认 `main` |
| `tags` | — | 引用顶层 `tags` 字典 key 的数组 |

最小示例：

```json
{
  "site": {
    "name": "Papyrus",
    "description": "你好，我叫 XX，很高兴认识你"
  },
  "tags": {
    "study": { "title": "学习", "icon": "📘" }
  },
  "repos": [
    {
      "slug": "tech-notes",
      "title": "技术笔记",
      "description": "前后端、基础设施、日常踩坑",
      "icon": "📘",
      "source": "github.com/your-name/tech-notes",
      "branch": "main",
      "tags": ["study"]
    }
  ]
}
```

---

## 笔记编写约定

笔记就是你自己仓库里普通的 `.md` 文件，Papyrus 在拉取时会做这些处理：

- **Frontmatter**（可选，YAML 风格的 `---` 块）。支持的字段：
  - `title` —— 文章标题；缺省用文件名（去掉 `.md`）
  - `date` —— 发布日期；缺省 fallback 到该文件**最后一次 commit 时间**
  - `icon` —— 文章图标（emoji）

  ```markdown
  ---
  title: 我的第一篇笔记
  date: 2026-06-06
  icon: 📝
  ---

  正文从这里开始……
  ```

- **目录与路由**：文件路径即路由。`notes/foo/bar.md` → `/{repo}/notes/foo/bar`。扁平文章会自动折叠成左侧目录树（目录在前，按 `localeCompare` 排序）。
- **站内链接**：正文里指向其他笔记的 `xxx.md` / `../foo.md#anchor` 会被重写成 `/{repoSlug}/{resolvedPath}`；外链、纯锚点、绝对路径不动。
- **图片**：正文里相对路径图片会在构建期下载到 `public/images/{slug}/{sha1[:12]}.{ext}` 并改写引用（幂等，已存在跳过）。`public/images/` 在 `.gitignore` 中。
- **代码高亮**：Shiki，输出双主题变量，跟随暗色模式切换。
- **数学公式**：`remark-math` + KaTeX，支持 `$行内$` 与 `$$块级$$`。
- **TOC 编号**：右侧目录从 h1/h2/h3 抽取，自动按 `1. / 1.1 / 1.1.1` 编号；编号**只在 TOC**，不改正文。

---

## 命令清单

```bash
pnpm install                         # 安装依赖

pnpm tsx scripts/prebuild.ts         # 单独跑 prebuild（dev 前必须先跑一次）
pnpm dev                             # 启动 dev server（不含 prebuild）→ http://localhost:4321

pnpm build                           # prebuild + astro build + pagefind 索引
pnpm preview                         # 本地预览 dist/

pnpm typecheck                       # astro check && tsc --noEmit
pnpm test                            # vitest 单测（tests/unit/**/*.test.ts）
pnpm test:watch                      # vitest watch 模式
pnpm test -- markdown                # 只跑某个测试文件
pnpm test:e2e                        # Playwright；webServer 会自动 build+preview，需 .cache 已就绪
```

---

## 部署到 Vercel

1. Push 本仓库到 GitHub。
2. 在 Vercel 新建项目，导入该 repo。
3. 加环境变量 **`GITHUB_TOKEN`**（值为前面拿到的 PAT，`public_repo` 权限）。
4. Build Command 保持默认（`pnpm build`），**Output Directory 设 `dist`**。
5. 部署完成后，进 Project → Settings → Git → **Deploy Hooks**，创建一个 hook 并复制其 URL（下一步自动更新要用）。

---

## 自动更新

内容仓库一旦 push，希望站点自动重建——靠 **GitHub Webhook → Vercel Deploy Hook**。

**对每个** `papyrus.config.json` 里列出的内容 repo，一次性配置：

1. 打开该 repo → Settings → Webhooks → **Add webhook**
2. **Payload URL**：上一步复制的 Vercel Deploy Hook URL
3. **Content type**：`application/json`
4. **Events**：仅勾选 `push`

效果：任何 push 到该 repo → 1–3 分钟内 Vercel 触发新构建 → 站点更新。

**定时兜底**：在 Vercel 项目里另设一个 daily cron deploy（Project → Settings → Cron Jobs），防止漏掉某次 webhook。

---

## 加入新 repo

1. 编辑 `papyrus.config.json`，在 `repos` 里加一项（注意 `slug` 全站唯一）。
2. 给该 repo 配 [自动更新](#自动更新) webhook。
3. 在该 repo push 任意文件，触发首次构建。
4. 本地验证可先 `pnpm tsx scripts/prebuild.ts` 看是否拉到文章。

---

## 项目结构

```
papyrus/
├─ scripts/prebuild.ts          # 第 1 步：拉 GitHub → .cache/articles.json
├─ papyrus.config.json          # 站点配置（你的仓库清单）
├─ papyrus.config.example.json  # 配置示例
├─ src/
│  ├─ pages/                    # 路由：/、/[repo]/、/[repo]/[...path]、/tag/[slug]、404
│  ├─ layouts/                  # Base / Home / Repo / Article 布局
│  ├─ components/               # RepoCard、RepoTree、SearchModal、HomeHero、ThemeToggle 等
│  ├─ lib/
│  │  ├─ config.ts              # Zod 校验 papyrus.config.json
│  │  ├─ github.ts              # Octokit 封装，listMarkdownFiles 用 git tree recursive
│  │  ├─ content-loader.ts      # frontmatter 正则解析 + 聚合所有文章
│  │  ├─ markdown.ts            # unified 渲染管道 + 两个自定义 rehype 插件（TOC 编号、站内链接重写）
│  │  ├─ tree.ts                # Article[] → 目录树
│  │  ├─ images.ts              # 相对图片下载托管
│  │  ├─ format.ts              # 格式化工具
│  │  └─ types.ts               # 共享类型
│  └─ styles/                   # global.css（CSS 变量 + 暗色）、prose.css（手写排版）
└─ tests/                       # unit（vitest + msw）、e2e（Playwright）
```

**路径别名**：`~/*` → `src/*`，在 `tsconfig.json`、`astro.config.mjs`（vite alias）、`vitest.config.ts` 三处都配了，新增构建工具时记得同步。

---

## 测试

- **单测**：vitest，覆盖 `config / content-loader / github / markdown / tree / format`。其中 `github.test.ts` 用 [msw](https://mswjs.io/) 拦截 GitHub API，**不要**改成真打网络。
- **E2E**：Playwright（`tests/e2e/smoke.spec.ts`）。`playwright.config.ts` 的 `webServer` **跳过 prebuild** 直接 `astro build + preview`，所以本地跑 e2e 前**必须先有 `.cache/articles.json`**（即先跑过一次 prebuild 或 build）。

---

## 故障排查

| 现象 | 可能原因 / 解决 |
|---|---|
| prebuild 报 GitHub 403 / rate limit | 没配 `GITHUB_TOKEN`，或 token 失效。检查 `.env` / Vercel 环境变量。 |
| `repo xxx 没拉到任何 .md` 警告 | `source` 或 `branch` 配错，或该仓库确实没有 `.md`。核对 `github.com/owner/repo` 与分支名。 |
| 私有仓库拉不到 | token 权限不够，classic 需整个 `repo`，fine-grained 需对该私有库有 Contents 读权限。 |
| dev 改了配置但页面没变 | dev 不会自动 prebuild，重跑 `pnpm tsx scripts/prebuild.ts`。 |
| 配置报 Zod 校验错误 | 看报错信息：`slug` 须 `[a-z0-9-]` 且唯一；`source` 须 `github.com/owner/repo`；`tags` 须先在顶层声明。 |
| 暗色模式首屏白闪 | 检查 `BaseLayout` head 内联脚本与 `global.css` 的 `html.dark` 机制是否被破坏。 |
| 代码块 dark/light 切换失效 | Shiki 须保持 `defaultColor: false` 输出 `--shiki-light/--shiki-dark` 双变量。 |

---

## 验收清单

部署后人工跑一遍：

- [ ] 首页 N 个 repo 卡片显示正确
- [ ] 暗色模式切换无白闪
- [ ] 任意 repo 任意文章页能打开，代码高亮 / 数学 / 图片都对
- [ ] `⌘K` 搜索能搜到内容
- [ ] 标签页 `/tag/{slug}` 聚合正确
- [ ] 在某 repo push 新 `.md` → 1–3 分钟后站点可访问
