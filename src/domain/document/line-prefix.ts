/**
 * 行頭の接頭辞の付け外し（ADR-025 §4）。
 *
 * 対象は選択範囲に掛かるすべての行、選択が無ければカーソルのある行。
 * すべての行が既に同じ接頭辞を持つときだけ外し、そうでなければ持たない行へ付ける。
 *
 * ここは CodeMirror に依存しない純粋な関数として書く。
 */

import type { FormatEdit } from "./inline-format";

export type LinePrefix = "> " | "- " | "- [ ] ";

/** 済みのチェックリストも同じ接頭辞として扱う。外せないと付け外しが片道になる。 */
const CHECKLIST = ["- [ ] ", "- [x] ", "- [X] "];

function existingPrefix(line: string, prefix: LinePrefix): string | null {
  const candidates = prefix === "- [ ] " ? CHECKLIST : [prefix];
  return candidates.find((candidate) => line.startsWith(candidate)) ?? null;
}

function lineStartAt(text: string, pos: number): number {
  if (pos <= 0) return 0;
  const at = text.lastIndexOf("\n", pos - 1);
  return at === -1 ? 0 : at + 1;
}

function lineEndAt(text: string, pos: number): number {
  const at = text.indexOf("\n", pos);
  return at === -1 ? text.length : at;
}

export function toggleLinePrefix(
  text: string,
  from: number,
  to: number,
  prefix: LinePrefix,
): FormatEdit {
  const start = lineStartAt(text, from);
  // 行頭で終わる選択は、その行に掛かっていない。
  const last = to > from && lineStartAt(text, to) === to ? to - 1 : to;
  const end = lineEndAt(text, last);

  const lines = text.slice(start, end).split("\n");
  const remove = lines.every((line) => existingPrefix(line, prefix) != null);
  const insert = lines
    .map((line) => {
      const existing = existingPrefix(line, prefix);
      if (remove) return line.slice(existing?.length ?? 0);
      return existing == null ? prefix + line : line;
    })
    .join("\n");

  if (from === to) {
    const existing = existingPrefix(lines[0] ?? "", prefix);
    const shift = remove ? -(existing?.length ?? 0) : existing == null ? prefix.length : 0;
    const cursor = Math.max(start, from + shift);
    return { from: start, to: end, insert, selection: { from: cursor, to: cursor } };
  }

  return { from: start, to: end, insert, selection: { from: start, to: start + insert.length } };
}
