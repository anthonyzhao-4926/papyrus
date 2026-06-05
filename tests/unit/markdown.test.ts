import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { renderMarkdown } from "~/lib/markdown";

const fixture = await readFile(new URL("../fixtures/sample.md", import.meta.url), "utf-8");

describe("renderMarkdown", () => {
  it("产出 html 与 toc", async () => {
    const { html, toc } = await renderMarkdown(fixture);
    expect(typeof html).toBe("string");
    expect(toc.length).toBeGreaterThan(0);
  });

  it("代码块经过 shiki 高亮（含 token span）", async () => {
    const { html } = await renderMarkdown(fixture);
    expect(html).toContain('class="shiki');
    // 双主题模式（defaultColor: false）下 shiki 用 CSS 变量 --shiki-light/--shiki-dark 而不是直接的 color
    expect(html).toMatch(/<span\s+style="[^"]*--shiki-(light|dark)/);
  });

  it("标题带有 anchor id 和自链接", async () => {
    const { html } = await renderMarkdown(fixture);
    expect(html).toMatch(/<h2[^>]*id="二级标题"/);
    expect(html).toMatch(/<a[^>]+href="#二级标题"/);
  });

  it("数学公式被 KaTeX 渲染", async () => {
    const { html } = await renderMarkdown(fixture);
    expect(html).toContain('class="katex');
  });

  it("toc 包含 h2", async () => {
    const { toc } = await renderMarkdown(fixture);
    const h2 = toc.find(t => t.depth === 2);
    expect(h2?.text).toBe("二级标题");
    expect(h2?.id).toBe("二级标题");
  });

  it("内部 .md 链接被重写为绝对路由", async () => {
    const md = [
      "[同级](sibling.md)",
      "[子目录](references/style-reference.md)",
      "[父级](../shared/index.md)",
      "[带锚点](other.md#section-1)",
      "[外链](https://example.com/x.md)",
      "[锚点](#local)",
      "[绝对](/already/abs.md)",
      "[非 md](something.txt)",
    ].join("\n\n");
    const { html } = await renderMarkdown(md, {
      repoSlug: "notes",
      currentPath: ["guides", "intro"],
    });
    expect(html).toContain('href="/notes/guides/sibling"');
    expect(html).toContain('href="/notes/guides/references/style-reference"');
    expect(html).toContain('href="/notes/shared/index"');
    expect(html).toContain('href="/notes/guides/other#section-1"');
    expect(html).toContain('href="https://example.com/x.md"');
    expect(html).toContain('href="#local"');
    expect(html).toContain('href="/already/abs.md"');
    expect(html).toContain('href="something.txt"');
  });
});
