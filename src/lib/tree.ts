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

function sortTree(nodes: TreeNode[]): TreeNode[] {
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const n of nodes) if (n.children) sortTree(n.children);
  return nodes;
}
