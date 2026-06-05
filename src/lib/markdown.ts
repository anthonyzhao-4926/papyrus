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
import { toString } from "mdast-util-to-string";
import type { TocItem } from "./types.js";

function extractToc() {
  return (tree: any, file: any) => {
    const toc: TocItem[] = [];
    visit(tree, "heading", (node: any) => {
      if (node.depth === 2 || node.depth === 3) {
        const text = toString(node);
        toc.push({ id: text, text, depth: node.depth });
      }
    });
    file.data.toc = toc;
  };
}

export async function renderMarkdown(md: string): Promise<{ html: string; toc: TocItem[] }> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(extractToc)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSlug)
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
