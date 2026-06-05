import { Octokit } from "@octokit/rest";

const token = process.env.GITHUB_TOKEN;
export const octokit = new Octokit({ auth: token || undefined });

interface RepoRef { owner: string; repo: string; branch: string; }
interface FileRef { owner: string; repo: string; path: string; }

export async function listMarkdownFiles(ref: RepoRef): Promise<string[]> {
  const res = await octokit.git.getTree({
    owner: ref.owner,
    repo: ref.repo,
    tree_sha: ref.branch,
    recursive: "1",
  });
  return (res.data.tree ?? [])
    .filter(n => n.type === "blob" && typeof n.path === "string" && n.path.endsWith(".md"))
    .map(n => n.path!);
}

export async function fetchFileContent(ref: FileRef): Promise<string> {
  const res = await octokit.repos.getContent({
    owner: ref.owner, repo: ref.repo, path: ref.path,
  });
  const data = res.data as { content?: string; encoding?: string };
  if (!data.content) throw new Error(`No content: ${ref.path}`);
  return Buffer.from(data.content, (data.encoding ?? "base64") as BufferEncoding).toString("utf-8");
}

export async function fetchLastCommitDate(ref: FileRef): Promise<string> {
  const res = await octokit.repos.listCommits({
    owner: ref.owner, repo: ref.repo, path: ref.path, per_page: 1,
  });
  const c = res.data[0];
  return c?.commit?.committer?.date ?? "1970-01-01T00:00:00Z";
}
