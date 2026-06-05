import { describe, it, expect } from "vitest";
import { buildTree } from "~/lib/tree";
import type { Article } from "~/lib/types";

const mk = (path: string[]): Article => ({
  repo: "x", path, title: path[path.length - 1], date: "2026-01-01", rawMarkdown: "",
});

describe("buildTree", () => {
  it("空数组返回空树", () => {
    expect(buildTree([])).toEqual([]);
  });

  it("单个根文件", () => {
    const t = buildTree([mk(["readme"])]);
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ name: "readme", type: "file", path: ["readme"] });
  });

  it("二级嵌套", () => {
    const t = buildTree([mk(["frontend", "react"]), mk(["frontend", "vue"])]);
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ name: "frontend", type: "dir", path: ["frontend"] });
    expect(t[0].children).toHaveLength(2);
    expect(t[0].children![0].name).toBe("react");
  });

  it("目录与文件混合，目录排前面", () => {
    const t = buildTree([
      mk(["readme"]),
      mk(["frontend", "react"]),
      mk(["backend", "db"]),
    ]);
    expect(t.map(n => n.name)).toEqual(["backend", "frontend", "readme"]);
    expect(t.map(n => n.type)).toEqual(["dir", "dir", "file"]);
  });

  it("同级文件按名字排序", () => {
    const t = buildTree([mk(["c"]), mk(["a"]), mk(["b"])]);
    expect(t.map(n => n.name)).toEqual(["a", "b", "c"]);
  });

  it("深度嵌套 3 层", () => {
    const t = buildTree([mk(["a", "b", "c"])]);
    expect(t[0].children![0].children![0]).toMatchObject({ name: "c", type: "file" });
  });
});
