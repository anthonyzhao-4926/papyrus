export interface SiteConfig {
  name: string;
  description: string;
  url: string;
}

export interface RepoConfig {
  slug: string;
  title: string;
  description: string;
  icon: string;
  source: string;     // github.com/{owner}/{repo}
  branch: string;     // 默认 main
}

export interface PapyrusConfig {
  site: SiteConfig;
  repos: RepoConfig[];
}

export interface Article {
  repo: string;          // repo slug
  path: string[];        // 不含 .md 的路径段，如 ["frontend", "react-hooks"]
  title: string;
  date: string;          // ISO8601
  rawMarkdown: string;
  icon?: string;
}

export interface TreeNode {
  name: string;          // 显示名（文件名 / 目录名）
  type: "file" | "dir";
  path: string[];        // 完整路径段（文件不含 .md 后缀）
  children?: TreeNode[];
  article?: Article;     // type === "file" 时挂载
}

export interface RenderedArticle extends Article {
  html: string;
  toc: TocItem[];
}

export interface TocItem {
  id: string;
  text: string;
  depth: number;         // 2 = h2, 3 = h3
}
