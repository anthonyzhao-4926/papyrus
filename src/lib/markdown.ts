import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeShiki from "@shikijs/rehype";
import rehypeStringify from "rehype-stringify";
import { visit } from "unist-util-visit";
import type { TocItem } from "./types.js";

function collectText(node: any): string {
  if (node.type === "text") return node.value ?? "";
  if (Array.isArray(node.children)) return node.children.map(collectText).join("");
  return "";
}

// 自动为 h1/h2/h3 生成层级编号（1. / 1.1 / 1.1.1）。在 rehype-slug 之后、
// extractToc 之前执行：id 基于原始文本生成（稳定），而 TOC 与可见标题都包
// 含编号。若某层级缺失（如没写 h1，直接从 h2 开始），降级展示。
function numberHeadings() {
  return (tree: any) => {
    let h1 = 0;
    let h2 = 0;
    let h3 = 0;
    visit(tree, "element", (node: any) => {
      let prefix: string | null = null;
      if (node.tagName === "h1") {
        h1 += 1;
        h2 = 0;
        h3 = 0;
        prefix = `${h1}. `;
      } else if (node.tagName === "h2") {
        h2 += 1;
        h3 = 0;
        prefix = h1 > 0 ? `${h1}.${h2} ` : `${h2}. `;
      } else if (node.tagName === "h3") {
        h3 += 1;
        prefix =
          h1 > 0 && h2 > 0 ? `${h1}.${h2}.${h3} `
          : h2 > 0 ? `${h2}.${h3} `
          : `${h3}. `;
      }
      if (prefix === null) return;
      node.children = [
        {
          type: "element",
          tagName: "span",
          properties: { className: ["heading-no"] },
          children: [{ type: "text", value: prefix }],
        },
        ...(node.children ?? []),
      ];
    });
  };
}

function extractToc() {
  const depthOf: Record<string, number> = { h1: 1, h2: 2, h3: 3 };
  return (tree: any, file: any) => {
    const toc: TocItem[] = [];
    visit(tree, "element", (node: any) => {
      const depth = depthOf[node.tagName];
      if (!depth) return;
      const id = node.properties?.id;
      if (typeof id !== "string") return;
      const text = collectText(node);
      toc.push({ id, text, depth });
    });
    file.data.toc = toc;
  };
}

function resolveRelative(base: string[], rel: string): string[] {
  const segs = [...base];
  for (const part of rel.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") segs.pop();
    else segs.push(part);
  }
  return segs;
}

// 把 markdown 内的相对 .md 链接重写为站内绝对路由 /{repo}/{path}（去掉 .md）。
// 外链 / 锚点 / 已是绝对路径 / mailto: 等一律不动。
function rewriteMdLinks(opts: { repoSlug: string; currentPath: string[] }) {
  return (tree: any) => {
    visit(tree, "element", (node: any) => {
      if (node.tagName !== "a") return;
      const href = node.properties?.href;
      if (typeof href !== "string") return;
      if (/^([a-z][a-z0-9+.-]*:|\/\/|#|\/)/i.test(href)) return;
      const m = href.match(/^([^?#]+?)\.md(#[^?]*)?$/i);
      if (!m) return;
      const baseDir = opts.currentPath.slice(0, -1);
      const target = resolveRelative(baseDir, m[1]);
      node.properties.href = `/${opts.repoSlug}/${target.join("/")}${m[2] ?? ""}`;
    });
  };
}

export interface RenderOptions {
  repoSlug: string;
  currentPath: string[];
}

export async function renderMarkdown(
  md: string,
  opts?: RenderOptions,
): Promise<{ html: string; toc: TocItem[] }> {
  let pipeline = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSlug)
    .use(numberHeadings)
    .use(extractToc);
  if (opts) pipeline = pipeline.use(rewriteMdLinks, opts);
  const file = await pipeline
    .use(rehypeAutolinkHeadings, { behavior: "wrap" })
    .use(rehypeKatex)
    .use(rehypeShiki, {
      themes: { light: "github-light", dark: "github-dark" },
      defaultColor: false,
    })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(md);

  return {
    html: String(file),
    toc: (file.data.toc as TocItem[]) ?? [],
  };
}
