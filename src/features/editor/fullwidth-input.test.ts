// @vitest-environment jsdom

/**
 * 実際の CodeMirror 上での全角記号の置き換え。
 *
 * `fullwidth-marker.test.ts` と `half-width.test.ts` はロジックだけを見る。
 * こちらは**エディタへ接続した結果**を見る。
 * `inputHandler` は本物の入力イベントからしか呼ばれないため、
 * `handleFullWidth` を直接叩いて、dispatch まで通ることを確かめる。
 * composition の追跡は `compositionstart` / `compositionend` を DOM に流して確かめる。
 */

import { afterEach, describe, expect, it } from "vitest";
import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { undo } from "@codemirror/commands";
import type { HalfWidthOptions } from "@/domain/document/half-width";
import { coreExtensions } from "./extensions";
import { fullWidthInput, handleCompositionEnded, handleFullWidth } from "./fullwidth-input";

/** カーソルの印。`|` は表のテストで使うため、ここでも `‸` にする。 */
const CARET = "‸";

/*
 * jsdom の Range には getClientRects が無い。
 * composition の確定を待つテストは 1 tick またぐので、CodeMirror が rAF で行う寸法測定に
 * 間に合ってしまう。空を返せば CodeMirror は既定値で進む。
 */
Range.prototype.getClientRects ??= () => [] as unknown as DOMRectList;

/** 設定の既定値と同じ。 */
const DEFAULT_OPTIONS: HalfWidthOptions = { ascii: true, separators: false };
const OFF: HalfWidthOptions = { ascii: false, separators: false };

/** 1 つのテストで 2 つ作ることがあるので、全部を片付ける。 */
let views: EditorView[] = [];

afterEach(() => {
  for (const created of views) created.destroy();
  views = [];
});

/** `‸` の位置にカーソルを置いた EditorView を作る。 */
function editorWith(source: string, options: HalfWidthOptions = DEFAULT_OPTIONS): EditorView {
  const pos = source.indexOf(CARET);
  if (pos === -1) throw new Error(`テストの入力に ${CARET} が必要です`);
  const doc = source.slice(0, pos) + source.slice(pos + CARET.length);

  const parent = document.createElement("div");
  document.body.appendChild(parent);

  const created = new EditorView({
    state: EditorState.create({
      doc,
      selection: EditorSelection.single(pos),
      extensions: [coreExtensions(), fullWidthInput(options)],
    }),
    parent,
  });
  views.push(created);
  return created;
}

/** カーソル位置にその文字を打つ。返り値は置き換えが走ったか。 */
function type(target: EditorView, text: string, options = DEFAULT_OPTIONS): boolean {
  const { from, to } = target.state.selection.main;
  return handleFullWidth(target, from, to, text, options);
}

function snapshot(target: EditorView): string {
  const doc = target.state.doc.toString();
  const head = target.state.selection.main.head;
  return doc.slice(0, head) + CARET + doc.slice(head);
}

/**
 * IME の変換確定を模す。
 *
 * `compositionstart` を流し、変換中の文字列を dispatch で入れ、`compositionend` を流す。
 * 確定後の置き換えは 1 tick 後に走るので、それを待って返す。
 */
