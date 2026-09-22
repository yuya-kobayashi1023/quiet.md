/**
 * インライン書式の付け外し（ADR-025 §4）。
 *
 * 選択範囲を `**` `*` `` ` `` で囲み、既に同じ記号で囲まれていれば外す。
 * 囲まれているかどうかは、選択そのものが記号を含む場合と、選択の外側が
 * 記号の場合の両方を見る。
 *
 * 判断は文字列だけで行い、Markdown の構文木は見ない（ADR-025 Consequences）。
 * ここは CodeMirror に依存しない純粋な関数として書く。
 */

/** 適用すべき 1 回の置換と、適用後の選択範囲。 */
export interface FormatEdit {
  from: number;
  to: number;
  insert: string;
  /** 適用後の選択範囲。カーソルだけなら from === to。 */
  selection: { from: number; to: number };
}

/** 囲み記号。 */
export type InlineMarker = "**" | "*" | "`";

/** リンクの url 部分に置く文字列。挿入後はここを選択する。 */
const LINK_PLACEHOLDER = "url";

/** `text` の `start` から `end` までが、ちょうど marker で囲まれているか。 */
function wrappedBy(text: string, start: number, end: number, marker: InlineMarker): boolean {
  if (start < 0 || end > text.length) return false;
  if (end - start < marker.length * 2) return false;
  if (text.slice(start, start + marker.length) !== marker) return false;
  if (text.slice(end - marker.length, end) !== marker) return false;
  // `**`（太字）の片方を斜体の記号と読み違えると、外したときに太字が壊れる。
  if (marker === "*" && (text[start - 1] === "*" || text[start + 1] === "*")) return false;
  if (marker === "*" && (text[end] === "*" || text[end - 2] === "*")) return false;
  return true;
}

export function toggleInlineFormat(
  text: string,
  from: number,
  to: number,
  marker: InlineMarker,
): FormatEdit {
  if (from === to) {
    const inside = from + marker.length;
    return { from, to, insert: marker + marker, selection: { from: inside, to: inside } };
  }

  if (wrappedBy(text, from, to, marker)) {
    const inner = text.slice(from + marker.length, to - marker.length);
    return { from, to, insert: inner, selection: { from, to: from + inner.length } };
  }

  const outerFrom = from - marker.length;
  const outerTo = to + marker.length;
  if (wrappedBy(text, outerFrom, outerTo, marker)) {
    const inner = text.slice(from, to);
    return {
      from: outerFrom,
      to: outerTo,
      insert: inner,
      selection: { from: outerFrom, to: outerFrom + inner.length },
    };
  }

  const selected = text.slice(from, to);
  return {
    from,
    to,
    insert: marker + selected + marker,
    selection: { from: from + marker.length, to: from + marker.length + selected.length },
  };
}

/** `[選択した文字](url)` を挿入し、`url` を選択する（ADR-025 §4）。 */
export function insertLink(text: string, from: number, to: number): FormatEdit {
  const selected = text.slice(from, to);
  // `[` + 本文 + `](` の後ろが url の先頭。
  const urlFrom = from + selected.length + 3;
  return {
    from,
    to,
    insert: `[${selected}](${LINK_PLACEHOLDER})`,
    selection: { from: urlFrom, to: urlFrom + LINK_PLACEHOLDER.length },
  };
}
