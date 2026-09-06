/**
 * Fenced code block の入力補助。
 *
 * ``` を打ち終えた時点で閉じの ``` を先に置き、カーソルは開きの ``` の直後に残す。
 * 言語名（`ts` / `python` など）を続けて書き、Enter で本文へ入る、という
 * 実際の書き順をそのまま通すため。カーソルを中へ落とすと言語名が書けない。
 *
 * ここは CodeMirror に依存しない純粋な関数として書く（`list-editing` と同じ方針）。
 */

import type { EditChange } from "./list-editing";

/** 開き行として認める形。行頭の空白のあとにバッククォート 2 つだけ。 */
const OPENING = /^([ \t]*)``$/;

/** fence の開始・終了になりうる行。中身の言語名は見ない。 */
const FENCE_LINE = /^[ \t]*(```|~~~)/;

/**
 * バッククォートを 1 文字打った結果が fence の開きになるなら、閉じも一緒に置く。
 *
 * 補完しない場合は null を返し、通常の入力に任せる。
 *
 * @param text 入力前の全文
 * @param from 入力位置
 * @param to   入力位置（選択がある場合はその終端）
 */
export function handleBacktick(text: string, from: number, to: number): EditChange | null {
  // 範囲選択を打ち消す入力には介入しない。何を包みたいのかが決められない。
  if (from !== to) return null;

  const lineStart = text.lastIndexOf("\n", from - 1) + 1;
  const opening = OPENING.exec(text.slice(lineStart, from));
  if (!opening) return null;

  // 行の残りに何か書かれていれば、既存の行の途中。触らない。
  const lineBreak = text.indexOf("\n", to);
  const lineEnd = lineBreak === -1 ? text.length : lineBreak;
  if (text.slice(to, lineEnd).trim() !== "") return null;

  // 既に開いている block の中で ``` を打つのは、閉じる操作。閉じを足さない。
  if (isInsideFence(text, lineStart)) return null;

  const indent = opening[1] ?? "";
  return {
    from,
    to,
    insert: `\`\n${indent}\`\`\``,
    // 打った 1 文字の直後。言語名はここから続けて書く。
    cursor: from + 1,
  };
}

/** `lineStart` の行が、既に開いている fence の内側にあるか。 */
function isInsideFence(text: string, lineStart: number): boolean {
  if (lineStart === 0) return false;
  let open = false;
  for (const line of text.slice(0, lineStart - 1).split("\n")) {
    if (FENCE_LINE.test(line)) open = !open;
  }
  return open;
}
