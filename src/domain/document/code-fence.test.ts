import { describe, expect, it } from "vitest";
import { handleBacktick } from "./code-fence";

/**
 * `|` の位置でバッククォートを打った結果を組み立てる。
 * 補完しない場合は null を返す。
 */
function type(source: string): string | null {
  const pos = source.indexOf("|");
  if (pos === -1) throw new Error("テストの入力に | が必要です");
  const text = source.slice(0, pos) + source.slice(pos + 1);

  const change = handleBacktick(text, pos, pos);
  if (!change) return null;

  const applied =
    text.slice(0, change.from) + change.insert + text.slice(change.to);
  return applied.slice(0, change.cursor) + "|" + applied.slice(change.cursor);
}

describe("handleBacktick", () => {
  it("3 つ目を打つと閉じの ``` を置き、カーソルは開きの直後に残る", () => {
    expect(type("``|")).toBe("```|\n```");
  });

  it("言語名を書いて Enter を打つ、という書き順がそのまま通る", () => {
    // 補完直後に `ts` を書き、Enter で改行したときの姿。
    const completed = type("``|");
    expect(completed).toBe("```|\n```");
    const withLanguage = (completed ?? "").replace("|", "ts|");
    expect(withLanguage.replace("|", "\n")).toBe("```ts\n\n```");
  });

  it("本文の途中でも、その行が ``` だけなら補完する", () => {
    expect(type("# 見出し\n\n``|\n\n本文")).toBe("# 見出し\n\n```|\n```\n\n本文");
  });

  it("リストの中では字下げを引き継ぐ", () => {
    expect(type("- 手順\n  ``|")).toBe("- 手順\n  ```|\n  ```");
  });

  it("行に文字が先にあるときは補完しない（インラインコード）", () => {
    expect(type("これは ``|")).toBeNull();
    expect(type("a``|")).toBeNull();
  });

  it("行の残りに文字があるときは補完しない", () => {
    expect(type("``|ts")).toBeNull();
  });

  it("4 つ目のバッククォートでは補完しない", () => {
    expect(type("```|")).toBeNull();
  });

  it("バッククォート 1 つ目・2 つ目では補完しない", () => {
    expect(type("|")).toBeNull();
    expect(type("`|")).toBeNull();
  });

  it("既に開いている block の中では補完しない（閉じるための入力）", () => {
    expect(type("```ts\nconst a = 1;\n``|")).toBeNull();
  });

  it("閉じ終わった block の後ろでは補完する", () => {
    expect(type("```ts\nconst a = 1;\n```\n\n``|")).toBe(
      "```ts\nconst a = 1;\n```\n\n```|\n```",
    );
  });

  it("~~~ で開いた block の中でも補完しない", () => {
    expect(type("~~~\ncode\n``|")).toBeNull();
  });

  it("範囲選択を置き換える入力には介入しない", () => {
    expect(handleBacktick("``xx", 2, 4)).toBeNull();
  });
});
