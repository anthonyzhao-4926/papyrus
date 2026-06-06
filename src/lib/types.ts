export interface SiteConfig {
  name: string;
  description: string;
  heroTitle?: string;
  heroHighlight?: string;
  heroEyebrow?: string;
}

export interface RepoConfig {
  slug: string;
  title: string;
  description: string;
  icon: string;
  source: string;     // github.com/{owner}/{repo}
  branch: string;     // 默认 main
  tags?: string[];    // 引用 PapyrusConfig.tags 中的 key
}

export interface TagConfig {
  title: string;      // 中文标签名
  icon?: string;      // emoji 或字符图标
  description?: string; // tag 页面顶部描述；支持 {count} 占位符代入笔记本数
}

export interface ServerConfig {
  port: number;       // dev / preview 服务端口，默认 5233
}

export interface PapyrusConfig {
  site: SiteConfig;
  server: ServerConfig;
  repos: RepoConfig[];
  tags?: Record<string, TagConfig>;  // tag slug → 显示信息
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
  depth: number;         // 1 = h1, 2 = h2, 3 = h3
}
