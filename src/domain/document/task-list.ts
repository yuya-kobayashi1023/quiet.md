/**
 * GFM タスクリストの 1 行を `[ ]` ↔ `[x]` で反転する。
 *
 * Preview のチェックボックスをクリックしたときに、本文の該当行を書き換えるために使う。
 * 行の判定と書き換えだけを担い、エディタへの反映は呼び出し側（App）が行う。
 */

/**
 * `- [ ] foo` / `1. [x] bar` のような行のマーカー部分。
 *
 * GFM の task list item は「リストマーカー + 空白 + `[` + 1 文字 + `]` + 空白」で始まる。
 * `- [ ]nospace` は GFM でもタスクにならないので、閉じ括弧の後の空白まで要求する。
 */
const TASK_MARKER = /^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\]\s)/;

/**
 * 行がタスク項目なら反転した行を返す。タスク項目でなければ null。
 *
 * マーカー以外（字下げ・本文）は 1 バイトも変えない。
 */
export function toggleTaskLine(lineText: string): string | null {
  const match = TASK_MARKER.exec(lineText);
  if (!match) return null;
  const [, head, state, tail] = match;
  const next = state === " " ? "x" : " ";
  return `${head}${next}${tail}${lineText.slice(match[0].length)}`;
}
