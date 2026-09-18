/**
 * 全角記号の置き換えを CodeMirror へ接続する。
 *
 * 判断そのものは `domain/document/fullwidth-marker`（行頭の Markdown 記号）と
 * `domain/document/half-width`（設定で切れる英数字・記号の半角化）が持つ。
 * ここは「いつ介入し、いつ既定の入力へ譲るか」だけを決める。
 * 順序は常に Markdown 記号が先。記号側が直した結果は既に半角なので、半角化は走らない。
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

import type { Extension } from "@codemirror/state";
import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import {
  handleCommittedMarker,
  handleFullWidthInput,
} from "@/domain/document/fullwidth-marker";
import { toHalfWidth, type HalfWidthOptions } from "@/domain/document/half-width";
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
  options: HalfWidthOptions,
): boolean {
  // IME の変換中は横取りしない。確定前の文字列を壊す。
  // 確定したものは compositionEnded 側が受け持つ。
  if (view.composing) return false;

  const marker = handleFullWidthInput(view.state.doc.toString(), from, to, text);
  if (marker) {
    apply(view, marker);
    return true;
  }

  const half = toHalfWidth(text, 0, text.length, options);
  if (!half) return false;

  apply(view, { from, to, insert: half.insert, cursor: from + half.insert.length });
  return true;
}

/**
 * 変換確定の直後に、行頭の全角記号 + 空白を直す。直すものが無ければ、
 * この composition で入った範囲 `[compositionFrom, head)` の全角英数字・記号を半角へ直す。
 *
 * 範囲を composition に限るのは、カーソルより前に書いてある全角を書き換えないため。
 * 過去に書いた文字は本人が全角で残したものかもしれない。
 *
 * 確定内容が state へ流れ込むのは `compositionend` の**後**なので、
 * この関数を event の中で直接呼ばない（`fullWidthInput` 側で flush を待つ）。
 *
 * @param compositionFrom composition が始まった位置。追えていなければ null
 */
export function handleCompositionEnded(
  view: EditorView,
  compositionFrom: number | null,
  options: HalfWidthOptions,
): boolean {
  const selection = view.state.selection.main;
  // 範囲選択中は触らない。何を直したいのかが決められない。
  if (!selection.empty) return false;

  const text = view.state.doc.toString();
  const marker = handleCommittedMarker(text, selection.head);
  if (marker) {
    apply(view, marker);
    return true;
  }

  if (compositionFrom === null || compositionFrom >= selection.head) return false;
  const half = toHalfWidth(text, compositionFrom, selection.head, options);
  if (!half) return false;

  apply(view, half);
  return true;
}

/**
 * composition の開始位置を追い、確定後に直す。
 *
 * 開始位置は `compositionstart` の時点のカーソルで、変換中の変更に沿って動かす。
 * IME が確定した範囲はこれとカーソルの間。CodeMirror 自身は composition の範囲を
 * 外へ出さないので、自前で持つ。
 */
function compositionTracker(options: HalfWidthOptions): Extension {
  return ViewPlugin.fromClass(
    class {
      from: number | null = null;

      update(update: ViewUpdate): void {
        if (this.from !== null) this.from = update.changes.mapPos(this.from, -1);
      }
    },
    {
      eventHandlers: {
        compositionstart(_event, view) {
          this.from = view.state.selection.main.from;
        },
        compositionend(_event, view) {
          /*
           * CodeMirror は確定内容を microtask で flush する。
           * ここで即座に doc を見ても古いままなので、1 tick 待ってから直す。
           * 直したぶんは composition とは別の transaction になるので、Undo は 2 回要る。
           *
           * 開始位置は**ここで**取り出す。MS-IME は空白キーの全角空白を composition として
           * 入れ、続けて文字を打つとそれを確定して次の composition をすぐ始める。
           * tick を待ってから読むと、次の compositionstart が上書きした位置を見てしまい、
           * 全角空白が残る（実機で確認）。
           */
          const from = this.from;
          this.from = null;
          setTimeout(() => {
            if (view.dom.isConnected) handleCompositionEnded(view, from, options);
          }, 0);
          // 既定の処理は止めない。ここは観測だけ。
          return false;
        },
      },
    },
  );
}

/** 設定で差し替えるので、`coreExtensions` には入れず Editor の Compartment で持つ。 */
export function fullWidthInput(options: HalfWidthOptions): Extension {
  return [
    EditorView.inputHandler.of((view, from, to, text) =>
      handleFullWidth(view, from, to, text, options),
    ),
    compositionTracker(options),
  ];
}
