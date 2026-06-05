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

function extractToc() {
  return (tree: any, file: any) => {
    const toc: TocItem[] = [];
    visit(tree, "element", (node: any) => {
      if (node.tagName === "h2" || node.tagName === "h3") {
        const depth = node.tagName === "h2" ? 2 : 3;
        const id = node.properties?.id;
        if (typeof id !== "string") return;
        const text = collectText(node);
        toc.push({ id, text, depth });
      }
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
