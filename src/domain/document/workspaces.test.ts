import { describe, expect, it } from "vitest";
import {
  isSameWorkspace,
  pushWorkspace,
  relativeOpenedAt,
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

describe("relativeOpenedAt", () => {
  const now = Date.parse("2026-09-09T12:00:00Z");
  const ago = (ms: number) => relativeOpenedAt(now - ms, now);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  it("1 分未満は「たった今」", () => {
    expect(ago(0)).toBe("たった今");
    expect(ago(59_000)).toBe("たった今");
  });

  it("分・時間・日で丸める", () => {
    expect(ago(3 * minute)).toBe("3分前");
    expect(ago(5 * hour)).toBe("5時間前");
    expect(ago(3 * day)).toBe("3日前");
  });

  it("1 日前だけ「昨日」と言う", () => {
    expect(ago(day)).toBe("昨日");
    expect(ago(2 * day)).toBe("2日前");
  });

  it("週・月・年へ粗くなる", () => {
    expect(ago(10 * day)).toBe("1週間前");
    expect(ago(60 * day)).toBe("2か月前");
    expect(ago(400 * day)).toBe("1年前");
  });

  it("未来の時刻でも壊れない", () => {
    expect(relativeOpenedAt(now + hour, now)).toBe("たった今");
  });
});
