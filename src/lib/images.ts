import { createHash } from "node:crypto";
import { mkdir, writeFile, access } from "node:fs/promises";
import { join, extname } from "node:path";

const PUBLIC_DIR = "public/images";

interface ImageRef {
  whole: string;
  src: string;
  replace: (newSrc: string) => string;
}

function shouldSkipImageSrc(src: string): boolean {
  return /^https?:\/\//i.test(src) || src.startsWith("/");
}

function collectImageRefs(md: string): ImageRef[] {
  const refs: ImageRef[] = [];

  for (const match of md.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)) {
    const [whole, alt, src] = match;
    refs.push({
      whole,
      src: src.trim(),
      replace: (newSrc) => `![${alt}](${newSrc})`,
    });
  }

  // 兼容正文里直接写 HTML <img>（常见于导出工具），markdown 语法 ![]() 已在上面处理。
  for (const match of md.matchAll(/<img\b[^>]*>/gi)) {
    const whole = match[0];
    const srcMatch = whole.match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i);
    if (!srcMatch) continue;
    const src = (srcMatch[1] ?? srcMatch[2] ?? srcMatch[3]).trim();
    refs.push({
      whole,
      src,
      replace: (newSrc) => {
        const quote = srcMatch[1] !== undefined ? `"` : srcMatch[2] !== undefined ? `'` : `"`;
        return whole.replace(srcMatch[0], `src=${quote}${newSrc}${quote}`);
      },
    });
  }

  return refs;
}

/**
 * 把 markdown 中所有相对路径图片下载到 public/images/{repo}/{hash}.{ext}
 * 并把 markdown / HTML img 里的 src 改写为 /images/{repo}/{hash}.{ext}
 * 绝对 URL (http/https) 与已是 / 开头的站内路径跳过
 */
export async function processImages(
  md: string,
  repoSlug: string,
  rawBaseUrl: string  // 例: https://raw.githubusercontent.com/me/x/main/docs/
): Promise<string> {
  const refs = collectImageRefs(md);
  const resolved = new Map<string, string>();
  let out = md;

  for (const ref of refs) {
    if (shouldSkipImageSrc(ref.src)) continue;

    let localPath = resolved.get(ref.src);
    if (!localPath) {
      const fullUrl = new URL(ref.src, rawBaseUrl).toString();
      localPath = await downloadAndCache(fullUrl, repoSlug);
      resolved.set(ref.src, localPath);
    }
    out = out.replaceAll(ref.whole, ref.replace(localPath));
  }

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
