import { describe, expect, it } from "vitest";
import {
  forgetPosition,
  positionOf,
  rememberPosition,
  type RememberedPosition,
} from "./positions";

describe("rememberPosition", () => {
  it("最後に記録したものが先頭へ来る", () => {
    let list = rememberPosition([], "C:\\a\\one.md", { line: 3, column: 4 }, 1);
    list = rememberPosition(list, "C:\\a\\two.md", { line: 10, column: 1 }, 2);
    expect(list).toEqual([
      { path: "C:\\a\\two.md", line: 10, column: 1, updatedAt: 2 },
      { path: "C:\\a\\one.md", line: 3, column: 4, updatedAt: 1 },
    ]);
  });

  it("同じファイルは重複させず、新しい位置で先頭へ引き上げる", () => {
    let list = rememberPosition([], "C:\\a\\one.md", { line: 3, column: 4 }, 1);
    list = rememberPosition(list, "C:\\a\\two.md", { line: 10, column: 1 }, 2);
    list = rememberPosition(list, "C:\\a\\one.md", { line: 7, column: 2 }, 3);
    expect(list).toEqual([
      { path: "C:\\a\\one.md", line: 7, column: 2, updatedAt: 3 },
      { path: "C:\\a\\two.md", line: 10, column: 1, updatedAt: 2 },
    ]);
  });

  it("Windows の大小文字差と区切りの違いを同一視する", () => {
    let list = rememberPosition([], "C:\\Notes\\One.md", { line: 3, column: 4 }, 1);
    list = rememberPosition(list, "c:/notes/one.md", { line: 5, column: 6 }, 2);
    expect(list).toEqual([{ path: "c:/notes/one.md", line: 5, column: 6, updatedAt: 2 }]);
  });

  it("上限を超えたら古いものから捨てる", () => {
    let list: RememberedPosition[] = [];
    for (let i = 0; i < 210; i += 1) {
      list = rememberPosition(list, `C:\\a\\${i}.md`, { line: i, column: 1 }, i);
    }
    expect(list).toHaveLength(200);
    expect(list[0]?.path).toBe("C:\\a\\209.md");
    expect(list.at(-1)?.path).toBe("C:\\a\\10.md");
  });

  it("上限は呼び出し側で変えられる", () => {
    let list: RememberedPosition[] = [];
    for (let i = 0; i < 5; i += 1) {
      list = rememberPosition(list, `C:\\a\\${i}.md`, { line: 1, column: 1 }, i, 2);
    }
    expect(list.map((e) => e.path)).toEqual(["C:\\a\\4.md", "C:\\a\\3.md"]);
  });
});

describe("positionOf", () => {
  const list = rememberPosition([], "C:\\Notes\\One.md", { line: 12, column: 8 }, 1);

  it("記録した位置を、区切りと大小文字の違いを越えて引く", () => {
    expect(positionOf(list, "c:/notes/one.md")).toEqual({ line: 12, column: 8 });
  });

  it("開いたことのないファイルは null", () => {
    expect(positionOf(list, "C:\\Notes\\Two.md")).toBeNull();
  });
});

describe("forgetPosition", () => {
  it("消えたファイルの記録を外す", () => {
    let list = rememberPosition([], "C:\\a\\one.md", { line: 3, column: 4 }, 1);
    list = rememberPosition(list, "C:\\a\\two.md", { line: 10, column: 1 }, 2);
    expect(forgetPosition(list, "c:/a/one.md")).toEqual([
      { path: "C:\\a\\two.md", line: 10, column: 1, updatedAt: 2 },
    ]);
  });
});
