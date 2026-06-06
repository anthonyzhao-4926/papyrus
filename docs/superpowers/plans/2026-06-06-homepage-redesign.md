# Homepage Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Papyrus 主页从"标题 + repo 网格"重设计为编辑部风格：Hero / Featured / Notebooks / Activity / Heatmap 五段式，且自适应稀疏数据。

**Architecture:** 抽离纯函数工具到 `src/lib/format.ts`（TDD 单测覆盖），把五个分区各做成独立 Astro 组件，`index.astro` 仅负责读 cache、计算派生数据、组合分区。所有派生计算（统计、热力图矩阵）都在构建时完成，无客户端 JS。

**Tech Stack:** Astro 4 + Tailwind 3 + TypeScript + vitest（单测）。复用项目现有 CSS 变量主题系统与 `~` 别名。

**Spec:** `docs/superpowers/specs/2026-06-06-homepage-redesign-design.md`

---

## File Structure

**Create:**
- `src/lib/format.ts` — 纯函数工具（`formatAgo` / `getIsoWeek` / `excerpt` / `buildHeatmap` / `countThisMonth`）
- `tests/unit/format.test.ts` — 上述函数的单测
- `src/components/HomeHero.astro` — Hero 区
- `src/components/FeaturedArticle.astro` — 精选大卡
- `src/components/ActivityTimeline.astro` — 最近活动时间轴
- `src/components/WritingHeatmap.astro` — 26 周热力图

**Modify:**
- `src/lib/types.ts` — `SiteConfig` 加 3 个可选字段
- `src/components/RepoCard.astro` — 按新设计重写样式
- `src/pages/index.astro` — 全部重写
- `src/styles/global.css` — 加暗色模式渐变变量

**No changes:**
- `src/layouts/HomeLayout.astro`、`src/layouts/BaseLayout.astro`
- `src/components/SiteHeader.astro`、`SearchModal.astro`、`ThemeToggle.astro`
- `scripts/prebuild.ts`（`.cache/articles.json` 已含全部所需数据）
- `tailwind.config.ts`（不加新颜色，全部走 CSS 变量）

---

## Task 1: 类型扩展

**Files:**
- Modify: `src/lib/types.ts:1-5`

- [ ] **Step 1: 扩展 `SiteConfig` 接口**

替换 `src/lib/types.ts` 第 1-5 行：

```ts
export interface SiteConfig {
  name: string;
  description: string;
  url: string;
  heroTitle?: string;       // Hero 第一行文本，缺省 "把零散的想法"
  heroHighlight?: string;   // Hero 第二行渐变文本，缺省 "沉淀成可以回看的东西。"
  heroEyebrow?: string;     // 顶部小标签，缺省按 ISO 周动态生成
}
```

- [ ] **Step 2: typecheck 验证**

运行：`pnpm typecheck`
预期：通过（新增字段都是可选，不破坏现有代码）

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(types): site config 增加可选 hero 字段"
```

---

## Task 2: format.ts —— `formatAgo`

**Files:**
- Create: `src/lib/format.ts`
- Create: `tests/unit/format.test.ts`

- [ ] **Step 1: 写失败的测试**

创建 `tests/unit/format.test.ts`：

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { formatAgo } from "~/lib/format";

describe("formatAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-06T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("今天返回 '今天更新'", () => {
    expect(formatAgo("2026-06-06T03:00:00Z")).toBe("今天更新");
  });

  it("3 天前返回 '3 天前更新'", () => {
    expect(formatAgo("2026-06-03T12:00:00Z")).toBe("3 天前更新");
  });

  it("10 天前返回 '1 周前更新'", () => {
    expect(formatAgo("2026-05-27T12:00:00Z")).toBe("1 周前更新");
  });

  it("60 天前返回 '2 个月前更新'", () => {
    expect(formatAgo("2026-04-07T12:00:00Z")).toBe("2 个月前更新");
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

运行：`pnpm vitest run tests/unit/format.test.ts`
预期：FAIL — `Cannot find module '~/lib/format'`

- [ ] **Step 3: 实现 `formatAgo`**

创建 `src/lib/format.ts`：

```ts
export function formatAgo(iso: string, now: Date = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "今天更新";
  if (days < 7) return `${days} 天前更新`;
  if (days < 30) return `${Math.floor(days / 7)} 周前更新`;
  return `${Math.floor(days / 30)} 个月前更新`;
}
```

- [ ] **Step 4: 跑测试确认通过**

运行：`pnpm vitest run tests/unit/format.test.ts -t formatAgo`
预期：PASS（4 项）

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts tests/unit/format.test.ts
git commit -m "feat(lib): formatAgo + 单测"
```

