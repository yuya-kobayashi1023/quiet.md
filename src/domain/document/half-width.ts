/**
 * IME が確定した全角の英数字・記号を半角へ直す。
 *
 * `fullwidth-marker` は「その位置では全角を書く意味が無い」Markdown 記号だけを直す。
 * こちらは意味を問わず、確定した範囲の全角英数字・記号をまとめて半角にする。
 * 日本語の文章に英単語や数値を混ぜるとき、IME を切り替えずに済ませるためのもの。
 *
 * 対応は 1 つの表で持ち、2 段に分ける。
 *
 * - ascii: 英数字と記号。U+FF01〜U+FF5E を ASCII へ、全角空白を半角空白へ、
 *   MS-IME が `"` `'` の代わりに出す `“ ” ‘ ’` を `"` `'` へ
 * - separator: `， ． ： ； ～ 〜`。和文の句読点として全角のまま使う人がいるので、
 *   ascii とは別に切れるようにする
 *
 * `。` `、` `「」` `・` `ー` や `【】` のように ASCII に対応が無い字は表に無く、
 * どの設定でも触らない。
 *
 * CodeMirror に依存しない純粋な関数として書く（`fullwidth-marker` と同じ方針）。
 * 保存時の整形ではなく**入力時の置換**である（AGENTS.md §8）。
 */

import type { EditChange } from "./list-editing";

export interface HalfWidthOptions {
  /** 全角の英数字と記号を半角にする。 */
  ascii: boolean;
  /** 区切り記号（： ； ， ． ～）も半角にする。ascii が false なら効かない。 */
  separators: boolean;
}

type Tier = "ascii" | "separator";

interface Entry {
  half: string;
  tier: Tier;
}

const SEPARATORS: ReadonlyMap<string, string> = new Map([
  ["，", ","],
  ["．", "."],
  ["：", ":"],
  ["；", ";"],
  ["～", "~"],
  ["〜", "~"],
]);

const ASCII_EXTRAS: ReadonlyMap<string, string> = new Map([
  ["　", " "],
  ["“", '"'],
  ["”", '"'],
  ["‘", "'"],
  ["’", "'"],
]);

const FULLWIDTH_FIRST = 0xff01;
const FULLWIDTH_LAST = 0xff5e;
const FULLWIDTH_OFFSET = 0xfee0;

function buildTable(): ReadonlyMap<string, Entry> {
  const table = new Map<string, Entry>();
  for (let code = FULLWIDTH_FIRST; code <= FULLWIDTH_LAST; code++) {
    const char = String.fromCharCode(code);
    if (SEPARATORS.has(char)) continue;
    table.set(char, { half: String.fromCharCode(code - FULLWIDTH_OFFSET), tier: "ascii" });
  }
  for (const [char, half] of ASCII_EXTRAS) table.set(char, { half, tier: "ascii" });
  for (const [char, half] of SEPARATORS) table.set(char, { half, tier: "separator" });
  return table;
}

const TABLE = buildTable();

/** 1 文字の半角。設定で対象外か、表に無ければ null。 */
export function halfWidthOf(char: string, options: HalfWidthOptions): string | null {
  if (!options.ascii) return null;
  const entry = TABLE.get(char);
  if (!entry) return null;
  if (entry.tier === "separator" && !options.separators) return null;
  return entry.half;
}

/** text[from, to) の全角を半角へ。変わらなければ null。 */
export function toHalfWidth(
  text: string,
  from: number,
  to: number,
  options: HalfWidthOptions,
): EditChange | null {
  let insert = "";
  let changed = false;
  for (const char of text.slice(from, to)) {
    const half = halfWidthOf(char, options);
    if (half === null) {
      insert += char;
    } else {
      insert += half;
      changed = true;
    }
  }
  if (!changed) return null;
  return { from, to, insert, cursor: from + insert.length };
}
