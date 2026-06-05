import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://blog.example.com",
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
