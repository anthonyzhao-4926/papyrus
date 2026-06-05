import { createHash } from "node:crypto";
import { mkdir, writeFile, access } from "node:fs/promises";
import { join, extname } from "node:path";

const PUBLIC_DIR = "public/images";

/**
 * 把 markdown 中所有相对路径图片下载到 public/images/{repo}/{hash}.{ext}
 * 并把 markdown 里的 src 改写为 /images/{repo}/{hash}.{ext}
 * 绝对 URL (http/https) 跳过
 */
export async function processImages(
  md: string,
  repoSlug: string,
  rawBaseUrl: string  // 例: https://raw.githubusercontent.com/me/x/main/docs/
): Promise<string> {
  const regex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const replacements: Array<{ from: string; to: string }> = [];

  for (const match of md.matchAll(regex)) {
    const [whole, alt, src] = match;
    if (/^https?:\/\//.test(src)) continue;

    const fullUrl = new URL(src, rawBaseUrl).toString();
    const localPath = await downloadAndCache(fullUrl, repoSlug);
    replacements.push({ from: whole, to: `![${alt}](${localPath})` });
  }

  let out = md;
  for (const r of replacements) out = out.replace(r.from, r.to);
  return out;
}

async function downloadAndCache(url: string, repoSlug: string): Promise<string> {
  const hash = createHash("sha1").update(url).digest("hex").slice(0, 12);
  const ext = extname(new URL(url).pathname).toLowerCase() || ".png";
  const dir = join(PUBLIC_DIR, repoSlug);
  const fileName = `${hash}${ext}`;
  const filePath = join(dir, fileName);
  const publicUrl = `/images/${repoSlug}/${fileName}`;

  try {
    await access(filePath);
    return publicUrl;
  } catch { /* not cached, download */ }

  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`[images] 下载失败 ${url}: ${res.status}`);
    return url; // fallback
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(dir, { recursive: true });
  await writeFile(filePath, buf);
  return publicUrl;
}
