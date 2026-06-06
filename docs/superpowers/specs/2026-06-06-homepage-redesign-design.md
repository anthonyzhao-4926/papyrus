# 主页重设计 · Editorial / 编辑部风

**日期**：2026-06-06
**作者**：anthonyzhao（与 Claude 协作）
**范围**：仅 `/`（主页），不动其他页面与全局导航

## 目标与动机

当前 `src/pages/index.astro` 只包含一个 H1 + 一段描述 + 一个三列 repo 卡片网格。在仅配置 1 个 repo 的情况下整页几乎是空的，没有视觉层次也没有内容入口，不像一个"博客主页"。

本设计把主页改成 **编辑部 / Editorial** 风格：以大字号 hero 引入身份与意图，用精选大卡突出最新文章，再以笔记本网格与最近活动时间轴提供导航与发现路径。同时设计必须 **自适应稀疏数据**：单 repo / 少量文章时不显空白模块。

## 非目标

- 不重做 `SiteHeader`、不改全局导航
- 不引入"热门标签"（方案 B 的元素）
- 不引入手动"精选"机制；"最新"即按时间倒序第一篇
- 不引入文章配图 / OG 图爬取；缩略图用 repo emoji 渲染在渐变背景上
- 不引入 RSS 订阅，也不放任何 RSS 占位文字 / 入口
- 不改 `papyrus.config.json` 的现有字段语义；新增字段一律可选

## 顶层布局

按从上至下顺序，主页（`/`）的 `<main>` 由以下分区组成：

1. **Hero** — 大标题 + tagline + 右侧 meta 条
2. **最新 / Featured** — 单张大卡，展示按 `date` 倒序的第一篇文章
3. **笔记本 / Notebooks**（可隐藏） — repo 网格
4. **最近活动 / Activity** — 文章时间轴
5. **写作热力图 / Heatmap** — 近 26 周日历热力图

`SiteHeader` 与 `SearchModal` 由 `BaseLayout` 提供，本设计不动。

## 各分区设计

### 1. Hero

布局：两列网格，左 1.4 : 右 1，底对齐。左右总宽限制在 `max-w-page`（1440px），内边距 `px-20 py-18`。

**左列**：
- 小标签：`2026 · 第 23 周`（年份和 ISO 周数动态计算，构建时确定）
  - 字号 12px、字距 0.18em、大写、`var(--c-accent)` 颜色
- 大标题：两行
  - 第一行：普通文本（默认："把零散的想法"）
  - 第二行：用 `<em>` 包住的渐变高亮文本（默认："沉淀成可以回看的东西。"），渐变 `linear-gradient(120deg, var(--c-accent) 30%, #7c3aed 80%)`，通过 `background-clip: text` 实现
  - 字号 56px、行高 1.05、`font-weight: 800`、字距 -0.02em
- Tagline：用 `site.description`，最大宽 460px，颜色 `var(--c-text-mute)`

**右列（meta 条）**：
- 左边框线分隔（`border-left: 1px solid var(--c-border-strong)`），左内边距 28px
- 4 行键值，每行 `display: flex; justify-content: space-between`
  - `文章总数` · `N 篇`
  - `笔记本` · `N 个`
  - `最近更新` · `今天` / `N 天前` / `N 周前` / `N 个月前`（沿用 `RepoCard.astro` 的 `ago()` 计算逻辑）
  - `本月新增` · `N 篇`（**当值为 0 时整行隐藏**）

**配置可选项**（新增到 `papyrus.config.json` 的 `site` 下，全部可选）：
- `heroTitle`：第一行文本，缺省 `"把零散的想法"`
- `heroHighlight`：第二行高亮文本，缺省 `"沉淀成可以回看的东西。"`
- `heroEyebrow`：覆盖小标签文本，缺省按动态计算

### 2. 最新 / Featured

**条件**：`articles.length >= 1`，否则隐藏整 section。

布局：一张大卡，内部 1.2 : 1 两列网格。卡片本体：
- `border: 1px solid var(--c-border-strong)`、`border-radius: 14px`、`padding: 28px`
- 背景渐变：`linear-gradient(180deg, #fafbff 0%, #ffffff 100%)`（暗色下走变量，见"暗色模式"）

左列：
- 小标签 `● 精选 · 最近更新`（11px、大写、字距 0.14em、accent 色）
- 标题 `<h3>`：取文章 `title`，28px、行高 1.25
- 摘要：取文章正文前 ~120 字（剥掉 frontmatter 与 markdown 符号后截断；若已有 `excerpt` 字段优先用之）
- byline：`📘 笔记本名` · `YYYY-MM-DD` · `约 N 分钟阅读`
  - 阅读时长按 `Math.max(1, Math.round(wordCount / 400))` 计算

