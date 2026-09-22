import { describe, expect, it } from "vitest";
import type { FormatEdit } from "./inline-format";
import { toggleLinePrefix } from "./line-prefix";

/** 置換を当てた後の文字列。 */
function apply(text: string, edit: FormatEdit): string {
  return text.slice(0, edit.from) + edit.insert + text.slice(edit.to);
}

describe("toggleLinePrefix", () => {
  it("非選択ならカーソルのある行だけに付け、カーソルを追従させる", () => {
    const edit = toggleLinePrefix("abc", 2, 2, "> ");
    expect(edit).toEqual({
      from: 0,
      to: 3,
      insert: "> abc",
      selection: { from: 4, to: 4 },
    });
    expect(apply("abc", edit)).toBe("> abc");
  });

  it("選択に掛かるすべての行へ付ける", () => {
    const edit = toggleLinePrefix("a\nb", 0, 3, "- ");
    expect(edit).toEqual({
      from: 0,
      to: 3,
      insert: "- a\n- b",
      selection: { from: 0, to: 7 },
    });
    expect(apply("a\nb", edit)).toBe("- a\n- b");
  });

  it("全行が接頭辞を持つときだけ外す", () => {
    const edit = toggleLinePrefix("> a\n> b", 0, 7, "> ");
    expect(edit).toEqual({
      from: 0,
      to: 7,
      insert: "a\nb",
      selection: { from: 0, to: 3 },
    });
    expect(apply("> a\n> b", edit)).toBe("a\nb");
  });

  it("持たない行が混ざっていたら、その行へ付ける", () => {
    const edit = toggleLinePrefix("> a\nb", 0, 5, "> ");
    expect(edit).toEqual({
      from: 0,
      to: 5,
      insert: "> a\n> b",
      selection: { from: 0, to: 7 },
    });
    expect(apply("> a\nb", edit)).toBe("> a\n> b");
  });

  it("行頭で終わる選択は、その行に掛けない", () => {
    const edit = toggleLinePrefix("a\nb", 0, 2, "- ");
    expect(edit).toEqual({
      from: 0,
      to: 1,
      insert: "- a",
      selection: { from: 0, to: 3 },
    });
    expect(apply("a\nb", edit)).toBe("- a\nb");
  });

  it("チェックリストを付ける", () => {
    expect(toggleLinePrefix("a", 0, 0, "- [ ] ")).toEqual({
      from: 0,
      to: 1,
      insert: "- [ ] a",
      selection: { from: 6, to: 6 },
    });
  });

  it("済みのチェックリストも既存として外す", () => {
    const edit = toggleLinePrefix("- [x] a", 0, 0, "- [ ] ");
    expect(edit).toEqual({
      from: 0,
      to: 7,
      insert: "a",
      selection: { from: 0, to: 0 },
    });
    expect(apply("- [x] a", edit)).toBe("a");
  });

  it("外すときカーソルが接頭辞の中にあれば行頭へ寄せる", () => {
    expect(toggleLinePrefix("> abc", 1, 1, "> ")).toEqual({
      from: 0,
      to: 5,
      insert: "abc",
      selection: { from: 0, to: 0 },
    });
  });

  it("2 行目だけを対象にできる", () => {
    const edit = toggleLinePrefix("a\nb\nc", 2, 3, "- ");
    expect(edit).toEqual({
      from: 2,
      to: 3,
      insert: "- b",
      selection: { from: 2, to: 5 },
    });
    expect(apply("a\nb\nc", edit)).toBe("a\n- b\nc");
  });
});
