import { describe, expect, it } from "vitest";
import { handleFullWidthInput } from "./fullwidth-marker";

/**
 * カーソルの印は `‸`。
 *
 * 他のテスト（`code-fence.test.ts` など）は `|` を使うが、ここでは `|` そのものが
 * テストデータなので使えない。
 */
const CARET = "‸";

/** 全角空白で確定しても半角空白が書かれることを見るために使う。 */
const IDEOGRAPHIC_SPACE = "　";

/**
 * `‸` の位置でその文字を打った結果を組み立てる。
 * 直さない場合は null を返す。
 */
function type(source: string, input: string): string | null {
  const pos = source.indexOf(CARET);
  if (pos === -1) throw new Error(`テストの入力に ${CARET} が必要です`);
  const text = source.slice(0, pos) + source.slice(pos + CARET.length);

  const change = handleFullWidthInput(text, pos, pos, input);
  if (!change) return null;

  const applied = text.slice(0, change.from) + change.insert + text.slice(change.to);
  return applied.slice(0, change.cursor) + CARET + applied.slice(change.cursor);
}

describe("行頭の全角記号", () => {
  it("＃ + 空白 で見出しになる", () => {
    expect(type("＃‸", " ")).toBe("# ‸");
  });

  it("全角空白で確定しても半角空白を書く", () => {
    expect(type("＃‸", IDEOGRAPHIC_SPACE)).toBe("# ‸");
  });

  it("＃ の数だけ見出しレベルを保つ", () => {
    expect(type("＃＃＃‸", " ")).toBe("### ‸");
  });

  it("－ と ー のどちらでも箇条書きになる", () => {
    // かな入力では `-` キーが `ー`（長音）になる。
    expect(type("－‸", " ")).toBe("- ‸");
    expect(type("ー‸", " ")).toBe("- ‸");
  });

  it("＊ と ＋ はその記号のまま半角にする", () => {
    expect(type("＊‸", " ")).toBe("* ‸");
    expect(type("＋‸", " ")).toBe("+ ‸");
  });

  it("＞ は引用になる", () => {
    expect(type("＞‸", " ")).toBe("> ‸");
    expect(type("＞＞‸", " ")).toBe(">> ‸");
  });

  it("１。 は番号付きリストになる", () => {
    // かな入力では `.` キーが `。` になる。`．` でも同じ。
    expect(type("１。‸", " ")).toBe("1. ‸");
    expect(type("１．‸", " ")).toBe("1. ‸");
    expect(type("１２。‸", " ")).toBe("12. ‸");
  });

  it("字下げを保つ", () => {
    expect(type("- 手順\n  ー‸", " ")).toBe("- 手順\n  - ‸");
  });

  it("行の途中では直さない", () => {
    // 「第＃号」のように文字として書きたい場面に当てない。
    expect(type("第＃‸", " ")).toBeNull();
    expect(type("本文 ー‸", " ")).toBeNull();
  });

  it("記号でない行頭では直さない", () => {
    expect(type("あ‸", " ")).toBeNull();
    expect(type("‸", " ")).toBeNull();
  });

  it("見出しは 6 段までしか直さない", () => {
    expect(type("＃＃＃＃＃＃＃‸", " ")).toBeNull();
  });
});

describe("｜（表）", () => {
  it("行頭なら直す", () => {
    expect(type("‸", "｜")).toBe("|‸");
  });

  it("既に | のある行なら、途中でも直す", () => {
    expect(type("| あ ‸", "｜")).toBe("| あ |‸");
  });

  it("| の無い行の途中では直さない", () => {
    expect(type("本文の途中‸", "｜")).toBeNull();
  });
});

describe("｀（コード）", () => {
  it("行の途中でも直す（インラインコード）", () => {
    expect(type("これは‸", "｀")).toBe("これは`‸");
  });

  it("3 つ目で fenced code block の閉じまで置く", () => {
    expect(type("｀｀‸", "｀")).toBe("```‸\n```");
  });

  it("直前が半角でも閉じの補完へつながる", () => {
    // fence-input が見るのは半角の ` だけ。全角の ｀ はここで消費されるので、
    // 握ったまま返すと `` + ｀ の並びで閉じが消える。
    expect(type("``‸", "｀")).toBe("```‸\n```");
  });

  it("fence の字下げを引き継ぐ", () => {
    expect(type("- 手順\n  ｀｀‸", "｀")).toBe("- 手順\n  ```‸\n  ```");
  });

  it("行に文字が先にあるときは閉じを置かない", () => {
    // インラインコードを 3 つ書いただけ。fence ではない。
    expect(type("これは｀｀‸", "｀")).toBe("これは```‸");
  });
});

describe("介入しない場合", () => {
  it("半角で打たれた記号には触らない", () => {
    expect(type("#‸", " ")).toBeNull();
    expect(type("‸", "|")).toBeNull();
  });

  it("範囲選択を打ち消す入力には介入しない", () => {
    expect(handleFullWidthInput("＃あ", 1, 2, " ")).toBeNull();
  });
});
