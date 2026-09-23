import { describe, expect, it } from "vitest";
import { insertLink, toggleInlineFormat, type FormatEdit } from "./inline-format";

/** 置換を当てた後の文字列。 */
function apply(text: string, edit: FormatEdit): string {
  return text.slice(0, edit.from) + edit.insert + text.slice(edit.to);
}

describe("toggleInlineFormat", () => {
  it("選択を記号で囲み、元の文字列を選択したままにする", () => {
    const edit = toggleInlineFormat("abc", 0, 3, "**");
    expect(edit).toEqual({
      from: 0,
      to: 3,
      insert: "**abc**",
      selection: { from: 2, to: 5 },
    });
    expect(apply("abc", edit)).toBe("**abc**");
  });

  it("文中の一部でも位置を保って囲む", () => {
    const edit = toggleInlineFormat("hello world", 6, 11, "**");
    expect(edit).toEqual({
      from: 6,
      to: 11,
      insert: "**world**",
      selection: { from: 8, to: 13 },
    });
    expect(apply("hello world", edit)).toBe("hello **world**");
  });

  it("記号ごと選んでいるときは外す", () => {
    const edit = toggleInlineFormat("**abc**", 0, 7, "**");
    expect(edit).toEqual({
      from: 0,
      to: 7,
      insert: "abc",
      selection: { from: 0, to: 3 },
    });
    expect(apply("**abc**", edit)).toBe("abc");
  });

  it("選択の外側が記号のときも外す", () => {
    const edit = toggleInlineFormat("**abc**", 2, 5, "**");
    expect(edit).toEqual({
      from: 0,
      to: 7,
      insert: "abc",
      selection: { from: 0, to: 3 },
    });
    expect(apply("**abc**", edit)).toBe("abc");
  });

  it("斜体を外す", () => {
    expect(toggleInlineFormat("*abc*", 1, 4, "*")).toEqual({
      from: 0,
      to: 5,
      insert: "abc",
      selection: { from: 0, to: 3 },
    });
  });

  it("インラインコードを付ける", () => {
    expect(toggleInlineFormat("abc", 0, 3, "`")).toEqual({
      from: 0,
      to: 3,
      insert: "`abc`",
      selection: { from: 1, to: 4 },
    });
  });

  it("太字の中身を斜体にしても太字を壊さない", () => {
    const edit = toggleInlineFormat("**abc**", 2, 5, "*");
    expect(edit).toEqual({
      from: 2,
      to: 5,
      insert: "*abc*",
      selection: { from: 3, to: 6 },
    });
    expect(apply("**abc**", edit)).toBe("***abc***");
  });

  it("太字そのものを選んで斜体にすると外側へ重ねる", () => {
    const edit = toggleInlineFormat("**abc**", 0, 7, "*");
    expect(edit).toEqual({
      from: 0,
      to: 7,
      insert: "***abc***",
      selection: { from: 1, to: 8 },
    });
    expect(apply("**abc**", edit)).toBe("***abc***");
  });

  it("非選択なら記号だけを入れ、カーソルを内側へ置く", () => {
    const edit = toggleInlineFormat("abc", 1, 1, "`");
    expect(edit).toEqual({
      from: 1,
      to: 1,
      insert: "``",
      selection: { from: 2, to: 2 },
    });
    expect(apply("abc", edit)).toBe("a``bc");
  });
});

describe("insertLink", () => {
  it("選択を本文にして url を選択する", () => {
    const edit = insertLink("abc", 0, 3);
    expect(edit).toEqual({
      from: 0,
      to: 3,
      insert: "[abc](url)",
      selection: { from: 6, to: 9 },
    });
    expect(apply("abc", edit)).toBe("[abc](url)");
  });

  it("非選択なら空のリンクを入れて url を選択する", () => {
    const edit = insertLink("", 0, 0);
    expect(edit).toEqual({
      from: 0,
      to: 0,
      insert: "[](url)",
      selection: { from: 3, to: 6 },
    });
    expect(apply("", edit)).toBe("[](url)");
  });
});
