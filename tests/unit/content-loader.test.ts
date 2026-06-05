import { describe, it, expect, vi } from "vitest";
import { loadAllArticles } from "~/lib/content-loader";

vi.mock("~/lib/github", () => ({
  listMarkdownFiles: vi.fn(async () => ["README.md", "frontend/react.md"]),
  fetchFileContent: vi.fn(async ({ path }) => `# Title of ${path}\n\nbody`),
  fetchLastCommitDate: vi.fn(async () => "2026-05-21T10:00:00Z"),
}));

const cfg = {
  site: { name: "T", description: "d", url: "https://t" },
  repos: [{
    slug: "tn", title: "TN", description: "d", icon: "📘",
    source: "github.com/me/tn", branch: "main",
  }],
};

describe("loadAllArticles", () => {
  it("把每个 repo 的 .md 转成 Article 列表", async () => {
    const arts = await loadAllArticles(cfg);
    expect(arts).toHaveLength(2);
    expect(arts[0]).toMatchObject({
      repo: "tn",
      path: ["README"],
      title: "README",
      date: "2026-05-21T10:00:00Z",
    });
    expect(arts[1].path).toEqual(["frontend", "react"]);
    expect(arts[1].rawMarkdown).toContain("Title");
  });

  it("frontmatter 覆盖标题与日期", async () => {
    const { fetchFileContent } = await import("~/lib/github");
    (fetchFileContent as any).mockImplementationOnce(async () =>
      "---\ntitle: 自定义标题\ndate: 2020-01-01\n---\n\n正文"
    );
    const arts = await loadAllArticles(cfg);
    expect(arts[0].title).toBe("自定义标题");
    expect(arts[0].date).toBe("2020-01-01T00:00:00.000Z");
  });
});