右列：
- 缩略图区，高 200px、`border-radius: 10px`
- 背景两个径向渐变叠加：accent 蓝在左上 18% 透明 + 紫 #7c3aed 在右下 18% 透明
- 居中显示对应 repo 的 `icon` emoji，字号 60px

整张卡 `<a>` 包裹，链接到 `/${repo}/${slug}`（沿用现有路由规则）。

### 3. 笔记本 / Notebooks

**自适应规则**：
- `repos.length === 1` → **整 section 隐藏**（含标题），保留 Featured → Activity 的连贯
- `repos.length === 2` → 2 列网格
- `repos.length >= 3` → 3 列网格
- gap `18px`

每张卡基于 `RepoCard.astro` 重做样式（**不新增组件，直接改它**）：
- 内边距 22px、`border-radius: 12px`
- 图标块 36px × 36px、`border-radius: 9px`、保留现有调色板按 slug 哈希取色
- 标题 15px、`font-weight: 600`
- 描述 13px、`color: var(--c-text-mute)`、`line-height: 1.6`
- 底部 meta：`N 篇` · `今天更新` 等（沿用现有 `ago()` 逻辑）
- hover：`box-shadow: 0 12px 28px -16px rgba(15,23,42,.2)`，去掉原来的 `-translate-y-0.5`

section 头：
- `<h2>笔记本</h2>` 左对齐；不放右侧 `查看所有` 链接（当前没有"全部笔记本"页面，避免造死链）

### 4. 最近活动 / Activity

**条件**：`articles.length >= 1`，否则隐藏整 section。

数据：所有文章按 `date` 倒序取前 8 篇。

每行三列网格 `110px 1fr 100px`，gap 28px：
- 左：`MM-DD` 格式日期、12px、`text-faint` 色、`font-variant-numeric: tabular-nums`
- 中：`<a>` 文章标题，hover 变 accent 色
- 右：repo 胶囊标签 `border: 1px solid var(--c-border-strong)`、`padding: 2px 8px`、`border-radius: 999px`，文本为 repo `title`

行间 `border-top: 1px solid var(--c-border)`，首行不画上边框。

section 头：左 `<h2>最近活动</h2>`，右侧不放任何链接。

### 5. 写作热力图 / Heatmap

**条件**：`articles.length >= 1`，否则隐藏整 section。

布局：GitHub 风格的日历热力图，覆盖**最近 26 周**（约半年）。

- 网格：26 列 × 7 行（每列一周，从周一到周日），cell 间 gap `3px`
- 每个 cell：正方形（`aspect-ratio: 1`），`border-radius: 2px`
- 颜色按当日文章数着色，4 级阶梯：
  - 0 篇 → `var(--c-border)`（与背景几乎平齐）
  - 1 篇 → `#c7d2fe`（淡靛蓝）
  - 2 篇 → `#818cf8`（中靛蓝）
  - ≥ 3 篇 → `#4f46e5`（深靛蓝）
- 暗色模式下整套色阶替换为：`#1f2937` / `#3730a3` / `#6366f1` / `#a5b4fc`
- hover：cell 显示原生 `title` tooltip：`YYYY-MM-DD · N 篇`

section 头：左 `<h2>写作热力图</h2>`，右侧小灰字 `近 26 周`。

底部：
- 左侧若干月份标签（动态计算：在每个月第一周对应的列下方标 `1月` / `2月`）
- 右侧色阶图例：`少 □ ▤ ▦ ■ 多`（与色阶一致的 4 个色块 + 0 色 1 个共 5 格，每格 10×10px）

**条件 2**：若整个 26 周内 0 篇文章，则只渲染全灰网格（不隐藏 section，作为"还没开始写"的展示）。

## 数据来源与计算

主页继续走 `.cache/articles.json`（已存在）。计算口径：

| 字段 | 算法 |
|---|---|
| `totalArticles` | `articles.length` |
| `totalRepos` | `config.repos.length` |
| `latestDate` | `articles` 里 `date` 的最大值 |
| `latestAgo` | 同 `RepoCard.ago()` |
| `monthCount` | `articles.filter(a => sameYearMonth(a.date, now)).length` |
| `featured` | `articles` 按 `date` 倒序第 1 篇；空数组时 `null` |
| `recent` | 倒序前 8 篇 |
| `weekNumber` | ISO 周数，构建时计算（无需运行时） |
| `heatmap` | 长度 `26 × 7 = 182` 的数组，每个元素 `{ date: 'YYYY-MM-DD', count: number, weekday: 0..6 }`，按"从今天往回 26 周 × 7 天"展开；缺日补 `count: 0` |

**新增工具函数**（建议放 `src/lib/format.ts`，不存在就新建）：
- `formatAgo(iso: string): string` — 抽离自 `RepoCard`，供主页复用
- `getIsoWeek(date: Date): number` — Hero eyebrow 用
- `excerpt(body: string, max = 120): string` — 剥 frontmatter 与基础 markdown 符号后截断
- `buildHeatmap(articles: Article[], weeks = 26): HeatCell[]` — 按"从今天回溯 N 周"生成日历矩阵；第一列对齐到 ISO 周一

