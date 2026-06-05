import type { PapyrusConfig, Article } from "./types.js";
import { parseSource } from "./config.js";
import { listMarkdownFiles, fetchFileContent, fetchLastCommitDate } from "./github.js";

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

function parseFrontmatter(md: string): { meta: Record<string, string>; body: string } {
  const m = md.match(FRONTMATTER);
  if (!m) return { meta: {}, body: md };
  const meta: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w+):\s*(.+)$/);
    if (kv) meta[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
  }
  return { meta, body: m[2] };
}

function pathToSegments(filePath: string): string[] {
  return filePath.replace(/\.md$/i, "").split("/");
}

export async function loadAllArticles(config: PapyrusConfig): Promise<Article[]> {
  const all: Article[] = [];
  for (const repo of config.repos) {
    const { owner, repo: name } = parseSource(repo.source);
    const files = await listMarkdownFiles({ owner, repo: name, branch: repo.branch });
    for (const file of files) {
      const [raw, commitDate] = await Promise.all([
        fetchFileContent({ owner, repo: name, path: file }),
        fetchLastCommitDate({ owner, repo: name, path: file }),
      ]);
      const { meta, body } = parseFrontmatter(raw);
      const segs = pathToSegments(file);
      const title = meta.title ?? segs[segs.length - 1];
      const date = meta.date ? new Date(meta.date).toISOString() : commitDate;
      all.push({
        repo: repo.slug,
        path: segs,
        title,
        date,
        rawMarkdown: body,
        icon: meta.icon,
      });
    }
  }
  return all;
}
