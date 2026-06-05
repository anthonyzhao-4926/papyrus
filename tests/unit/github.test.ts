import { beforeAll, afterEach, afterAll, describe, it, expect } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { readFile } from "node:fs/promises";
import { listMarkdownFiles, fetchFileContent, fetchLastCommitDate } from "~/lib/github";

const fixtureTree = JSON.parse(
  await readFile(new URL("../fixtures/repo-tree.json", import.meta.url), "utf-8")
);

const server = setupServer(
  http.get("https://api.github.com/repos/me/x/git/trees/main", () =>
    HttpResponse.json(fixtureTree)
  ),
  http.get("https://api.github.com/repos/me/x/contents/docs%2Fintro.md", () =>
    HttpResponse.json({ content: Buffer.from("# Hello\n\nbody").toString("base64"), encoding: "base64" })
  ),
  http.get("https://api.github.com/repos/me/x/commits", ({ request }) => {
    const url = new URL(request.url);
    if (url.searchParams.get("path") === "docs/intro.md") {
      return HttpResponse.json([{ commit: { committer: { date: "2026-05-21T10:00:00Z" } } }]);
    }
    return HttpResponse.json([]);
  }),
  http.get("https://api.github.com/repos/me/missing/git/trees/main", () =>
    HttpResponse.json({ message: "Not Found" }, { status: 404 })
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("listMarkdownFiles", () => {
  it("递归拉取，仅返回 .md 文件路径", async () => {
    const files = await listMarkdownFiles({ owner: "me", repo: "x", branch: "main" });
    expect(files.sort()).toEqual(["README.md", "docs/intro.md", "docs/setup.md"]);
  });

  it("repo 不存在抛错", async () => {
    await expect(
      listMarkdownFiles({ owner: "me", repo: "missing", branch: "main" })
    ).rejects.toThrow(/Not Found|404/);
  });
});

describe("fetchFileContent", () => {
  it("解码 base64 内容", async () => {
    const text = await fetchFileContent({ owner: "me", repo: "x", path: "docs/intro.md" });
    expect(text).toBe("# Hello\n\nbody");
  });
});

describe("fetchLastCommitDate", () => {
  it("返回 ISO8601 日期", async () => {
    const d = await fetchLastCommitDate({ owner: "me", repo: "x", path: "docs/intro.md" });
    expect(d).toBe("2026-05-21T10:00:00Z");
  });

  it("无 commit 时回退到 epoch", async () => {
    const d = await fetchLastCommitDate({ owner: "me", repo: "x", path: "docs/setup.md" });
    expect(d).toBe("1970-01-01T00:00:00Z");
  });
});
