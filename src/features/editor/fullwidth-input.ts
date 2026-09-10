/**
 * 全角記号の置き換えを CodeMirror へ接続する。
 *
 * 判断そのものは `domain/document/fullwidth-marker` が持つ。
 * ここは「いつ介入し、いつ既定の入力へ譲るか」だけを決める。
 *
 * 入口が 2 つ要る。
 *
 * 1. `inputHandler` — 直接入力された全角記号を、打った瞬間に直す
 * 2. `compositionend` — IME が変換確定として入れたものを、確定後に直す
 *
 * 2 が要るのは、MS-IME がひらがなモードの空白キーで**全角空白を composition として**
 * 入れるため。その最中の変更は `view.composing` が立つので 1 は介入できず、
 * 確定時には新しい変更が起きないので 1 が呼ばれ直すこともない。
 * 実機（Windows 11 / WebView2）で `ー` + 空白キーが直らないことを確認して足した。
 */

import { EditorView } from "@codemirror/view";
import {
  handleCommittedMarker,
  handleFullWidthInput,
} from "@/domain/document/fullwidth-marker";
import type { EditChange } from "@/domain/document/list-editing";

function apply(view: EditorView, change: EditChange): void {
  view.dispatch({
    changes: { from: change.from, to: change.to, insert: change.insert },
    selection: { anchor: change.cursor },
    scrollIntoView: true,
    userEvent: "input.type",
  });
}

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
  // 確定したものは compositionEnded 側が受け持つ。
  if (view.composing) return false;

  const change = handleFullWidthInput(view.state.doc.toString(), from, to, text);
  if (!change) return false;

  apply(view, change);
  return true;
}

/**
 * 変換確定の直後に、行頭の全角記号 + 空白を直す。
 *
 * 確定内容が state へ流れ込むのは `compositionend` の**後**なので、
 * この関数を event の中で直接呼ばない（`fullWidthInput` 側で flush を待つ）。
 */
export function handleCompositionEnded(view: EditorView): boolean {
  const selection = view.state.selection.main;
  // 範囲選択中は触らない。何を直したいのかが決められない。
  if (!selection.empty) return false;

  const change = handleCommittedMarker(view.state.doc.toString(), selection.head);
  if (!change) return false;

  apply(view, change);
  return true;
}

export const fullWidthInput = [
  EditorView.inputHandler.of((view, from, to, text) => handleFullWidth(view, from, to, text)),
  EditorView.domEventHandlers({
    compositionend: (_event, view) => {
      /*
       * CodeMirror は確定内容を microtask で flush する。
       * ここで即座に doc を見ても古いままなので、1 tick 待ってから直す。
       * 直したぶんは composition とは別の transaction になるので、Undo は 2 回要る。
       */
      setTimeout(() => {
        if (view.dom.isConnected) handleCompositionEnded(view);
      }, 0);
      // 既定の処理は止めない。ここは観測だけ。
      return false;
    },
  }),
];
