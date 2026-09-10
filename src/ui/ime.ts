/**
 * IME 変換中のキー入力を、アプリの操作として扱わないためのガード。
 *
 * 日本語入力では、変換を確定する Enter と、実行を意味する Enter が
 * **同じキーイベント**として届く。キー・修飾キー・順序のどれにも差は無く、
 * 区別できる情報は composition 状態だけなので、これを見ないハンドラは必ず誤動作する
 * （変換確定の 1 回目の Enter で検索が進む・コマンドが走る・ファイル名が確定する）。
 *
 * エディタ側は CodeMirror の `view.composing` で守られている
 * （`list-keymap.ts` / `fence-input.ts`）。React の input / textarea には
 * その仕組みが無いので、ここを通す。
 *
 * **新しく Enter や Escape を拾う入力欄を足すときは、必ず `whenNotComposing` を通すこと。**
 * 同じ抜けが独立に増えるのを防ぐために、判定を 1 箇所へ寄せている。
 */

/**
 * composition の判定に使う値だけを取り出した形。
 *
 * 本物の `KeyboardEvent` を作らずにテストできるよう、構造だけで受ける。
 */
export interface CompositionSignals {
  isComposing?: boolean;
  keyCode?: number;
}

/**
 * このキーイベントが IME の変換中に起きたものか。
 *
 * `isComposing` と `keyCode === 229` の両方を見る。Chromium は変換中の keydown を
 * `keyCode 229`（key は "Process"）で出すが、確定の Enter をどちらの形で出すかは
 * プラットフォームと IME で揺れる。どちらか一方だけでは取りこぼす。
 */
export function isComposingEvent(event: CompositionSignals | null | undefined): boolean {
  if (!event) return false;
  return event.isComposing === true || event.keyCode === 229;
}

/**
 * 変換中は何もしないハンドラへ包む。
 *
 * 変換中に来たキーは `preventDefault` もせずそのまま IME へ渡す。
 * ここで握ると変換確定そのものが壊れる。
 */
export function whenNotComposing<E extends { nativeEvent: CompositionSignals }>(
  handler: (event: E) => void,
): (event: E) => void {
  return (event) => {
    if (isComposingEvent(event.nativeEvent)) return;
    handler(event);
  };
}
