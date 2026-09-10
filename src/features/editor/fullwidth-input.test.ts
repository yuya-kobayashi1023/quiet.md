// @vitest-environment jsdom

/**
 * 実際の CodeMirror 上での全角記号の置き換え。
 *
 * `fullwidth-marker.test.ts` はロジックだけを見る。こちらは**エディタへ接続した結果**を見る。
 * `inputHandler` は本物の入力イベントからしか呼ばれないため、
 * `handleFullWidth` を直接叩いて、dispatch まで通ることを確かめる。
 */

import { afterEach, describe, expect, it } from "vitest";
import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { undo } from "@codemirror/commands";
import { coreExtensions } from "./extensions";
import { handleFullWidth } from "./fullwidth-input";

/** カーソルの印。`|` は表のテストで使うため、ここでも `‸` にする。 */
const CARET = "‸";

let view: EditorView | null = null;

afterEach(() => {
  view?.destroy();
  view = null;
});

/** `‸` の位置にカーソルを置いた EditorView を作る。 */
function editorWith(source: string): EditorView {
  const pos = source.indexOf(CARET);
  if (pos === -1) throw new Error(`テストの入力に ${CARET} が必要です`);
  const doc = source.slice(0, pos) + source.slice(pos + CARET.length);

  const parent = document.createElement("div");
  document.body.appendChild(parent);

  view = new EditorView({
    state: EditorState.create({
      doc,
      selection: EditorSelection.single(pos),
      extensions: coreExtensions(),
    }),
    parent,
  });
  return view;
}

/** カーソル位置にその文字を打つ。返り値は置き換えが走ったか。 */
function type(target: EditorView, text: string): boolean {
  const { from, to } = target.state.selection.main;
  return handleFullWidth(target, from, to, text);
}

function snapshot(target: EditorView): string {
  const doc = target.state.doc.toString();
  const head = target.state.selection.main.head;
  return doc.slice(0, head) + CARET + doc.slice(head);
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

    expect(handleFullWidth(composingView, 1, 1, " ")).toBe(false);
  });
});