async function compose(target: EditorView, text: string): Promise<void> {
  target.contentDOM.dispatchEvent(new CompositionEvent("compositionstart"));
  const head = target.state.selection.main.head;
  target.dispatch({
    changes: { from: head, insert: text },
    selection: { anchor: head + text.length },
  });
  target.contentDOM.dispatchEvent(new CompositionEvent("compositionend"));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("CodeMirror 上の全角記号の置き換え", () => {
  it("＃ + 空白 が見出しになる", () => {
    const editor = editorWith("＃‸");
    expect(type(editor, " ")).toBe(true);
    expect(snapshot(editor)).toBe("# ‸");
  });

  it("全角空白で確定しても半角空白が書かれる", () => {
    const editor = editorWith("ー‸");
    expect(type(editor, "　")).toBe(true);
    expect(snapshot(editor)).toBe("- ‸");
  });

  it("直したあとはリスト編集がそのまま効く", () => {
    // 置き換えの結果が本物のリストとして扱われることまで見る。
    const editor = editorWith("ー‸");
    type(editor, " ");

    const head = editor.state.selection.main.head;
    editor.dispatch({
      changes: { from: head, insert: "項目" },
      selection: { anchor: head + 2 },
    });
    expect(snapshot(editor)).toBe("- 項目‸");
  });

  it("｀ 3 つで fence の閉じまで置く", () => {
    const editor = editorWith("｀｀‸");
    expect(type(editor, "｀")).toBe(true);
    expect(snapshot(editor)).toBe("```‸\n```");
  });

  it("置き換えのあと 1 回の Undo で元へ戻る", () => {
    const editor = editorWith("＃‸");
    type(editor, " ");
    expect(editor.state.doc.toString()).toBe("# ");

    undo(editor);
    expect(editor.state.doc.toString()).toBe("＃");
  });

  it("対象でない入力には介入しない", () => {
    const editor = editorWith("あ‸");
    expect(type(editor, " ")).toBe(false);
    expect(editor.state.doc.toString()).toBe("あ");
  });

  it("`-` を確定した時点で、空白を待たずに箇条書きになる", () => {
    // ひらがなモードの `-` キーは `ー` の composition になる。
    // 打った瞬間には直せない（preventDefault では IME を止められない）ので、
    // 確定した直後がいちばん早い。
    const editor = editorWith("ー‸");
    expect(handleCompositionEnded(editor, 0, DEFAULT_OPTIONS)).toBe(true);
    expect(snapshot(editor)).toBe("- ‸");
  });

  it("IME が全角空白まで入れて確定した場合は、確定後に直す", () => {
    // MS-IME はひらがなモードの空白キーで全角空白を composition として入れるため、
    // inputHandler では拾えない。実機で確認した経路。
    const editor = editorWith("ー　‸");
    expect(handleCompositionEnded(editor, 0, DEFAULT_OPTIONS)).toBe(true);
    expect(snapshot(editor)).toBe("- ‸");
  });

  it("普通の日本語を確定しただけでは何もしない", () => {
    const editor = editorWith("日本語‸");
    expect(handleCompositionEnded(editor, 0, DEFAULT_OPTIONS)).toBe(false);
    expect(editor.state.doc.toString()).toBe("日本語");
  });

  it("IME 変換中は横取りしない", () => {
    const editor = editorWith("＃‸");
    // EditorView の composing は getter なので、必要な形だけ持つ view を渡す。
    const composingView = {
      composing: true,
      state: editor.state,
      dispatch: () => {
        throw new Error("変換中に dispatch してはいけない");
      },
    } as unknown as EditorView;

    expect(handleFullWidth(composingView, 1, 1, " ", DEFAULT_OPTIONS)).toBe(false);
  });
});

describe("全角の英数字・記号の半角化", () => {
  it("直接入力の Ａ は A になる", () => {
    const editor = editorWith("‸");
    expect(type(editor, "Ａ")).toBe(true);
    expect(snapshot(editor)).toBe("A‸");
  });

  it("設定 OFF なら直接入力の Ａ はそのまま", () => {
    const editor = editorWith("‸", OFF);
    expect(type(editor, "Ａ", OFF)).toBe(false);
    expect(editor.state.doc.toString()).toBe("");
  });

  it("行頭の Markdown 記号は設定 OFF でも今までどおり直る", () => {
    const editor = editorWith("＃‸", OFF);
    expect(type(editor, " ", OFF)).toBe(true);
    expect(snapshot(editor)).toBe("# ‸");
  });

  it("確定した範囲だけが半角になり、カーソルより前の全角は触られない", async () => {
    const editor = editorWith("前Ａ‸");
    await compose(editor, "Ｑｕｉｅｔ１２");
    expect(snapshot(editor)).toBe("前ＡQuiet12‸");
  });

  it("確定した範囲の中でも和文の字はそのまま", async () => {
    const editor = editorWith("‸");
    await compose(editor, "日本語１２３。");
    expect(snapshot(editor)).toBe("日本語123。‸");
  });

  it("区切り記号は既定では全角のまま、separators=true なら半角", async () => {
    const editor = editorWith("‸");
    await compose(editor, "１２：３０");
    expect(snapshot(editor)).toBe("12：30‸");

    const both = editorWith("‸", { ascii: true, separators: true });
    await compose(both, "１２：３０");
    expect(snapshot(both)).toBe("12:30‸");
  });

  it("設定 OFF なら確定しても全角のまま", async () => {
    const editor = editorWith("‸", OFF);
    await compose(editor, "Ｑｕｉｅｔ");
    expect(snapshot(editor)).toBe("Ｑｕｉｅｔ‸");
  });

  it("行頭で ー を確定すると今までどおり `- ` になる", async () => {
    const editor = editorWith("‸");
    await compose(editor, "ー");
    expect(snapshot(editor)).toBe("- ‸");
  });

  it("行頭で ＃ を確定すると `# ` になり、自動の空白が残る", async () => {
    const editor = editorWith("‸");
    await compose(editor, "＃");
    expect(snapshot(editor)).toBe("# ‸");
  });
});
