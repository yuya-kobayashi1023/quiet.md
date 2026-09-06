/**
 * Fenced code block の閉じ補完を CodeMirror へ接続する。
 *
 * 判断そのものは `domain/document/code-fence` が持つ。
 * ここは「いつ介入し、いつ既定の入力へ譲るか」だけを決める。
 */

import { EditorView } from "@codemirror/view";
import { handleBacktick } from "@/domain/document/code-fence";

/**
 * テストから直接叩くための入口。
 *
 * `inputHandler` は実際のキー入力イベントからしか呼ばれないので、
 * IME 変換中に介入しないことなどは、ここを通して確かめる。
 */
export function handleFenceInput(
  view: EditorView,
  from: number,
  to: number,
  text: string,
): boolean {
  if (text !== "`") return false;
  // IME の変換中は横取りしない。確定前の文字列を壊す。
  if (view.composing) return false;

  const change = handleBacktick(view.state.doc.toString(), from, to);
  if (!change) return false;

  view.dispatch({
    changes: { from: change.from, to: change.to, insert: change.insert },
    selection: { anchor: change.cursor },
    scrollIntoView: true,
    userEvent: "input.type",
  });
  return true;
}

/**
 * ` は文字入力なので、keymap ではなく `inputHandler` で受ける。
 * listKeymap のような優先順位の調整は要らない。
 */
export const fenceInput = EditorView.inputHandler.of((view, from, to, text) =>
  handleFenceInput(view, from, to, text),
);
