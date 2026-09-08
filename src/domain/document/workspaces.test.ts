import { describe, expect, it } from "vitest";
import {
  isSameWorkspace,
  pushWorkspace,
  removeWorkspace,
  WORKSPACE_LIMIT,
  type WorkspaceEntry,
} from "./workspaces";

describe("pushWorkspace", () => {
  it("最後に開いたものが先頭へ来る", () => {
    const list = pushWorkspace(pushWorkspace([], "C:\\notes", 1), "C:\\repo\\docs", 2);
    expect(list.map((e) => e.name)).toEqual(["docs", "notes"]);
  });

  it("同じフォルダは重複させず、先頭へ引き上げる", () => {
    let list = pushWorkspace([], "C:\\notes", 1);
    list = pushWorkspace(list, "C:\\repo", 2);
    list = pushWorkspace(list, "C:\\notes", 3);
    expect(list.map((e) => e.name)).toEqual(["notes", "repo"]);
    expect(list[0]?.openedAt).toBe(3);
  });

  it("Windows の大小文字差と区切りの違いを同一視する", () => {
    let list = pushWorkspace([], "C:\\Notes\\Journal", 1);
    list = pushWorkspace(list, "c:/notes/journal", 2);
    expect(list).toHaveLength(1);
  });

  it("末尾の区切りが付いていても同じフォルダとみなす", () => {
    let list = pushWorkspace([], "C:\\notes", 1);
    list = pushWorkspace(list, "C:\\notes\\", 2);
    expect(list).toHaveLength(1);
  });

  it("10 件を超えたら古いものから捨てる", () => {
    let list: WorkspaceEntry[] = [];
    for (let i = 0; i < 14; i += 1) list = pushWorkspace(list, `C:\\w${i}`, i);
    expect(list).toHaveLength(WORKSPACE_LIMIT);
    expect(list[0]?.name).toBe("w13");
    expect(list.at(-1)?.name).toBe("w4");
  });
});

describe("removeWorkspace", () => {
  it("履歴から外す", () => {
    let list = pushWorkspace([], "C:\\notes", 1);
    list = pushWorkspace(list, "C:\\repo", 2);
    expect(removeWorkspace(list, "c:/notes").map((e) => e.name)).toEqual(["repo"]);
  });
});

describe("isSameWorkspace", () => {
  it("同じフォルダを指すかを正規化して比べる", () => {
    expect(isSameWorkspace("C:\\Notes", "c:/notes")).toBe(true);
    expect(isSameWorkspace("C:\\Notes", "C:\\Notes\\sub")).toBe(false);
    expect(isSameWorkspace(null, "C:\\Notes")).toBe(false);
  });
});
