import { z } from "zod";
import { readFile } from "node:fs/promises";
import type { PapyrusConfig } from "./types.js";

const TagSlug = z.string().regex(/^[a-z0-9-]+$/, "tag slug 只能含 [a-z0-9-]");

const RepoSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, "slug 只能含 [a-z0-9-]"),
  title: z.string().min(1),
  description: z.string().min(1),
  icon: z.string().min(1),
  source: z.string().regex(/^github\.com\/[^/]+\/[^/]+$/, "source 必须形如 github.com/owner/repo"),
  branch: z.string().default("main"),
  tags: z.array(TagSlug).optional(),
});

const TagSchema = z.object({
  title: z.string().min(1),
  icon: z.string().optional(),
  description: z.string().optional(),
});

const ConfigSchema = z.object({
  site: z.object({
    name: z.string().min(1),
    description: z.string(),
    heroTitle: z.string().optional(),
    heroHighlight: z.string().optional(),
    heroEyebrow: z.string().optional(),
  }),
  repos: z.array(RepoSchema).min(1, "至少需要 1 个 repo"),
  tags: z.record(TagSlug, TagSchema).optional(),
}).refine(
  (c) => new Set(c.repos.map(r => r.slug)).size === c.repos.length,
  { message: "repos[].slug 必须唯一" }
).refine(
  (c) => {
    const declared = new Set(Object.keys(c.tags ?? {}));
    for (const r of c.repos) {
      for (const t of r.tags ?? []) if (!declared.has(t)) return false;
    }
    return true;
  },
  { message: "repos[].tags 中的 tag 必须先在顶层 tags 字典中声明" }
);

export async function loadConfig(path = "papyrus.config.json"): Promise<PapyrusConfig> {
  const raw = await readFile(path, "utf-8");
  const parsed = JSON.parse(raw);
  return ConfigSchema.parse(parsed) as PapyrusConfig;
}

export function parseSource(source: string): { owner: string; repo: string } {
  const m = source.match(/^github\.com\/([^/]+)\/([^/]+)$/);
  if (!m) throw new Error(`无效 source: ${source}`);
  return { owner: m[1], repo: m[2] };
}
