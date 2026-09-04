import { describe, expect, it } from "vitest";
import { buildTree } from "./index";
import type { DocumentSummary } from "@/domain/document/types";

const doc = (relativePath: string): DocumentSummary => {
  const filename = relativePath.slice(relativePath.lastIndexOf("/") + 1);
  return {
    relativePath,
    path: `/notes/${relativePath}`,
    filename,
    title: filename.replace(/\.md$/, ""),
    modifiedAt: 0,
    size: 0,
  };
};

// Rust 側は relativePath の名前順で返す（U-024）。同じ順序で並べておく。
const documents = [
  doc("a.md"),
  doc("docs/deep/nested.md"),
  doc("docs/design.md"),
  doc("old.md"),
];

describe("buildTree", () => {
  it("Archive されたファイルを Notes から外す（U-005）", () => {
    const rows = buildTree(documents, ["old.md"], [], "notes");
    const files = rows.filter((r) => r.kind === "file");
    expect(files.map((r) => (r.kind === "file" ? r.document.relativePath : ""))).not.toContain(
      "old.md",
    );
  });

  it("Archive 区分には Archive されたものだけを出す", () => {
    const rows = buildTree(documents, ["old.md"], [], "archive");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.kind === "file" && rows[0]!.document.relativePath).toBe("old.md");
  });

  it("閉じたフォルダの中身を行にしない（U-024）", () => {
    const rows = buildTree(documents, [], [], "notes");
    expect(rows.filter((r) => r.kind === "folder").map((r) => r.kind === "folder" && r.path)).toEqual(
      ["docs"],
    );
    // docs が閉じているので、その中のファイルも deep フォルダも出ない
    expect(rows.some((r) => r.kind === "file" && r.document.relativePath.startsWith("docs/"))).toBe(
      false,
    );
  });

  it("開いたフォルダの中身を出す", () => {
    const rows = buildTree(documents, [], ["docs"], "notes");
    const paths = rows.map((r) => (r.kind === "file" ? r.document.relativePath : `[${r.path}]`));
    expect(paths).toEqual(["a.md", "[docs]", "[docs/deep]", "docs/design.md", "old.md"]);
  });

  it("入れ子のフォルダを両方開くと深い階層まで出す", () => {
    const rows = buildTree(documents, [], ["docs", "docs/deep"], "notes");
    expect(rows.some((r) => r.kind === "file" && r.document.relativePath === "docs/deep/nested.md")).toBe(
      true,
    );
  });

  it("フォルダの depth が階層を表す", () => {
    const rows = buildTree(documents, [], ["docs", "docs/deep"], "notes");
    const deep = rows.find((r) => r.kind === "folder" && r.path === "docs/deep");
    expect(deep?.kind === "folder" && deep.depth).toBe(1);
  });
});
