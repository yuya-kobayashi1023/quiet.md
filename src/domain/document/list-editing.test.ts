/**
 * 箇条書きの階層編集のテスト。
 *
 * 仕様の 5 つの状態遷移をそのまま並べる。
 * 記法: `|` がカーソル位置。before / after を文字列で書き、
 * `|` を取り除いた本文とオフセットに変換して比較する。
 */

import { describe, expect, it } from "vitest";
import {
  handleEnter,
  handleIndent,
  handleOutdent,
  isEmptyItem,
  parseListItem,
  type EditChange,
} from "./list-editing";

/** `|` をカーソル位置として取り出す。 */
function cursorOf(source: string): { text: string; pos: number } {
  const pos = source.indexOf("|");
  if (pos === -1) throw new Error("テストの before/after に | が必要です");
  return { text: source.slice(0, pos) + source.slice(pos + 1), pos };
}

function apply(text: string, change: EditChange): { text: string; pos: number } {
  return {
    text: text.slice(0, change.from) + change.insert + text.slice(change.to),
    pos: change.cursor,
  };
}

type Handler = (text: string, pos: number, tabWidth?: number) => EditChange | null;

/** before に操作を適用し、after と一致することを確かめる。 */
function expectTransition(before: string, handler: Handler, after: string) {
  const input = cursorOf(before);
  const expected = cursorOf(after);
  const change = handler(input.text, input.pos);
  expect(change, "操作が処理されませんでした").not.toBeNull();
  const result = apply(input.text, change!);
  expect(result.text).toBe(expected.text);
  expect(result.pos).toBe(expected.pos);
}

/* ------------------------------------------------------------------ *
 * 1. non-empty list item + Enter → same depth の新しい list item
 * ------------------------------------------------------------------ */

describe("本文のある項目 + Enter", () => {
  it("同じ階層に新しい項目を作る", () => {
    expectTransition("- Item A|", handleEnter, "- Item A\n- |");
  });

  it("ネストされた項目でも同じ階層を保つ", () => {
    expectTransition(
      "- Item A\n  - Item B|",
      handleEnter,
      "- Item A\n  - Item B\n  - |",
    );
  });

  it("marker の種類を引き継ぐ", () => {
    expectTransition("* Item A|", handleEnter, "* Item A\n* |");
    expectTransition("+ Item A|", handleEnter, "+ Item A\n+ |");
  });

  it("番号付きリストは番号を進める", () => {
    expectTransition("1. Item A|", handleEnter, "1. Item A\n2. |");
    expectTransition("3) Item A|", handleEnter, "3) Item A\n4) |");
  });

  it("task list は未チェックの項目を作る", () => {
    expectTransition("- [x] Done|", handleEnter, "- [x] Done\n- [ ] |");
  });

  it("行の途中で押すと残りが新しい項目へ移る", () => {
    expectTransition("- Item| A", handleEnter, "- Item\n- | A");
  });

  it("4 スペースでネストした文書でも階層を保つ", () => {
    expectTransition(
      "- Item A\n    - Item B|",
      handleEnter,
      "- Item A\n    - Item B\n    - |",
    );
  });
});

/* ------------------------------------------------------------------ *
 * 2. list item + Tab → depth + 1
 * ------------------------------------------------------------------ */

