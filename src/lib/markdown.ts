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

// 提取 h1/h2/h3 形成 TOC，并按 1./1.1/1.1.1 风格自动编号写入 toc.text。
// 编号仅出现在 TOC，正文 hast 节点不被修改。若缺失某层级（如未写 h1），
// 降级展示：h2 直接 1./2.，h3 直接 1.1/1.2。
function extractToc() {
  const depthOf: Record<string, number> = { h1: 1, h2: 2, h3: 3 };
  return (tree: any, file: any) => {
    const toc: TocItem[] = [];
    let h1 = 0;
    let h2 = 0;
    let h3 = 0;
    visit(tree, "element", (node: any) => {
      const depth = depthOf[node.tagName];
      if (!depth) return;
      const id = node.properties?.id;
      if (typeof id !== "string") return;
      const text = collectText(node);
      let prefix = "";
      if (depth === 1) {
        h1 += 1; h2 = 0; h3 = 0;
        prefix = `${h1}. `;
      } else if (depth === 2) {
        h2 += 1; h3 = 0;
        prefix = h1 > 0 ? `${h1}.${h2} ` : `${h2}. `;
      } else {
        h3 += 1;
        prefix =
          h1 > 0 && h2 > 0 ? `${h1}.${h2}.${h3} `
          : h2 > 0 ? `${h2}.${h3} `
          : `${h3}. `;
      }
      toc.push({ id, text: prefix + text, depth });
    });
    file.data.toc = toc;
  };
}

// 在 shiki 渲染后，把每个 <pre> 包一层 <div class="code-block">，
// 并在前面插入一个 <button class="copy-btn"> 兄弟节点。
// 原始代码字符串 base64 编码后写到 button 的 data-copy-source 上，
// 客户端 JS 解码后写剪贴板。
function withCopyButton() {
  return (tree: any) => {
    visit(tree, "element", (node: any, index: number | undefined, parent: any) => {
      if (node.tagName !== "pre" || index === undefined || !parent) return;
      const cls = parent.properties?.className;
      if (parent.tagName === "div" && Array.isArray(cls) && cls.includes("code-block")) {
        return;
      }
      const code = collectText(node);
      const b64 = Buffer.from(code, "utf-8").toString("base64");
      const button = {
        type: "element",
        tagName: "button",
        properties: {
          type: "button",
          className: ["copy-btn"],
          "data-copy-source": b64,
          "aria-label": "复制代码",
        },
        children: [
          {
            type: "element",
            tagName: "span",
            properties: { className: ["copy-icon", "copy-icon-copy"] },
            children: [{ type: "text", value: "📋" }],
          },
          {
            type: "element",
            tagName: "span",
            properties: { className: ["copy-icon", "copy-icon-done"] },
            children: [{ type: "text", value: "✓" }],
          },
        ],
      };
      const wrapper = {
        type: "element",
        tagName: "div",
        properties: { className: ["code-block"] },
        children: [button, node],
      };
      parent.children[index] = wrapper;
      return ["skip", index + 1];
    });
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
    .use(withCopyButton)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(md);

  return {
    html: String(file),
    toc: (file.data.toc as TocItem[]) ?? [],
  };
}
