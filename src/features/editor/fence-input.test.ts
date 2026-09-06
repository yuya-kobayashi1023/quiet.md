// @vitest-environment jsdom

/**
 * 実際の CodeMirror 上での ``` の閉じ補完。
 *
 * `code-fence.test.ts` はロジックだけを見る。こちらは**エディタへ接続した結果**を見る。
 * `inputHandler` は本物のキー入力イベントからしか呼ばれないため、
 * `handleFenceInput` を直接叩いて、dispatch まで通ることを確かめる。
 */

import { afterEach, describe, expect, it } from "vitest";
import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { undo } from "@codemirror/commands";
import { coreExtensions } from "./extensions";
import { handleFenceInput } from "./fence-input";

let view: EditorView | null = null;

afterEach(() => {
  view?.destroy();
  view = null;
});

/** `|` の位置にカーソルを置いた EditorView を作る。 */
function editorWith(source: string): EditorView {
  const pos = source.indexOf("|");
  if (pos === -1) throw new Error("テストの入力に | が必要です");
  const doc = source.slice(0, pos) + source.slice(pos + 1);

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

/** カーソル位置にその文字を打つ。返り値は補完が走ったか。 */
function type(target: EditorView, text: string): boolean {
  const { from, to } = target.state.selection.main;
  return handleFenceInput(target, from, to, text);
}

function snapshot(target: EditorView): string {
  const doc = target.state.doc.toString();
  const head = target.state.selection.main.head;
  return doc.slice(0, head) + "|" + doc.slice(head);
}

describe("CodeMirror 上の ``` 補完", () => {
  it("3 つ目のバッククォートで閉じまで置き、カーソルは開きの直後に残る", () => {
    const editor = editorWith("``|");
    expect(type(editor, "`")).toBe(true);
    expect(snapshot(editor)).toBe("```|\n```");
  });

  it("言語名を書いて Enter を打つと、本文の行にカーソルが来る", () => {
    const editor = editorWith("``|");
    type(editor, "`");

    // 補完後の続き。ここは通常の入力なので dispatch でよい。
    const afterFence = editor.state.selection.main.head;
    editor.dispatch({
      changes: { from: afterFence, insert: "ts" },
      selection: { anchor: afterFence + 2 },
    });
    const beforeEnter = editor.state.selection.main.head;
    editor.dispatch({
      changes: { from: beforeEnter, insert: "\n" },
      selection: { anchor: beforeEnter + 1 },
    });

    expect(snapshot(editor)).toBe("```ts\n|\n```");
  });

  it("バッククォート以外の入力には介入しない", () => {
    const editor = editorWith("``|");
    expect(type(editor, "a")).toBe(false);
    expect(editor.state.doc.toString()).toBe("``");
  });

  it("補完のあと 1 回の Undo で元へ戻る", () => {
    const editor = editorWith("``|");
    type(editor, "`");
    expect(editor.state.doc.toString()).toBe("```\n```");

    // 打った 1 文字と、足した閉じが別々の Undo に割れていないこと。
    undo(editor);
    expect(editor.state.doc.toString()).toBe("``");
  });

  it("IME 変換中は横取りしない", () => {
    const editor = editorWith("``|");
    // EditorView の composing は getter なので、必要な形だけ持つ view を渡す。
    const composingView = {
      composing: true,
      state: editor.state,
      dispatch: () => {
        throw new Error("変換中に dispatch してはいけない");
      },
    } as unknown as EditorView;

    expect(handleFenceInput(composingView, 2, 2, "`")).toBe(false);
  });
});
