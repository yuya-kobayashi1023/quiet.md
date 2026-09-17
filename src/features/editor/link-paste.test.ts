// @vitest-environment jsdom

/**
 * 実際の CodeMirror 上での「選択して URL を貼るとリンクになる」。
 *
 * `link-paste.test.ts`（domain）はロジックだけを見る。こちらは**エディタへ接続した結果**を見る。
 * paste イベントは本物のクリップボードからしか起きないため、
 * `handleLinkPaste` を直接叩いて、dispatch まで通ることを確かめる。
 */

import { afterEach, describe, expect, it } from "vitest";
import { EditorSelection, EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { undo } from "@codemirror/commands";
import { coreExtensions } from "./extensions";
import { handleLinkPaste } from "./link-paste";

let view: EditorView | null = null;

afterEach(() => {
  view?.destroy();
  view = null;
});

/** 指定した範囲を選択した EditorView を作る。 */
function editorWith(
  doc: string,
  selection: EditorSelection,
  extra: Extension = [],
): EditorView {
  const parent = document.createElement("div");
  document.body.appendChild(parent);

  view = new EditorView({
    state: EditorState.create({ doc, selection, extensions: [coreExtensions(), extra] }),
    parent,
  });
  return view;
}

function snapshot(target: EditorView): string {
  const doc = target.state.doc.toString();
  const head = target.state.selection.main.head;
  return doc.slice(0, head) + "|" + doc.slice(head);
}

describe("CodeMirror 上の URL 貼り付け", () => {
  it("選択文字を [文字](URL) に置き換え、カーソルはその直後に来る", () => {
    const editor = editorWith("see foo here", EditorSelection.single(4, 7));
    expect(handleLinkPaste(editor, "https://example.com")).toBe(true);
    expect(snapshot(editor)).toBe("see [foo](https://example.com)| here");
  });

  it("1 回の Undo で元へ戻る", () => {
    const editor = editorWith("see foo here", EditorSelection.single(4, 7));
    handleLinkPaste(editor, "https://example.com");
    expect(editor.state.doc.toString()).toBe("see [foo](https://example.com) here");

    undo(editor);
    expect(editor.state.doc.toString()).toBe("see foo here");
  });

  it("選択が空なら介入しない", () => {
    const editor = editorWith("see foo here", EditorSelection.single(4));
    expect(handleLinkPaste(editor, "https://example.com")).toBe(false);
    expect(editor.state.doc.toString()).toBe("see foo here");
  });

  it("URL でなければ選択があっても介入しない", () => {
    const editor = editorWith("see foo here", EditorSelection.single(4, 7));
    expect(handleLinkPaste(editor, "hello world")).toBe(false);
    expect(editor.state.doc.toString()).toBe("see foo here");
  });

  it("複数カーソルでは介入しない", () => {
    // アプリは複数選択を許していないので、state が 2 つ目の範囲を落とさないよう明示する。
    const editor = editorWith(
      "foo bar",
      EditorSelection.create([EditorSelection.range(0, 3), EditorSelection.range(4, 7)]),
      EditorState.allowMultipleSelections.of(true),
    );
    expect(handleLinkPaste(editor, "https://example.com")).toBe(false);
    expect(editor.state.doc.toString()).toBe("foo bar");
  });

  it("IME 変換中は横取りしない", () => {
    const editor = editorWith("see foo here", EditorSelection.single(4, 7));
    // EditorView の composing は getter なので、必要な形だけ持つ view を渡す。
    const composingView = {
      composing: true,
      state: editor.state,
      dispatch: () => {
        throw new Error("変換中に dispatch してはいけない");
      },
    } as unknown as EditorView;

    expect(handleLinkPaste(composingView, "https://example.com")).toBe(false);
  });
});