describe("項目 + Tab", () => {
  it("1 段深くネストする", () => {
    expectTransition("- Item A\n- Item B|", handleIndent, "- Item A\n  - Item B|");
  });

  it("すでにネストされていればさらに深くする", () => {
    expectTransition(
      "- Item A\n  - Item B|",
      handleIndent,
      "- Item A\n    - Item B|",
    );
  });

  it("カーソルが行の途中でも本文との相対位置を保つ", () => {
    expectTransition("- Ite|m A", handleIndent, "  - Ite|m A");
  });

  it("リストでない行では何もしない", () => {
    expect(handleIndent("plain text|".replace("|", ""), 5)).toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * 3. list item + Shift+Tab → depth - 1
 * ------------------------------------------------------------------ */

describe("項目 + Shift+Tab", () => {
  it("1 段浅くする", () => {
    expectTransition("- Item A\n  - Item B|", handleOutdent, "- Item A\n- Item B|");
  });

  it("2 段目から 1 段目へ戻す", () => {
    expectTransition(
      "- A\n  - B\n    - C|",
      handleOutdent,
      "- A\n  - B\n  - C|",
    );
  });

  it("一番外側では何もしない", () => {
    const { text, pos } = cursorOf("- Item A|");
    expect(handleOutdent(text, pos)).toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * 4. empty list item + Enter (depth > 0)
 *    → 空項目を消して depth - 1 の新しい項目
 * ------------------------------------------------------------------ */

describe("空のネストされた項目 + Enter", () => {
  it("1 段浅い階層の項目になる", () => {
    expectTransition(
      "- Item A\n  - Item B\n  - |",
      handleEnter,
      "- Item A\n  - Item B\n- |",
    );
  });

  it("**空の通常行を作らない**", () => {
    const { text, pos } = cursorOf("- Item A\n  - Item B\n  - |");
    const result = apply(text, handleEnter(text, pos)!);

    // 途中に空行が入っていないこと。これがこの機能の肝。
    expect(result.text).not.toMatch(/\n[ \t]*\n/);
    expect(result.text.split("\n")).toEqual(["- Item A", "  - Item B", "- "]);

    // 行数が増えていないこと（改行を挿入していない）。
    expect(result.text.split("\n")).toHaveLength(text.split("\n").length);
  });

  it("3 段目からは 2 段目へ戻る", () => {
    expectTransition(
      "- A\n  - B\n    - C\n    - |",
      handleEnter,
      "- A\n  - B\n    - C\n  - |",
    );
  });

  it("番号付きリストでは戻り先の番号を継ぐ", () => {
    expectTransition(
      "1. A\n2. B\n   1. C\n   1. |",
      handleEnter,
      "1. A\n2. B\n   1. C\n3. |",
    );
  });

  it("4 スペースの文書でも戻り先のインデントに合わせる", () => {
    expectTransition(
      "- Item A\n    - Item B\n    - |",
      handleEnter,
      "- Item A\n    - Item B\n- |",
    );
  });

  it("チェックボックスだけの項目も空として扱う", () => {
    expectTransition(
      "- A\n  - [ ] |",
      handleEnter,
      "- A\n- [ ] |",
    );
  });
});

/* ------------------------------------------------------------------ *
 * 5. empty list item + Enter (depth = 0)
 *    → リストを終了して通常段落へ
 * ------------------------------------------------------------------ */

describe("空の最上位項目 + Enter", () => {
  it("リストを終了して通常段落に戻る", () => {
    expectTransition("- Item A\n- |", handleEnter, "- Item A\n\n|");
  });

  it("marker が消えて空行が 1 つだけ残る", () => {
    const { text, pos } = cursorOf("- Item A\n- |");
    const result = apply(text, handleEnter(text, pos)!);
    expect(result.text.split("\n")).toEqual(["- Item A", "", ""]);
    // カーソルは最後の空行にある
    expect(result.pos).toBe(result.text.length);
  });

  it("リスト 1 行だけでも終了できる", () => {
    expectTransition("- |", handleEnter, "\n|");
  });
});

/* ------------------------------------------------------------------ *
 * リスト以外には介入しない
 * ------------------------------------------------------------------ */

describe("リストでない行", () => {
  it("Enter を横取りしない", () => {
    const { text, pos } = cursorOf("ただの段落|");
    expect(handleEnter(text, pos)).toBeNull();
  });

  it("見出しを list item と誤認しない", () => {
    const { text, pos } = cursorOf("# 見出し|");
    expect(handleEnter(text, pos)).toBeNull();
  });

  it("水平線を list item と誤認しない", () => {
    const { text, pos } = cursorOf("---|");
    expect(handleEnter(text, pos)).toBeNull();
  });

  it("marker の直後に空白がなければリストではない", () => {
    const { text, pos } = cursorOf("-not a list|");
    expect(handleEnter(text, pos)).toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * depth の判定
 * ------------------------------------------------------------------ */

describe("parseListItem", () => {
  it("実際の構造から depth を数える（インデント幅に依存しない）", () => {
    const two = "- A\n  - B\n    - C|";
    const four = "- A\n    - B\n        - C|";
    for (const source of [two, four]) {
      const { text, pos } = cursorOf(source);
      expect(parseListItem(text, pos)?.depth).toBe(2);
    }
  });

  it("最初の項目は depth 0", () => {
    const { text, pos } = cursorOf("- A|");
    expect(parseListItem(text, pos)?.depth).toBe(0);
  });

  it("直前に 2 行以上の空行があれば別のリストとして数え直す", () => {
    const { text, pos } = cursorOf("- A\n  - B\n\n\n  - C|");
    expect(parseListItem(text, pos)?.depth).toBe(0);
  });

  it("空判定はチェックボックスを本文に数えない", () => {
    const { text, pos } = cursorOf("- [ ] |");
    expect(isEmptyItem(parseListItem(text, pos)!)).toBe(true);
  });
});