---

## Task 3: format.ts —— `getIsoWeek`

**Files:**
- Modify: `src/lib/format.ts`
- Modify: `tests/unit/format.test.ts`

- [ ] **Step 1: 加失败的测试**

在 `tests/unit/format.test.ts` 顶部 import 加 `getIsoWeek`：

```ts
import { formatAgo, getIsoWeek } from "~/lib/format";
```

在文件末尾加：

```ts
describe("getIsoWeek", () => {
  it("ISO 周一为周起点，2026-01-01（周四）属第 1 周", () => {
    expect(getIsoWeek(new Date("2026-01-01T00:00:00Z"))).toBe(1);
  });

  it("2026-06-06 属第 23 周", () => {
    expect(getIsoWeek(new Date("2026-06-06T00:00:00Z"))).toBe(23);
  });

  it("2025-12-29（周一）已属 2026 第 1 周（ISO 规则）", () => {
    expect(getIsoWeek(new Date("2025-12-29T00:00:00Z"))).toBe(1);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

运行：`pnpm vitest run tests/unit/format.test.ts -t getIsoWeek`
预期：FAIL — `getIsoWeek is not a function`

- [ ] **Step 3: 实现 `getIsoWeek`**

在 `src/lib/format.ts` 追加：

```ts
/** 返回输入日期所属的 ISO 8601 周序号（1-53）。算法来自维基百科 ISO week。 */
export function getIsoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;            // 周日 = 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);    // 移到本周周四
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
```

- [ ] **Step 4: 跑测试确认通过**

运行：`pnpm vitest run tests/unit/format.test.ts -t getIsoWeek`
预期：PASS（3 项）

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts tests/unit/format.test.ts
git commit -m "feat(lib): getIsoWeek + 单测"
```

---

## Task 4: format.ts —— `excerpt`

**Files:**
- Modify: `src/lib/format.ts`
- Modify: `tests/unit/format.test.ts`

- [ ] **Step 1: 加失败的测试**

在 import 处加 `excerpt`：

```ts
import { formatAgo, getIsoWeek, excerpt } from "~/lib/format";
```

文件末尾加：

