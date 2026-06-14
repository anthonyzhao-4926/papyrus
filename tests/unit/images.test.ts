import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { processImages } from "~/lib/images";

const REPO = "test-images";
const RAW_BASE = "https://raw.githubusercontent.com/me/repo/main/docs/";

describe("processImages", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => Uint8Array.from([0x89, 0x50, 0x4e, 0x47]).buffer,
      })),
    );
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await rm(join("public/images", REPO), { recursive: true, force: true });
  });

  it("改写 markdown 图片语法", async () => {
    const out = await processImages("![a](pic.png)", REPO, RAW_BASE);
    expect(out).toMatch(/!\[a\]\(\/images\/test-images\/[a-f0-9]{12}\.png\)/);
    expect(fetch).toHaveBeenCalledWith(
      "https://raw.githubusercontent.com/me/repo/main/docs/pic.png",
    );
  });

  it("改写 HTML img 相对路径", async () => {
    const out = await processImages(
      '<img src="assets/a5d54dd0b14393354d9657008ba67f1f.png" alt="demo">',
      REPO,
      RAW_BASE,
    );
    expect(out).toMatch(/src="\/images\/test-images\/[a-f0-9]{12}\.png"/);
    expect(out).not.toContain("assets/");
    expect(fetch).toHaveBeenCalledWith(
      "https://raw.githubusercontent.com/me/repo/main/docs/assets/a5d54dd0b14393354d9657008ba67f1f.png",
    );
  });

  it("跳过已是站内绝对路径的图片", async () => {
    const md = '![a](/images/foo/bar.png)';
    const out = await processImages(md, REPO, RAW_BASE);
    expect(out).toBe(md);
    expect(fetch).not.toHaveBeenCalled();
  });
});
