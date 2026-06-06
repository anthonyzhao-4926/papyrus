import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";
import { readFileSync } from "node:fs";

// 从 papyrus.config.json 读取 dev/preview 服务端口（默认 5233）
function resolvePort() {
  try {
    const cfg = JSON.parse(readFileSync("./papyrus.config.json", "utf-8"));
    return cfg.server?.port ?? 5233;
  } catch {
    return 5233;
  }
}

export default defineConfig({
  site: "https://blog.example.com",
  server: { port: resolvePort() },
  integrations: [tailwind({ applyBaseStyles: false }), sitemap()],
  markdown: {
    syntaxHighlight: false,
  },
  vite: {
    resolve: {
      alias: { "~": new URL("./src", import.meta.url).pathname },
    },
    build: {
      rollupOptions: {
        external: ["/pagefind/pagefind.js"],
      },
    },
  },
});
