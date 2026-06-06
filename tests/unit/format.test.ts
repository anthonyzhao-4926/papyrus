import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  formatAgo,
  getIsoWeek,
  excerpt,
  countThisMonth,
  buildHeatmap,
} from "~/lib/format";

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

describe("buildHeatmap", () => {
  const NOW = new Date("2026-06-06T12:00:00Z");

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
    expect(cells[0].date).toBe("2025-12-08");
  });
});
