import { test, expect } from "@playwright/test";

test("smoke: 首页 → repo → 文章 → 搜索 → 暗色", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("欢迎");

  // 进入第一个 repo
  const firstCard = page.locator("a[href^='/']").filter({ hasText: /篇/ }).first();
  await firstCard.click();
  await expect(page.locator("aside")).toBeVisible();

  // 进入第一篇文章
  const firstArticle = page.locator("aside ul a").first();
  await firstArticle.click();
  await expect(page.locator("article.prose")).toBeVisible();
  await expect(page.locator("nav").filter({ hasText: "On this page" })).toBeVisible();

  // ⌘K 搜索
  await page.keyboard.press("Meta+k");
  await page.waitForTimeout(100);
  await expect(page.locator("#search-input")).toBeFocused();
  await page.locator("#search-input").fill("astro");
  await page.waitForTimeout(800);
  // 不强行断言有结果（取决于 fixture 数据），仅断言面板存在
  await expect(page.locator("#search-results")).toBeVisible();
  await page.keyboard.press("Escape");

  // 暗色模式
  await page.locator("#theme-toggle").click();
  await expect(page.locator("html")).toHaveClass(/dark/);
});
