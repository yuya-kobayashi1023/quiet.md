import { describe, expect, it } from "vitest";
import { lineForTop, normalizeAnchors, topForLine, type Anchor } from "./scroll-map";

const anchors: Anchor[] = [
  { line: 1, top: 0 },
  { line: 5, top: 100 },
  { line: 6, top: 400 }, // 高いコードブロック。割合計算がずれるのはここ
  { line: 20, top: 500 },
];

describe("normalizeAnchors", () => {
  it("行の昇順に並べる", () => {
    const out = normalizeAnchors([
      { line: 5, top: 100 },
      { line: 1, top: 0 },
    ]);
    expect(out.map((a) => a.line)).toEqual([1, 5]);
  });

  it("同じ行の重複を落とす", () => {
    const out = normalizeAnchors([
      { line: 1, top: 0 },
      { line: 1, top: 40 },
      { line: 3, top: 80 },
    ]);
    expect(out).toEqual([
      { line: 1, top: 0 },
      { line: 3, top: 80 },
    ]);
  });

  it("top が後戻りする点を捨てる", () => {
    const out = normalizeAnchors([
      { line: 1, top: 0 },
      { line: 2, top: 200 },
      { line: 3, top: 150 },
      { line: 4, top: 300 },
    ]);
    expect(out.map((a) => a.line)).toEqual([1, 2, 4]);
  });

  it("空でも落ちない", () => {
    expect(normalizeAnchors([])).toEqual([]);
  });
});

describe("topForLine", () => {
  it("対応点そのものを返す", () => {
    expect(topForLine(anchors, 1)).toBe(0);
    expect(topForLine(anchors, 5)).toBe(100);
    expect(topForLine(anchors, 6)).toBe(400);
  });

  it("対応点の間を線形補間する", () => {
    // 行 3 は 1 と 5 の中間
    expect(topForLine(anchors, 3)).toBe(50);
    // 行 13 は 6 と 20 のちょうど半分
    expect(topForLine(anchors, 13)).toBe(450);
  });

  it("小数の行を扱う", () => {
    expect(topForLine(anchors, 5.5)).toBe(250);
  });

  it("端の外側では外挿せず、いちばん近い対応点に寄せる", () => {
    expect(topForLine(anchors, 0)).toBe(0);
    expect(topForLine(anchors, -100)).toBe(0);
    expect(topForLine(anchors, 999)).toBe(500);
  });

  it("対応点が 0 個・1 個でも落ちない", () => {
    expect(topForLine([], 5)).toBe(0);
    expect(topForLine([{ line: 3, top: 42 }], 1)).toBe(42);
    expect(topForLine([{ line: 3, top: 42 }], 99)).toBe(42);
  });

  it("背の高い要素を割合ではなく行の対応で扱う", () => {
    // 割合なら 行6/20 = 30% ≈ 150px を返してしまう。
    // 行の対応表を使えば、コードブロックの手前 400px を返す。
    expect(topForLine(anchors, 6)).toBe(400);
  });
});

describe("lineForTop", () => {
  it("topForLine の逆になる", () => {
    for (const line of [1, 3, 5, 5.5, 13, 20]) {
      expect(lineForTop(anchors, topForLine(anchors, line))).toBeCloseTo(line, 6);
    }
  });

  it("端の外側では外挿しない", () => {
    expect(lineForTop(anchors, -50)).toBe(1);
    expect(lineForTop(anchors, 9999)).toBe(20);
  });

  it("高さ 0 の区間では手前の行を返す", () => {
    const flat: Anchor[] = [
      { line: 1, top: 0 },
      { line: 2, top: 100 },
      { line: 3, top: 100 },
      { line: 4, top: 200 },
    ];
    expect(lineForTop(flat, 100)).toBe(2);
  });

  it("対応点が 0 個・1 個でも落ちない", () => {
    expect(lineForTop([], 100)).toBe(1);
    expect(lineForTop([{ line: 7, top: 42 }], 0)).toBe(7);
  });
});
