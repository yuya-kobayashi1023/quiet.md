/**
 * 全角で打たれた Markdown 記号を、その場で半角へ直す。
 *
 * 日本語入力中は `#` `-` `>` `` ` `` `|` がそのまま打てない。IME を切って、打って、
 * また戻す往復が記号のたびに要る。見出しと箇条書きが主体のノートでは 1 文書で数十回になり、
 * これが日本語の記述コストの主因になっている。
 *
 * 直すのは「その位置ではその文字を書く意味が無い」ところだけに限る。
 *
 * - 行頭の記号（`＃` `＞` `－` `ー` `＊` `＋` `１。`）は、**空白で確定した時点**で直す。
 *   全角空白で確定しても半角空白を書く。行頭 + 空白という並びなら、
 *   その全角記号を文字として書きたい場面（`第＃号` など）には当たらない。
 * - `｜` は行頭か、既に `|` のある行（＝表を書いている最中）だけ直す。
 * - `｀` は位置を問わず直す。U+FF40 は日本語の文章に出てこない字で、
 *   かつインラインコードは行の途中に書くため、行頭の規則では拾えない。
 *
 * ここは CodeMirror に依存しない純粋な関数として書く（`list-editing` と同じ方針）。
 * 保存時の整形ではなく**入力時の置換**であることに注意（AGENTS.md §8）。
 */

import { handleBacktick } from "./code-fence";
import type { EditChange } from "./list-editing";

/** 行頭に置ける全角記号。行頭の空白のあとに、記号だけがある形。 */
const LINE_MARKER = /^([ \t]*)(＃{1,6}|＞{1,6}|[－ー＊＋]|[０-９]{1,9}[．。])$/;

/** 半角空白と全角空白のどちらでも「確定した」と見なす。 */
const SPACE = /^[ 　]$/;

/** 全角数字を半角へ。`１。` → `1.` に使う。 */
function asciiDigits(digits: string): string {
  let out = "";
  for (const char of digits) {
    out += String.fromCharCode(char.charCodeAt(0) - 0xff10 + 0x30);
  }
  return out;
}

/** 行頭記号の対応表。半角へ直せないものは null。 */
function halfWidthMarker(marker: string): string | null {
  if (/^＃+$/.test(marker)) return "#".repeat(marker.length);
  if (/^＞+$/.test(marker)) return ">".repeat(marker.length);
  if (marker === "－" || marker === "ー") return "-";
  if (marker === "＊") return "*";
  if (marker === "＋") return "+";

  const ordered = /^([０-９]{1,9})[．。]$/.exec(marker);
  if (ordered) return `${asciiDigits(ordered[1] ?? "")}.`;

  return null;
}

function lineStartOf(text: string, pos: number): number {
  return text.lastIndexOf("\n", pos - 1) + 1;
}

/**
 * 打った 1 文字が全角記号の確定になるなら、その並びを半角へ直す。
 *
 * 直さない場合は null を返し、通常の入力に任せる。
 *
 * @param text  入力前の全文
 * @param from  入力位置
 * @param to    入力位置（選択がある場合はその終端）
 * @param input 打たれた文字
 */
export function handleFullWidthInput(
  text: string,
  from: number,
  to: number,
  input: string,
): EditChange | null {
  // 範囲選択を打ち消す入力には介入しない（`code-fence` と同じ判断）。
  if (from !== to) return null;

  if (SPACE.test(input)) return convertLineMarker(text, from, to);
  if (input === "｀") return convertBacktick(text, from, to);
  if (input === "｜") return convertPipe(text, from, to);
  return null;
}

/** 行頭の全角記号 + 空白 → 半角記号 + 半角空白。 */
function convertLineMarker(text: string, from: number, to: number): EditChange | null {
  const lineStart = lineStartOf(text, from);
  const matched = LINE_MARKER.exec(text.slice(lineStart, from));
  if (!matched) return null;

  const half = halfWidthMarker(matched[2] ?? "");
  if (half === null) return null;

  const insert = `${matched[1] ?? ""}${half} `;
  return { from: lineStart, to, insert, cursor: lineStart + insert.length };
}

/**
 * `｜` → `|`。表を書いている最中だけ。
 *
 * 表の 1 本目の `|` は必ず行頭に来るので、行頭と「既に `|` のある行」の 2 つで足りる。
 */
function convertPipe(text: string, from: number, to: number): EditChange | null {
  const before = text.slice(lineStartOf(text, from), from);
  if (before.trim() !== "" && !before.includes("|")) return null;
  return { from, to, insert: "|", cursor: from + 1 };
}

/**
 * `｀` → `` ` ``。直前に続く全角バッククォートもまとめて直す。
 *
 * 3 つ目で fenced code block の開きになるが、閉じを置くかどうかの判断は
 * `code-fence` が持っている。ここで作り直さず、半角へ直した姿を渡して委ねる。
 *
 * **直前が半角（＝全角が 0 個）のときも必ず委ねること。**
 * `fence-input` が反応するのは半角の `` ` `` だけで、全角の `｀` はここで消費される。
 * 委ねずに握ったまま返すと、`` `` `` + `｀` の並びで閉じの補完が消える。
 */
function convertBacktick(text: string, from: number, to: number): EditChange | null {
  let start = from;
  while (start > 0 && text[start - 1] === "｀") start--;

  const converted = "`".repeat(from - start);
  const head = text.slice(0, start) + converted;
  const fence = handleBacktick(head + text.slice(to), head.length, head.length);
  if (fence) {
    return {
      from: start,
      to,
      insert: converted + fence.insert,
      cursor: head.length + 1,
    };
  }

  return { from: start, to, insert: `${converted}\``, cursor: head.length + 1 };
}