## 类型变更

`src/lib/types.ts` 中 `PapyrusConfig['site']`：

```ts
site: {
  name: string;
  description: string;
  url: string;
  heroTitle?: string;        // 新增
  heroHighlight?: string;    // 新增
  heroEyebrow?: string;      // 新增
};
```

`Article` 类型若已包含 `body` / `excerpt` / `wordCount` 之一即可；本设计在实现阶段再确认是否需要扩展 prebuild。**实现阶段第一步必须先读现有 `Article` 类型与 prebuild 脚本，确认字段可用性后再写组件。**

## 组件拆分

| 组件 | 路径 | 职责 |
|---|---|---|
| `index.astro` | `src/pages/index.astro` | 读 cache、计算派生数据、组合 4 个分区 |
| `HomeHero.astro` | `src/components/HomeHero.astro` | Hero（左标题 + 右 meta） |
| `FeaturedArticle.astro` | `src/components/FeaturedArticle.astro` | 大卡 |
| `RepoCard.astro` | `src/components/RepoCard.astro` | 改样式，保持现有 props |
| `ActivityTimeline.astro` | `src/components/ActivityTimeline.astro` | 时间轴 |
| `WritingHeatmap.astro` | `src/components/WritingHeatmap.astro` | 26 周热力图 + 月份标签 + 图例 |

`HomeLayout.astro` 不动。

## 暗色模式

- 所有背景渐变中的 `#fafbff` / `#ffffff` 替换为基于 `var(--c-bg-elev)` / `var(--c-bg)` 的颜色
- 渐变高亮文本：暗色下高亮颜色改为 `linear-gradient(120deg, #60a5fa 30%, #a78bfa 80%)`（用 `.dark` 选择器覆盖）
- Featured 缩略图渐变叠加：暗色下使用 `rgba(96,165,250,.16)` / `rgba(167,139,250,.16)`
- 在 `src/styles/global.css` 末尾增加 `.dark` 下的对应规则

## 错误与边界

| 情况 | 行为 |
|---|---|
| `articles.length === 0` | 隐藏 Featured + Activity + Heatmap；只保留 Hero（meta 条相应改成 0 / 不显示"最近更新"） |
| `articles` 全部早于 26 周前 | Heatmap 显示全灰网格（不隐藏 section） |
| `repos.length === 0` | 不可能（构建前置条件），不处理 |
| `repos.length === 1` | 隐藏整个 Notebooks section |
| 文章无 `body` | excerpt 用 `description`（若有）或空字符串 |
| `wordCount` 不可得 | 阅读时长按 `Math.max(1, Math.ceil(body.length / 800))` 估算（中文一字算两字符） |
| `featured` 文章 `date` 是未来日期 | 按原样显示，不特殊处理 |

## 测试

- **视觉验证**：`pnpm dev` 后打开 `/`，至少在以下数据状态各验证一次
  - 当前 1 repo + N 篇（开发环境真实数据）
  - 临时改 config 为 3 repo 模拟（验证笔记本网格三列）
  - 临时清空 `articles`（验证 Featured / Activity 隐藏）
- **暗色模式**：在浏览器中切换 light / dark，确认无 white-on-white 或对比度失衡
- **响应式**：本项目固定视口 `width=1280`（见 `BaseLayout`），不要求做窄屏适配，但 `max-w-page` 与内边距应在 1280–1440 范围内不出现横向滚动
- **类型与单元**：`pnpm typecheck` 通过；若新增 `src/lib/format.ts` 函数，**为 `formatAgo` / `getIsoWeek` / `excerpt` / `buildHeatmap` 写 vitest 单元测试**（项目已配置 vitest）
- **热力图边界**：`buildHeatmap` 单测必须覆盖：空数组 / 同一天多篇 / 跨年（12 月跨到 1 月）/ 全部早于 26 周前 / 时区一致性（统一按 UTC 日期截断，避免本地时区导致 cell 漂移）

## 实现阶段的关注点

- 先读 `scripts/prebuild.ts` 与 `Article` 类型，确认 `body` / `excerpt` / `wordCount` 哪些字段可用；缺什么再加
- `RepoCard.astro` 的现有路径不变，但改样式会影响其他可能引用它的页面（`RepoLayout.astro` 等）——实现前先 `grep` 一遍引用点确认
- 删除临时原型目录 `.tmp-mockups/`（不需要进 git；建议加进 `.gitignore` 兜底）

## 不做（明确写下来防止 scope creep）

- RSS 订阅（不放占位、不放入口、不实现）
- 文章配图 / OG 图
- 标签系统、热门标签
- 搜索改造（沿用现有 SearchModal）
- 全局导航重做
- 多 hero 文案 / 主题切换
