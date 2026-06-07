import type { Article, TreeNode } from "./types.js";

export function buildTree(articles: Article[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const article of articles) {
    let cursor = root;
    const segs = article.path;
    for (let i = 0; i < segs.length; i++) {
      const isLeaf = i === segs.length - 1;
      const name = segs[i];
      const fullPath = segs.slice(0, i + 1);
      let node = cursor.find(n => n.name === name && (isLeaf ? n.type === "file" : n.type === "dir"));
      if (!node) {
        node = isLeaf
          ? { name, type: "file", path: fullPath, article }
          : { name, type: "dir", path: fullPath, children: [] };
        cursor.push(node);
      }
      if (!isLeaf) cursor = node.children!;
    }
  }

  return sortTree(root);
}

const README_RE = /^readme$/i;

// 排序优先级：README 置顶 > 目录 > 普通文件
function rank(node: TreeNode): number {
  if (node.type === "file" && README_RE.test(node.name)) return 0;
  return node.type === "dir" ? 1 : 2;
}

function sortTree(nodes: TreeNode[]): TreeNode[] {
  nodes.sort((a, b) => {
    const ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });
  for (const n of nodes) if (n.children) sortTree(n.children);
  return nodes;
}

// 取 repo 根目录的 README（用作默认页内容）
export function findReadme(articles: Article[]): Article | undefined {
  return articles.find(a => a.path.length === 1 && README_RE.test(a.path[0]));
}
