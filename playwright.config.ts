import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: "http://localhost:4321" },
  webServer: {
    // 跳过 prebuild：直接复用现有 .cache/articles.json（本机可能无 GITHUB_TOKEN）
    command:
      "pnpm exec astro build && pnpm exec pagefind --site dist && pnpm exec astro preview --port 4321",
    url: "http://localhost:4321",
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium", viewport: { width: 1440, height: 900 } },
    },
  ],
});
