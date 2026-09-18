import { describe, expect, it } from "vitest";
import { halfWidthOf, toHalfWidth, type HalfWidthOptions } from "./half-width";

const ASCII_ONLY: HalfWidthOptions = { ascii: true, separators: false };
const WITH_SEPARATORS: HalfWidthOptions = { ascii: true, separators: true };
const OFF: HalfWidthOptions = { ascii: false, separators: true };

describe("基本段: 英数字と記号", () => {
  it.each([
    ["Ａ", "A"],
    ["ｚ", "z"],
    ["０", "0"],
    ["９", "9"],
    ["！", "!"],
    ["？", "?"],
    ["（", "("],
    ["）", ")"],
    ["＂", '"'],
    ["＋", "+"],
    ["－", "-"],
    ["＃", "#"],
    ["＠", "@"],
    ["＼", "\\"],
    ["｜", "|"],
    ["｀", "`"],
  ])("%s → %s", (full, half) => {
    expect(halfWidthOf(full, ASCII_ONLY)).toBe(half);
  });

  it("全角空白は半角空白になる", () => {
    expect(halfWidthOf("　", ASCII_ONLY)).toBe(" ");
  });

  it("MS-IME が出す “ ” ‘ ’ は \" と ' になる", () => {
    expect(halfWidthOf("“", ASCII_ONLY)).toBe('"');
    expect(halfWidthOf("”", ASCII_ONLY)).toBe('"');
    expect(halfWidthOf("‘", ASCII_ONLY)).toBe("'");
    expect(halfWidthOf("’", ASCII_ONLY)).toBe("'");
  });
});

describe("区切り段: ， ． ： ； ～ 〜", () => {
  it.each([
    ["，", ","],
    ["．", "."],
    ["：", ":"],
    ["；", ";"],
    ["～", "~"],
    ["〜", "~"],
  ])("%s は separators=false なら null、true なら %s", (full, half) => {
    expect(halfWidthOf(full, ASCII_ONLY)).toBeNull();
    expect(halfWidthOf(full, WITH_SEPARATORS)).toBe(half);
  });
});

describe("設定 OFF と対象外", () => {
  it("ascii=false なら区切り記号も含めて全部 null", () => {
    for (const char of ["Ａ", "０", "！", "　", "”", "，", "：", "～"]) {
      expect(halfWidthOf(char, OFF)).toBeNull();
    }
  });

  it("ASCII に対応の無い和文の字はどの設定でも null", () => {
    for (const char of ["。", "、", "「", "」", "『", "』", "・", "ー", "【", "】", "〈", "《"]) {
      expect(halfWidthOf(char, WITH_SEPARATORS)).toBeNull();
    }
  });

  it("かな・カナ・漢字は null", () => {
    for (const char of ["あ", "ア", "日", "ｱ"]) {
      expect(halfWidthOf(char, WITH_SEPARATORS)).toBeNull();
    }
  });

  it("既に半角の字は null", () => {
    for (const char of ["A", "0", "!", " ", '"', ","]) {
      expect(halfWidthOf(char, WITH_SEPARATORS)).toBeNull();
    }
  });
});

describe("toHalfWidth", () => {
  it("範囲の中だけを直し、外には触らない", () => {
    const text = "Ａ前Ｂ後Ｃ";
    expect(toHalfWidth(text, 2, 3, ASCII_ONLY)).toEqual({
      from: 2,
      to: 3,
      insert: "B",
      cursor: 3,
    });
  });

  it("範囲の中で対象外の字はそのまま残す", () => {
    expect(toHalfWidth("Ｑｕｉｅｔ。１２３：", 0, 10, ASCII_ONLY)).toEqual({
      from: 0,
      to: 10,
      insert: "Quiet。123：",
      cursor: 10,
    });
  });

  it("separators=true なら区切り記号も直す", () => {
    expect(toHalfWidth("１２：３０", 0, 5, WITH_SEPARATORS)?.insert).toBe("12:30");
  });

  it("全部半角なら null", () => {
    expect(toHalfWidth("Quiet 1.0", 0, 9, WITH_SEPARATORS)).toBeNull();
  });

  it("直す字が無ければ null", () => {
    expect(toHalfWidth("日本語。", 0, 4, WITH_SEPARATORS)).toBeNull();
  });

  it("ascii=false なら null", () => {
    expect(toHalfWidth("ＡＢＣ", 0, 3, OFF)).toBeNull();
  });
});
