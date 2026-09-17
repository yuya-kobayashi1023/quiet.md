// @vitest-environment jsdom

/**
 * 実際の CodeMirror 上での画像貼り付け。
 *
 * `paste` の DOM イベントは jsdom で組みにくいため、`handleImagePaste` を直接叩いて、
 * 保存結果が `![](...)` として dispatch まで通ることを確かめる。
 */

import { afterEach, describe, expect, it } from "vitest";
import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { coreExtensions } from "./extensions";
import { handleImagePaste, type ImageSaver } from "./image-paste";

let view: EditorView | null = null;

afterEach(() => {
  view?.destroy();
  view = null;
});

/** `|` の位置にカーソルを置いた EditorView を作る。`[` `]` で選択範囲を作る。 */
function editorWith(source: string): EditorView {
  const start = source.indexOf("[");
  const end = source.indexOf("]");
  const cursor = source.indexOf("|");
  const selection =
    start !== -1 && end !== -1
      ? EditorSelection.single(start, end - 1)
      : EditorSelection.single(cursor);
  const doc = source.replace(/[[\]|]/g, "");

  const parent = document.createElement("div");
  document.body.appendChild(parent);

  view = new EditorView({
    state: EditorState.create({ doc, selection, extensions: coreExtensions() }),
    parent,
  });
  return view;
}

function snapshot(target: EditorView): string {
  const doc = target.state.doc.toString();
  const head = target.state.selection.main.head;
  return doc.slice(0, head) + "|" + doc.slice(head);
}

const png = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "shot.png", { type: "image/png" });

describe("CodeMirror 上の画像貼り付け", () => {
  it("保存した相対パスを ![](...) で挿入し、カーソルは閉じ括弧の後ろへ来る", async () => {
    const editor = editorWith("before |after");
    const saver: ImageSaver = async () => "assets/image-1.png";

    expect(await handleImagePaste(editor, png(), saver)).toBe(true);
    expect(snapshot(editor)).toBe("before ![](assets/image-1.png)|after");
  });

  it("選択範囲があれば置き換える", async () => {
    const editor = editorWith("before [old]after");
    const saver: ImageSaver = async () => "assets/image-1.png";

    await handleImagePaste(editor, png(), saver);
    expect(snapshot(editor)).toBe("before ![](assets/image-1.png)|after");
  });

  it("保存に失敗（null）したら文書を変えない", async () => {
    const editor = editorWith("before |after");
    const saver: ImageSaver = async () => null;

    expect(await handleImagePaste(editor, png(), saver)).toBe(false);
    expect(snapshot(editor)).toBe("before |after");
  });

  it("画像でないファイルには介入せず、saver も呼ばない", async () => {
    const editor = editorWith("before |after");
    const received: File[] = [];
    const saver: ImageSaver = async (file) => {
      received.push(file);
      return "assets/never.png";
    };
    const text = new File(["hello"], "note.txt", { type: "text/plain" });

    expect(await handleImagePaste(editor, text, saver)).toBe(false);
    expect(received).toEqual([]);
    expect(snapshot(editor)).toBe("before |after");
  });

  it("IME 変換中は横取りしない", async () => {
    const editor = editorWith("before |after");
    const composingView = {
      composing: true,
      state: editor.state,
      dispatch: () => {
        throw new Error("変換中に dispatch してはいけない");
      },
    } as unknown as EditorView;
    const saver: ImageSaver = async () => "assets/image-1.png";

    expect(await handleImagePaste(composingView, png(), saver)).toBe(false);
  });
});