```ts
describe("excerpt", () => {
  it("剥去 frontmatter 和 H1", () => {
    const md = `---\ntitle: T\ndate: 2026-01-01\n---\n\n# 标题\n\n这是正文第一段。`;
    expect(excerpt(md, 50)).toBe("这是正文第一段。");
  });

  it("剥去 markdown 强调与代码", () => {
    const md = `这是**加粗**和\`代码\`和[链接](http://x)的句子。`;
    expect(excerpt(md, 100)).toBe("这是加粗和代码和链接的句子。");
  });

  it("超过 max 截断并加省略号", () => {
    const md = "一二三四五六七八九十";
    expect(excerpt(md, 5)).toBe("一二三四五…");
  });

  it("空字符串返回空串", () => {
    expect(excerpt("", 50)).toBe("");
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

运行：`pnpm vitest run tests/unit/format.test.ts -t excerpt`
预期：FAIL

- [ ] **Step 3: 实现 `excerpt`**

在 `src/lib/format.ts` 追加：

```ts
/** 从原始 markdown 提取纯文本摘要（剥 frontmatter / 标题 / 强调 / 链接 / 代码），按 max 长度截断。 */
export function excerpt(rawMarkdown: string, max = 120): string {
  if (!rawMarkdown) return "";
  let s = rawMarkdown;
  // 剥 frontmatter
  s = s.replace(/^---\n[\s\S]*?\n---\n?/, "");
  // 剥 H1-H6 行
  s = s.replace(/^#{1,6}\s+.*$/gm, "");
  // 剥代码块
  s = s.replace(/```[\s\S]*?```/g, "");
  // 剥行内强调与代码
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/\*([^*]+)\*/g, "$1");
  s = s.replace(/`([^`]+)`/g, "$1");
  // 链接 [text](url) -> text
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // 多余空白
  s = s.replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max) + "…" : s;
}
```

- [ ] **Step 4: 跑测试确认通过**

运行：`pnpm vitest run tests/unit/format.test.ts -t excerpt`
预期：PASS（4 项）

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts tests/unit/format.test.ts
git commit -m "feat(lib): excerpt + 单测"
```

---

## Task 5: format.ts —— `countThisMonth`

**Files:**
- Modify: `src/lib/format.ts`
- Modify: `tests/unit/format.test.ts`

- [ ] **Step 1: 加失败的测试**

import 处加 `countThisMonth`：

```ts
import { formatAgo, getIsoWeek, excerpt, countThisMonth } from "~/lib/format";
```

末尾加：

```ts
describe("countThisMonth", () => {
  const articles = [
    { date: "2026-06-01T00:00:00Z" },
    { date: "2026-06-05T00:00:00Z" },
    { date: "2026-05-30T00:00:00Z" },
    { date: "2025-06-15T00:00:00Z" },
  ];

  it("仅统计当年当月", () => {
    const now = new Date("2026-06-06T00:00:00Z");
    expect(countThisMonth(articles, now)).toBe(2);
  });

  it("空数组返回 0", () => {
    expect(countThisMonth([], new Date())).toBe(0);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

运行：`pnpm vitest run tests/unit/format.test.ts -t countThisMonth`
预期：FAIL

- [ ] **Step 3: 实现 `countThisMonth`**

在 `src/lib/format.ts` 追加：

```ts
/** 统计 articles 中 date 落在 now 所在年月的篇数。 */
export function countThisMonth(
  articles: Array<{ date: string }>,
  now: Date = new Date(),
): number {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return articles.filter((a) => {
    const d = new Date(a.date);
    return d.getUTCFullYear() === y && d.getUTCMonth() === m;
  }).length;
}
```

- [ ] **Step 4: 跑测试确认通过**

运行：`pnpm vitest run tests/unit/format.test.ts -t countThisMonth`
预期：PASS（2 项）

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts tests/unit/format.test.ts
git commit -m "feat(lib): countThisMonth + 单测"
```

---

## Task 6: format.ts —— `buildHeatmap`

**Files:**
- Modify: `src/lib/format.ts`
- Modify: `tests/unit/format.test.ts`

- [ ] **Step 1: 加失败的测试**

import 处加：

```ts
import { formatAgo, getIsoWeek, excerpt, countThisMonth, buildHeatmap } from "~/lib/format";
```

末尾加：

```ts
describe("buildHeatmap", () => {
  const NOW = new Date("2026-06-06T12:00:00Z"); // 周六

  it("默认 26 周 × 7 天 = 182 个 cell", () => {
    const cells = buildHeatmap([], 26, NOW);
    expect(cells).toHaveLength(182);
  });

  it("自定义 weeks 长度", () => {
    expect(buildHeatmap([], 10, NOW)).toHaveLength(70);
  });

  it("同一天多篇累加为 count", () => {
    const articles = [
      { date: "2026-06-05T03:00:00Z" },
      { date: "2026-06-05T15:00:00Z" },
      { date: "2026-06-05T22:00:00Z" },
    ];
    const cells = buildHeatmap(articles, 4, NOW);
    const cell = cells.find((c) => c.date === "2026-06-05");
    expect(cell?.count).toBe(3);
  });

  it("超出 weeks 范围的文章不计入", () => {
    const articles = [{ date: "2024-01-01T00:00:00Z" }];
    const cells = buildHeatmap(articles, 4, NOW);
    expect(cells.every((c) => c.count === 0)).toBe(true);
  });

  it("跨年正常工作", () => {
    const articles = [{ date: "2025-12-30T00:00:00Z" }];
    const cells = buildHeatmap(articles, 30, NOW);
    expect(cells.find((c) => c.date === "2025-12-30")?.count).toBe(1);
  });

  it("时区无关：UTC 同日的不同时刻归为一格", () => {
    const articles = [
      { date: "2026-06-05T00:00:01Z" },
      { date: "2026-06-05T23:59:59Z" },
    ];
    const cells = buildHeatmap(articles, 4, NOW);
    expect(cells.find((c) => c.date === "2026-06-05")?.count).toBe(2);
  });

  it("第一格是本周周一往前推 (weeks-1) 周的周一", () => {
    const cells = buildHeatmap([], 26, NOW);
    // NOW 是 2026-06-06 周六；本周周一 = 2026-06-01；往前 25 周 = 2025-12-08
    expect(cells[0].date).toBe("2025-12-08");
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

运行：`pnpm vitest run tests/unit/format.test.ts -t buildHeatmap`
预期：FAIL

- [ ] **Step 3: 实现 `buildHeatmap`**

在 `src/lib/format.ts` 追加：

```ts
export interface HeatCell {
  date: string;     // YYYY-MM-DD (UTC)
  count: number;
  weekday: number;  // 0=周一, 6=周日
}

/**
 * 生成日历热力矩阵。
 * 返回长度 = weeks × 7 的扁平数组，按"列优先"排列：
 * cell[0..6]   = 第 1 周周一→周日
 * cell[7..13]  = 第 2 周周一→周日
 * ...
 * 最后一列包含 now 所在的周（不论 now 是周几）。
 */
export function buildHeatmap(
  articles: Array<{ date: string }>,
  weeks = 26,
  now: Date = new Date(),
): HeatCell[] {
  // 本周周一（UTC）
  const day = now.getUTCDay() || 7;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - (day - 1));
  // 第一列周一 = monday - (weeks - 1) * 7
  const start = new Date(monday);
  start.setUTCDate(start.getUTCDate() - (weeks - 1) * 7);

  // 文章按 UTC 日期计数
  const counts = new Map<string, number>();
  for (const a of articles) {
    const d = new Date(a.date);
    const key = d.toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const cells: HeatCell[] = [];
  for (let w = 0; w < weeks; w++) {
    for (let dow = 0; dow < 7; dow++) {
      const cur = new Date(start);
      cur.setUTCDate(cur.getUTCDate() + w * 7 + dow);
      const key = cur.toISOString().slice(0, 10);
      cells.push({ date: key, count: counts.get(key) ?? 0, weekday: dow });
    }
  }
  return cells;
}
```

- [ ] **Step 4: 跑测试确认通过**

运行：`pnpm vitest run tests/unit/format.test.ts -t buildHeatmap`
预期：PASS（7 项）

- [ ] **Step 5: 跑全部 format 测试**

运行：`pnpm vitest run tests/unit/format.test.ts`
预期：PASS（4 + 3 + 4 + 2 + 7 = 20 项）

- [ ] **Step 6: Commit**

```bash
git add src/lib/format.ts tests/unit/format.test.ts
git commit -m "feat(lib): buildHeatmap + 单测"
```

---

## Task 7: 重写 RepoCard

**Files:**
- Modify: `src/components/RepoCard.astro`

- [ ] **Step 1: 替换文件内容**

完整覆盖 `src/components/RepoCard.astro`：

```astro
---
import { formatAgo } from "~/lib/format";
interface Props {
  slug: string;
  title: string;
  description: string;
  icon: string;
  articleCount: number;
  latestDate: string;
}
const { slug, title, description, icon, articleCount, latestDate } = Astro.props;
const palettes = [
  "bg-blue-100 text-blue-600",
  "bg-green-100 text-green-600",
  "bg-amber-100 text-amber-600",
  "bg-pink-100 text-pink-600",
  "bg-violet-100 text-violet-600",
  "bg-cyan-100 text-cyan-600",
];
const colorIdx = slug.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % palettes.length;
---
<a
  href={`/${slug}`}
  class="block p-[22px] border border-border rounded-xl bg-bg transition hover:shadow-[0_12px_28px_-16px_rgba(15,23,42,.2)]"
>
  <div class={`w-9 h-9 rounded-[9px] flex items-center justify-center text-lg mb-[14px] ${palettes[colorIdx]}`}>
    {icon}
  </div>
  <h4 class="text-[15px] font-semibold mb-1">{title}</h4>
  <p class="text-[13px] text-text-mute leading-relaxed mb-[14px]">{description}</p>
  <div class="text-xs text-text-faint flex gap-2">
    <span>{articleCount} 篇</span>
    <span>·</span>
    <span>{formatAgo(latestDate)}</span>
  </div>
</a>
```

- [ ] **Step 2: typecheck**

运行：`pnpm typecheck`
预期：通过

- [ ] **Step 3: Commit**

```bash
git add src/components/RepoCard.astro
git commit -m "refactor(RepoCard): 用 formatAgo + 编辑部风样式"
```

---

## Task 8: HomeHero 组件

**Files:**
- Create: `src/components/HomeHero.astro`

- [ ] **Step 1: 创建组件**

```astro
---
import { getIsoWeek } from "~/lib/format";
import type { SiteConfig } from "~/lib/types";

interface Props {
  site: SiteConfig;
  totalArticles: number;
  totalRepos: number;
  latestAgo: string | null;   // null 表示无文章，不显示"最近更新"行
  monthCount: number;
}
const { site, totalArticles, totalRepos, latestAgo, monthCount } = Astro.props;
const now = new Date();
const eyebrow = site.heroEyebrow ?? `${now.getUTCFullYear()} · 第 ${getIsoWeek(now)} 周`;
const titleLine1 = site.heroTitle ?? "把零散的想法";
const titleLine2 = site.heroHighlight ?? "沉淀成可以回看的东西。";
---
<section class="grid grid-cols-[1.4fr_1fr] gap-14 items-end pb-14 pt-4 border-b border-border">
  <div>
    <div class="text-[12px] tracking-[0.18em] uppercase text-accent font-semibold mb-[14px]">
      {eyebrow}
    </div>
    <h1 class="font-extrabold tracking-[-0.02em] leading-[1.05] text-[56px] mb-[18px]">
      {titleLine1}<br />
      <em class="not-italic bg-clip-text text-transparent bg-[linear-gradient(120deg,var(--c-accent)_30%,#7c3aed_80%)] dark:bg-[linear-gradient(120deg,#60a5fa_30%,#a78bfa_80%)]">
        {titleLine2}
      </em>
    </h1>
    <p class="text-[17px] leading-[1.65] text-text-mute max-w-[460px] m-0">
      {site.description}
    </p>
  </div>
  <div class="border-l border-border pl-7 grid gap-4">
    <div class="flex justify-between text-[13px]">
      <span class="text-text-faint">文章总数</span>
      <span class="font-semibold">{totalArticles} 篇</span>
    </div>
    <div class="flex justify-between text-[13px]">
      <span class="text-text-faint">笔记本</span>
      <span class="font-semibold">{totalRepos} 个</span>
    </div>
    {latestAgo && (
      <div class="flex justify-between text-[13px]">
        <span class="text-text-faint">最近更新</span>
        <span class="font-semibold">{latestAgo}</span>
      </div>
    )}
    {monthCount > 0 && (
      <div class="flex justify-between text-[13px]">
        <span class="text-text-faint">本月新增</span>
        <span class="font-semibold">{monthCount} 篇</span>
      </div>
    )}
  </div>
</section>
```

- [ ] **Step 2: typecheck**

运行：`pnpm typecheck`
预期：通过

- [ ] **Step 3: Commit**

```bash
git add src/components/HomeHero.astro
git commit -m "feat(home): HomeHero 组件"
```

---

## Task 9: FeaturedArticle 组件

**Files:**
- Create: `src/components/FeaturedArticle.astro`

- [ ] **Step 1: 创建组件**

```astro
---
import { excerpt } from "~/lib/format";
import type { Article, RepoConfig } from "~/lib/types";

interface Props {
  article: Article;
  repo: RepoConfig;
}
const { article, repo } = Astro.props;
const summary = excerpt(article.rawMarkdown, 120);
// 阅读时长：中文按 800 字符/分钟估算
const minutes = Math.max(1, Math.ceil(article.rawMarkdown.length / 800));
const href = `/${article.repo}/${article.path.join("/")}`;
const dateStr = article.date.slice(0, 10);
---
<section class="py-12 border-b border-border">
  <div class="flex items-baseline justify-between mb-[22px]">
    <h2 class="text-[22px] tracking-[-0.01em] m-0 font-bold">最新</h2>
  </div>
  <a
    href={href}
    class="grid grid-cols-[1.2fr_1fr] gap-9 p-7 border border-border rounded-[14px] bg-[linear-gradient(180deg,#fafbff_0%,#ffffff_100%)] dark:bg-[linear-gradient(180deg,var(--c-bg-elev)_0%,var(--c-bg)_100%)] transition hover:shadow-[0_18px_40px_-22px_rgba(15,23,42,.25)]"
  >
    <div>
      <div class="inline-flex items-center gap-[6px] text-[11px] tracking-[0.14em] uppercase text-accent font-bold mb-[14px]">
        ● 精选 · 最近更新
      </div>
      <h3 class="text-[28px] leading-[1.25] m-0 mb-3 font-bold tracking-[-0.01em]">
        {article.title}
      </h3>
      <p class="text-text-mute leading-[1.7] m-0 mb-[18px] text-[14.5px]">
        {summary}
      </p>
      <div class="text-[12.5px] text-text-faint flex gap-[10px] items-center">
        <span>{repo.icon} {repo.title}</span>
        <span>·</span>
        <span>{dateStr}</span>
        <span>·</span>
        <span>约 {minutes} 分钟阅读</span>
      </div>
    </div>
    <div
      class="h-[200px] rounded-[10px] flex items-center justify-center text-[60px]"
      style="background:
        radial-gradient(circle at 30% 30%, rgba(37,99,235,.18), transparent 60%),
        radial-gradient(circle at 70% 70%, rgba(124,58,237,.18), transparent 60%),
        linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%);"
    >
      {repo.icon}
    </div>
  </a>
