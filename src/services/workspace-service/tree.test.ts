import { describe, expect, it } from "vitest";
import { buildTree, type TreeRow } from "./index";
import type { DocumentSummary } from "@/domain/document/types";

const doc = (relativePath: string, createdAt = 0): DocumentSummary => {
  const filename = relativePath.slice(relativePath.lastIndexOf("/") + 1);
  return {
    relativePath,
    path: `/notes/${relativePath}`,
    filename,
    title: filename.replace(/\.md$/, ""),
    modifiedAt: 0,
    createdAt,
    size: 0,
  };
};

// Rust 側は relativePath の名前順で返す（U-024）。同じ順序で並べておく。
// 表示順は buildTree が決める（ADR-019）ので、この順序は作成日時が同じときの tie-break にだけ効く。
const documents = [
  doc("a.md"),
  doc("docs/deep/nested.md"),
  doc("docs/design.md"),
  doc("old.md"),
];

const paths = (rows: TreeRow[]) =>
  rows.map((r) => (r.kind === "file" ? r.document.relativePath : `[${r.path}]`));

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

  it("開いたフォルダの中身を出す。フォルダ行が先、ファイル行が後（ADR-019）", () => {
    const rows = buildTree(documents, [], ["docs"], "notes");
    expect(paths(rows)).toEqual(["[docs]", "[docs/deep]", "docs/design.md", "a.md", "old.md"]);
  });

  it("同じ階層のファイルは作成日時の新しい順（ADR-019）", () => {
    const rows = buildTree(
      [doc("a.md", 100), doc("b.md", 300), doc("c.md", 200)],
      [],
      [],
      "notes",
    );
    expect(paths(rows)).toEqual(["b.md", "c.md", "a.md"]);
  });

  it("作成日時が同じファイルは Native の名前順を保つ", () => {
    const rows = buildTree(
      [doc("a.md", 100), doc("b.md", 100), doc("c.md", 100)],
      [],
      [],
      "notes",
    );
    expect(paths(rows)).toEqual(["a.md", "b.md", "c.md"]);
  });

  it("フォルダは大小文字を区別せず名前順に並び、ファイルより先に出る", () => {
    const rows = buildTree(
      [doc("zeta.md", 999), doc("Beta/x.md", 1), doc("alpha/y.md", 1), doc("Gamma/z.md", 1)],
      [],
      [],
      "notes",
    );
    expect(paths(rows)).toEqual(["[alpha]", "[Beta]", "[Gamma]", "zeta.md"]);
  });

  it("フォルダの中でも同じ規則で並ぶ", () => {
    const rows = buildTree(
      [doc("docs/old.md", 100), doc("docs/sub/x.md", 1), doc("docs/new.md", 200)],
      [],
      ["docs"],
      "notes",
    );
    expect(paths(rows)).toEqual(["[docs]", "[docs/sub]", "docs/new.md", "docs/old.md"]);
  });

  it("Archive 区分も同じ規則で並ぶ", () => {
    const rows = buildTree(
      [doc("a.md", 100), doc("b.md", 300), doc("old/c.md", 200), doc("keep.md", 999)],
      ["a.md", "b.md", "old/c.md"],
      ["old"],
      "archive",
    );
    expect(paths(rows)).toEqual(["[old]", "old/c.md", "b.md", "a.md"]);
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
