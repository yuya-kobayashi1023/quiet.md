/**
 * 全角記号の置き換えを CodeMirror へ接続する。
 *
 * 判断そのものは `domain/document/fullwidth-marker` が持つ。
 * ここは「いつ介入し、いつ既定の入力へ譲るか」だけを決める。
 *
 * `fence-input` と同じ形。keymap ではなく `inputHandler` で受ける
 * （置き換えの引き金は文字入力であって、キー割当ではないため）。
 */

import { EditorView } from "@codemirror/view";
import { handleFullWidthInput } from "@/domain/document/fullwidth-marker";

/**
 * テストから直接叩くための入口。
 *
 * `inputHandler` は実際の入力イベントからしか呼ばれないので、
 * IME 変換中に介入しないことなどは、ここを通して確かめる。
 */
export function handleFullWidth(
  view: EditorView,
  from: number,
  to: number,
  text: string,
): boolean {
  // IME の変換中は横取りしない。確定前の文字列を壊す。
  // 確定した全角記号は compositionend の後の DOM 変更として、改めてここへ届く。
  if (view.composing) return false;

  const change = handleFullWidthInput(view.state.doc.toString(), from, to, text);
  if (!change) return false;

  view.dispatch({
    changes: { from: change.from, to: change.to, insert: change.insert },
    selection: { anchor: change.cursor },
    scrollIntoView: true,
    userEvent: "input.type",
  });
  return true;
}

export const fullWidthInput = EditorView.inputHandler.of((view, from, to, text) =>
  handleFullWidth(view, from, to, text),
);