</section>
```

- [ ] **Step 2: 暗色模式补丁**

打开 `src/styles/global.css`，在文件末尾追加：

```css
/* FeaturedArticle 缩略图：暗色覆盖 */
.dark .featured-thumb {
  background:
    radial-gradient(circle at 30% 30%, rgba(96,165,250,.16), transparent 60%),
    radial-gradient(circle at 70% 70%, rgba(167,139,250,.16), transparent 60%),
    linear-gradient(135deg, #15181d 0%, #0b0d10 100%) !important;
}
```

然后在 `FeaturedArticle.astro` 缩略图 `<div>` 上加 `class="featured-thumb ..."`：把上面 `<div class="h-[200px] ...">` 改成 `<div class="featured-thumb h-[200px] ...">`。

- [ ] **Step 3: typecheck**

运行：`pnpm typecheck`
预期：通过

- [ ] **Step 4: Commit**

```bash
git add src/components/FeaturedArticle.astro src/styles/global.css
git commit -m "feat(home): FeaturedArticle 组件 + 暗色样式"
```

---

## Task 10: ActivityTimeline 组件

**Files:**
- Create: `src/components/ActivityTimeline.astro`

- [ ] **Step 1: 创建组件**

```astro
---
import type { Article, RepoConfig } from "~/lib/types";

interface Props {
  articles: Article[];     // 已经倒序、已截前 8
  repoMap: Record<string, RepoConfig>;
}
const { articles, repoMap } = Astro.props;
---
<section class="py-12 border-b border-border">
  <div class="flex items-baseline justify-between mb-[22px]">
    <h2 class="text-[22px] tracking-[-0.01em] m-0 font-bold">最近活动</h2>
  </div>
  <div>
    {articles.map((a, i) => {
      const repo = repoMap[a.repo];
      const md = a.date.slice(5, 10);
      const href = `/${a.repo}/${a.path.join("/")}`;
      return (
        <div
          class={`grid grid-cols-[110px_1fr_120px] gap-7 items-baseline py-[14px] text-[14px] ${i > 0 ? "border-t border-border" : ""}`}
        >
          <span class="text-[12px] text-text-faint tabular-nums">{md}</span>
          <a href={href} class="text-text hover:text-accent transition">{a.title}</a>
          <span class="text-[11px] text-text-mute border border-border rounded-full px-2 py-[2px] justify-self-end">
            {repo?.title ?? a.repo}
          </span>
        </div>
      );
    })}
  </div>
</section>
```

- [ ] **Step 2: typecheck**

运行：`pnpm typecheck`
预期：通过

- [ ] **Step 3: Commit**

```bash
git add src/components/ActivityTimeline.astro
git commit -m "feat(home): ActivityTimeline 组件"
```

---

## Task 11: WritingHeatmap 组件

**Files:**
- Create: `src/components/WritingHeatmap.astro`

- [ ] **Step 1: 创建组件**

```astro
---
import { buildHeatmap, type HeatCell } from "~/lib/format";
import type { Article } from "~/lib/types";

interface Props {
  articles: Article[];
  weeks?: number;
}
const { articles, weeks = 26 } = Astro.props;
const cells = buildHeatmap(articles, weeks);

function level(n: number): 0 | 1 | 2 | 3 {
  if (n === 0) return 0;
  if (n === 1) return 1;
  if (n === 2) return 2;
  return 3;
}

// 构造月份标签：扫每列首格（每列 7 cell），找出"该列是月份第一周"的列号
const monthLabels: { col: number; label: string }[] = [];
let lastMonth = -1;
for (let w = 0; w < weeks; w++) {
  const firstCell = cells[w * 7];
  const m = new Date(firstCell.date).getUTCMonth();
  if (m !== lastMonth) {
    monthLabels.push({ col: w, label: `${m + 1}月` });
    lastMonth = m;
  }
}

const lvlClass = ["bg-[var(--c-border)]", "bg-[#c7d2fe] dark:bg-[#3730a3]", "bg-[#818cf8] dark:bg-[#6366f1]", "bg-[#4f46e5] dark:bg-[#a5b4fc]"];
---
<section class="py-12">
  <div class="flex items-baseline justify-between mb-[22px]">
    <h2 class="text-[22px] tracking-[-0.01em] m-0 font-bold">写作热力图</h2>
    <span class="text-[12px] text-text-faint">近 {weeks} 周</span>
  </div>

  <div class="overflow-x-auto">
    <div
      class="grid gap-[3px]"
      style={`grid-template-columns: repeat(${weeks}, minmax(12px, 1fr)); grid-template-rows: repeat(7, 1fr); grid-auto-flow: column;`}
    >
      {cells.map((c: HeatCell) => (
        <div
          class={`aspect-square rounded-[2px] ${lvlClass[level(c.count)]}`}
          title={`${c.date} · ${c.count} 篇`}
        />
      ))}
    </div>

    {monthLabels.length > 0 && (
      <div
        class="mt-2 grid text-[11px] text-text-faint"
        style={`grid-template-columns: repeat(${weeks}, minmax(12px, 1fr));`}
      >
        {monthLabels.map((m) => (
          <span style={`grid-column: ${m.col + 1};`}>{m.label}</span>
        ))}
      </div>
    )}

    <div class="mt-4 flex items-center gap-[6px] text-[11px] text-text-faint justify-end">
      <span>少</span>
      {[0, 1, 2, 3].map((l) => (
        <span class={`inline-block w-[10px] h-[10px] rounded-[2px] ${lvlClass[l]}`} />
      ))}
      <span>多</span>
    </div>
  </div>
</section>
```

> **关键**：`grid-auto-flow: column` 让 cells 按列填充（cell[0..6] = 第 1 列上→下），与 `buildHeatmap` 的输出顺序一致；这样无需为每个 cell 指定 `grid-column`/`grid-row`。

- [ ] **Step 2: typecheck**

运行：`pnpm typecheck`
预期：通过

- [ ] **Step 3: Commit**

```bash
git add src/components/WritingHeatmap.astro
git commit -m "feat(home): WritingHeatmap 组件"
```

---

## Task 12: 重写 index.astro

**Files:**
- Modify: `src/pages/index.astro`

- [ ] **Step 1: 完整覆盖**

```astro
---
import HomeLayout from "~/layouts/HomeLayout.astro";
import HomeHero from "~/components/HomeHero.astro";
import FeaturedArticle from "~/components/FeaturedArticle.astro";
import RepoCard from "~/components/RepoCard.astro";
import ActivityTimeline from "~/components/ActivityTimeline.astro";
import WritingHeatmap from "~/components/WritingHeatmap.astro";
import { formatAgo, countThisMonth } from "~/lib/format";
import { readFile } from "node:fs/promises";
import type { PapyrusConfig, Article } from "~/lib/types";

const cache = JSON.parse(await readFile(".cache/articles.json", "utf-8")) as {
  config: PapyrusConfig;
  articles: Article[];
};
const { config, articles } = cache;

// 按日期倒序
const sorted = [...articles].sort((a, b) => (a.date < b.date ? 1 : -1));

const totalArticles = articles.length;
const totalRepos = config.repos.length;
const latestDate = sorted[0]?.date ?? null;
const latestAgo = latestDate ? formatAgo(latestDate) : null;
const monthCount = countThisMonth(articles);

const repoMap: Record<string, typeof config.repos[number]> = {};
for (const r of config.repos) repoMap[r.slug] = r;

const repoStats = config.repos.map((r) => {
  const list = articles.filter((a) => a.repo === r.slug);
  const latest = list.reduce(
    (acc, a) => (a.date > acc ? a.date : acc),
    "1970-01-01T00:00:00Z",
  );
  return { ...r, articleCount: list.length, latestDate: latest };
});

const featured = sorted[0] ?? null;
const featuredRepo = featured ? repoMap[featured.repo] : null;
const recent = sorted.slice(0, 8);

// 笔记本网格列数
const repoCols = totalRepos >= 3 ? "grid-cols-3" : totalRepos === 2 ? "grid-cols-2" : "grid-cols-1";
const showNotebooks = totalRepos >= 2;
---
<HomeLayout title={config.site.name} description={config.site.description}>
  <HomeHero
    site={config.site}
    totalArticles={totalArticles}
    totalRepos={totalRepos}
    latestAgo={latestAgo}
    monthCount={monthCount}
  />

  {featured && featuredRepo && (
    <FeaturedArticle article={featured} repo={featuredRepo} />
  )}

  {showNotebooks && (
    <section class="py-12 border-b border-border">
      <div class="flex items-baseline justify-between mb-[22px]">
        <h2 class="text-[22px] tracking-[-0.01em] m-0 font-bold">笔记本</h2>
      </div>
      <div class={`grid ${repoCols} gap-[18px]`}>
        {repoStats.map((r) => <RepoCard {...r} />)}
      </div>
    </section>
  )}

  {recent.length > 0 && (
    <ActivityTimeline articles={recent} repoMap={repoMap} />
  )}

  {articles.length > 0 && (
    <WritingHeatmap articles={articles} />
  )}
</HomeLayout>
```

- [ ] **Step 2: typecheck**

运行：`pnpm typecheck`
预期：通过

- [ ] **Step 3: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat(home): 五段式主页 (Hero/Featured/Notebooks/Activity/Heatmap)"
```

---

## Task 13: 视觉验证

**Files:**
- (无文件改动；仅本地验证)

- [ ] **Step 1: 启动 dev server**

```bash
pnpm dev
```

打开 `http://localhost:4321/`

- [ ] **Step 2: 验证当前数据状态（1 repo）**

预期：
- Hero 显示，meta 条 3-4 行
- Featured 大卡显示最新文章
- **笔记本 section 不显示**（因为 totalRepos === 1）
- Activity 时间轴显示文章列表
- Heatmap 显示，最近活跃格有色

- [ ] **Step 3: 切换暗色模式验证**

点击右上角主题切换按钮，确认：
- 渐变高亮文字在暗色下清晰可见
- Featured 大卡背景不再是白色
- Heatmap 色阶切到暗色调色板

- [ ] **Step 4: 临时模拟多 repo 状态**

临时编辑 `papyrus.config.json`，复制 `xin-skills` 项 2 次，改 `slug` 为 `xin-skills-2` / `xin-skills-3`，对应改 `title` / `icon`。

然后：

```bash
pnpm tsx scripts/prebuild.ts
```

刷新浏览器，预期看到 3 列的笔记本网格。

**验证后还原：**

```bash
git checkout papyrus.config.json
pnpm tsx scripts/prebuild.ts
```

- [ ] **Step 5: 检查终端无报错**

dev server 终端应无 warning / error。typecheck 在 dev 模式下也运行：

```bash
pnpm typecheck
```

预期：0 errors。

- [ ] **Step 6: 关掉 .tmp-mockups 目录**

```bash
echo ".tmp-mockups/" >> .gitignore
git add .gitignore
git commit -m "chore: ignore .tmp-mockups/"
```

---

## Self-Review Checklist

| Spec 节 | 实现任务 |
|---|---|
| 1. Hero（含 eyebrow / 渐变高亮 / 4 行 meta / 0 行隐藏） | Task 1 (类型) + Task 3 (getIsoWeek) + Task 8 (HomeHero) |
| 2. Featured 大卡（120 字摘要 / 阅读时长 / emoji 缩略图） | Task 4 (excerpt) + Task 9 (FeaturedArticle) |
| 3. Notebooks 自适应（1 隐 / 2 列 / 3 列） | Task 7 (RepoCard) + Task 12 (index.astro 中条件渲染) |
| 4. Activity 时间轴（倒序前 8、MM-DD、胶囊标签） | Task 10 (ActivityTimeline) + Task 12 (倒序与 slice) |
| 5. Heatmap（26 周 / 4 级色阶 / 暗色 / hover / 月份标签 / 图例） | Task 6 (buildHeatmap) + Task 11 (WritingHeatmap) |
| 数据来源与计算（totalArticles / monthCount / latestAgo） | Task 2 + Task 5 + Task 12 |
| 工具函数（formatAgo / getIsoWeek / excerpt / buildHeatmap / countThisMonth） | Task 2-6 全部 TDD |
| 类型变更（site 加 3 可选字段） | Task 1 |
| 暗色模式（渐变 / Featured 背景 / Heatmap 色阶） | Task 8 (Hero 渐变内联) + Task 9 (Featured 暗色补丁) + Task 11 (Heatmap 暗色色阶) |
| 边界（articles=0 / repos=1 / wordCount 不可得） | Task 8 (latestAgo null) + Task 12 (条件渲染) + Task 9 (按字符数估算) |
| 验证（dev / typecheck / 切主题 / 模拟 3 repo） | Task 13 |

**Placeholder 扫描**：无 TBD / TODO / "略" / "类似上面"。

**类型一致性**：`HeatCell` 在 Task 6 定义并 export，Task 11 import；`SiteConfig` 在 Task 1 扩展，Task 8 import；`RepoConfig` 在原 `types.ts` 已定义，Task 9/10 直接 import。

**已知风险 / 跟踪点**：
- `RepoCard` hover 阴影直接写在 `class` 里（用任意值语法），如果项目偏好抽到 CSS 文件再迁
- Heatmap 月份标签按"该列第一天所在月份变化"打标，月份在周中切换时标签会落在该月的第一个完整周列上而非真正第一天；GitHub 同样如此处理，视觉无碍
- 主页文章 URL 用 `/${repo}/${path.join('/')}` 构造，与 `src/pages/[repo]/[...path].astro` 的 `getStaticPaths` 完全一致 — 但若以后改路由模板需要同步更新组件

---

## Execution

Plan complete and saved to `docs/superpowers/plans/2026-06-06-homepage-redesign.md`. Two execution options:

1. **Subagent-Driven (recommended)** — 我每个 Task dispatch 一个独立 subagent，两阶段 review，迭代快
2. **Inline Execution** — 在当前会话里按 task batch 执行，含 checkpoint review

Which approach?
