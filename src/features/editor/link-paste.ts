/**
 * 「選択して URL を貼るとリンクになる」を CodeMirror へ接続する。
 *
 * 判断そのものは `domain/document/link-paste` が持つ。
 * ここは「いつ介入し、いつ既定の貼り付けへ譲るか」だけを決める。
 */

import { EditorView } from "@codemirror/view";
import { linkForPaste } from "@/domain/document/link-paste";

/**
 * テストから直接叩くための入口。
 *
 * paste イベントは本物のクリップボードからしか起きないので、
 * IME 変換中や複数カーソルで介入しないことは、ここを通して確かめる。
 */
export function handleLinkPaste(view: EditorView, pasted: string): boolean {
  // IME の変換中は横取りしない。確定前の文字列を壊す。
  if (view.composing) return false;
  // 複数カーソルは「どの選択をリンク文字にするか」が決められない。
  if (view.state.selection.ranges.length !== 1) return false;

  const { from, to, empty } = view.state.selection.main;
  if (empty) return false;

  const insert = linkForPaste(view.state.sliceDoc(from, to), pasted);
  if (insert === null) return false;

  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + insert.length },
    scrollIntoView: true,
    userEvent: "input.paste",
  });
  return true;
}

/**
 * 貼り付けは文字入力ではないので、`inputHandler` ではなく paste イベントで受ける。
 * true を返すと CodeMirror 標準の貼り付けは走らない。
 */
export const linkPaste = EditorView.domEventHandlers({
  paste(event, view) {
    const pasted = event.clipboardData?.getData("text/plain");
    if (pasted === undefined || !handleLinkPaste(view, pasted)) return false;
    event.preventDefault();
    return true;
  },
});
