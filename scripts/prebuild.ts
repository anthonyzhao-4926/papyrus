#!/usr/bin/env tsx
import { mkdir, writeFile } from "node:fs/promises";
import { loadConfig } from "../src/lib/config.js";
import { loadAllArticles } from "../src/lib/content-loader.js";

async function main() {
  console.log("[prebuild] 读取 papyrus.config.json...");
  const config = await loadConfig();
  console.log(`[prebuild] 配置了 ${config.repos.length} 个 repo`);

  console.log("[prebuild] 拉取所有 repo 的 markdown...");
  const articles = await loadAllArticles(config);
  console.log(`[prebuild] 共 ${articles.length} 篇文章`);

  // 按 repo 校验：每个 repo 至少 1 篇
  for (const repo of config.repos) {
    const n = articles.filter(a => a.repo === repo.slug).length;
    if (n === 0) {
      console.warn(`[prebuild] ⚠️  repo ${repo.slug} 没拉到任何 .md（可能配错 source/branch）`);
    } else {
      console.log(`[prebuild]   - ${repo.slug}: ${n} 篇`);
    }
  }

  await mkdir(".cache", { recursive: true });
  await writeFile(
    ".cache/articles.json",
    JSON.stringify({ config, articles }, null, 2),
    "utf-8"
  );
  console.log("[prebuild] 缓存写入 .cache/articles.json");
}

main().catch((e) => {
  console.error("[prebuild] 失败:", e);
  process.exit(1);
});
