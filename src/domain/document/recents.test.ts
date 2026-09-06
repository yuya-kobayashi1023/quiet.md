import { describe, expect, it } from "vitest";
import {
  filenameOf,
  isInsideWorkspace,
  pushRecent,
  removeRecent,
  visibleRecents,
  type RecentFile,
} from "./recents";

const entry = (path: string, openedAt: number): RecentFile => ({
  path,
  filename: filenameOf(path),
  openedAt,
});

describe("pushRecent", () => {
  it("最後に開いたものが先頭へ来る", () => {
    const list = pushRecent(pushRecent([], "C:\\a\\one.md", 1), "C:\\a\\two.md", 2);
    expect(list.map((e) => e.filename)).toEqual(["two.md", "one.md"]);
  });

  it("同じファイルは重複させず、先頭へ引き上げる", () => {
    let list = pushRecent([], "C:\\a\\one.md", 1);
    list = pushRecent(list, "C:\\a\\two.md", 2);
    list = pushRecent(list, "C:\\a\\one.md", 3);
    expect(list.map((e) => e.filename)).toEqual(["one.md", "two.md"]);
    expect(list[0]?.openedAt).toBe(3);
  });

  it("Windows の大小文字差と区切りの違いを同一視する", () => {
    let list = pushRecent([], "C:\\Notes\\One.md", 1);
    list = pushRecent(list, "c:/notes/one.md", 2);
    expect(list).toHaveLength(1);
  });

  it("上限を超えたら古いものから捨てる", () => {
    let list: RecentFile[] = [];
    for (let i = 0; i < 40; i += 1) list = pushRecent(list, `C:\\a\\${i}.md`, i);
    expect(list).toHaveLength(30);
    expect(list[0]?.filename).toBe("39.md");
    expect(list.at(-1)?.filename).toBe("10.md");
  });

  it("上限は呼び出し側で変えられる", () => {
    let list: RecentFile[] = [];
    for (let i = 0; i < 5; i += 1) list = pushRecent(list, `C:\\a\\${i}.md`, i, 2);
    expect(list).toHaveLength(2);
  });
});

describe("removeRecent", () => {
  it("消えたファイルを履歴から外す", () => {
    const list = [entry("C:\\a\\one.md", 1), entry("C:\\a\\two.md", 2)];
    expect(removeRecent(list, "c:/a/one.md").map((e) => e.filename)).toEqual(["two.md"]);
  });
});

describe("isInsideWorkspace", () => {
  it("Workspace 内外を判定する", () => {
    expect(isInsideWorkspace("C:\\notes", "C:\\notes\\a.md")).toBe(true);
    expect(isInsideWorkspace("C:\\notes", "C:\\notes\\sub\\a.md")).toBe(true);
    expect(isInsideWorkspace("C:\\notes", "C:\\other\\a.md")).toBe(false);
    // 名前が前方一致するだけの別フォルダを内側と誤判定しない
    expect(isInsideWorkspace("C:\\notes", "C:\\notesx\\a.md")).toBe(false);
    expect(isInsideWorkspace(null, "C:\\notes\\a.md")).toBe(false);
  });
});

describe("visibleRecents", () => {
  const list = [
    entry("C:\\outside\\one.md", 3),
    entry("C:\\notes\\inside.md", 2),
    entry("C:\\outside\\two.md", 1),
  ];

  it("Workspace 内のファイルは Notes 側に出るので除く", () => {
    expect(visibleRecents(list, "C:\\notes", 10).map((e) => e.filename)).toEqual([
      "one.md",
      "two.md",
    ]);
  });

  it("表示件数で切る", () => {
    expect(visibleRecents(list, "C:\\notes", 1).map((e) => e.filename)).toEqual(["one.md"]);
    expect(visibleRecents(list, "C:\\notes", 0)).toEqual([]);
  });

  it("Workspace 未設定なら全部が外側", () => {
    expect(visibleRecents(list, null, 10)).toHaveLength(3);
  });
});
