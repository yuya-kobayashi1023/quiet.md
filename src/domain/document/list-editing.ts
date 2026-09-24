/**
 * 箇条書きの階層編集。
 *
 * リストを文字列として扱わず、「現在の階層 depth」と「項目が空かどうか」から
 * 編集操作を決める。
 *
 * 状態遷移:
 * - non-empty list item + Enter      → 同じ depth に新しい項目
 * - list item + Tab                  → depth + 1
 * - list item + Shift+Tab            → depth - 1
 * - empty list item + Enter (深さ>0) → 空項目を消して depth - 1 の項目へ
 * - empty list item + Enter (深さ=0) → 空項目を消してリストを終了し、通常段落へ
 *
 * ここは CodeMirror に依存しない純粋な関数として書く。
 * DOM なしでテストでき、エディタを差し替えても残るため。
 */

/** 適用すべき 1 回の編集。 */
export interface EditChange {
  from: number;
  to: number;
  insert: string;
  /** 適用後のカーソル位置（絶対オフセット）。 */
  cursor: number;
}

export interface ListItem {
  lineStart: number;
  lineEnd: number;
  /** 行頭の空白そのもの。 */
  indent: string;
  /** `-` `*` `+` または `1.` `1)`。 */
  marker: string;
  /** marker の直後の空白。 */
  spacing: string;
  /** `[ ] ` / `[x] `。task list でなければ null。 */
  checkbox: string | null;
  /** checkbox を除いた本文。 */
  content: string;
  /** リスト階層。一番外側が 0。 */
  depth: number;
  ordered: boolean;
  /** ordered list のときの番号。 */
  number: number | null;
}

const LIST_LINE =
  /^([ \t]*)([-*+]|\d{1,9}[.)])([ \t]+)(\[[ xX]\][ \t]+)?(.*)$/;

/** タブを空白幅に均して数える。 */
function widthOf(indent: string, tabWidth: number): number {
  let width = 0;
  for (const char of indent) {
    width += char === "\t" ? tabWidth - (width % tabWidth) : 1;
  }
  return width;
}

interface RawLine {
  start: number;
  end: number;
  text: string;
}

function splitLines(text: string): RawLine[] {
  const lines: RawLine[] = [];
  let start = 0;
  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || text[i] === "\n") {
      lines.push({ start, end: i, text: text.slice(start, i) });
      start = i + 1;
    }
  }
  return lines;
}

function lineIndexAt(lines: RawLine[], pos: number): number {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (pos >= line.start && pos <= line.end) return i;
  }
  return Math.max(0, lines.length - 1);
}

interface ParsedLine {
  indent: string;
  marker: string;
  spacing: string;
  checkbox: string | null;
  content: string;
}

function parseLine(text: string): ParsedLine | null {
  const match = LIST_LINE.exec(text);
  if (!match) return null;
  return {
    indent: match[1] ?? "",
    marker: match[2] ?? "-",
    spacing: match[3] ?? " ",
    checkbox: match[4] ?? null,
    content: match[5] ?? "",
  };
}

/**
 * 直前の連続したリスト行を遡り、祖先のインデント幅を集める。
 *
 * depth を「インデント幅 / 2」のような固定計算で出すと、
 * 4 スペースで書かれた文書で崩れる。実際の構造から数える。
 */
function ancestorWidths(
  lines: RawLine[],
  lineIndex: number,
  ownWidth: number,
  tabWidth: number,
): number[] {
  const widths = new Set<number>();
  for (let i = lineIndex - 1; i >= 0; i--) {
    const line = lines[i]!;
    if (line.text.trim() === "") {
      // 空行 1 つはリスト内の緩い区切りとして許容する。2 つ続けば終わり。
      const previous = lines[i - 1];
      if (!previous || previous.text.trim() === "") break;
      continue;
    }
    const parsed = parseLine(line.text);
    if (!parsed) {
      // リスト項目の折り返し行（本文より深いインデント）なら続行する。
      const indentWidth = widthOf(/^[ \t]*/.exec(line.text)?.[0] ?? "", tabWidth);
      if (indentWidth > 0) continue;
      break;
    }
    const width = widthOf(parsed.indent, tabWidth);
    if (width < ownWidth) widths.add(width);
  }
  return [...widths].sort((a, b) => a - b);
}

/** カーソル位置のリスト項目を読む。リストでなければ null。 */
export function parseListItem(
  text: string,
  pos: number,
  tabWidth = 2,
): ListItem | null {
  const lines = splitLines(text);
  const index = lineIndexAt(lines, pos);
  const line = lines[index]!;
  const parsed = parseLine(line.text);
  if (!parsed) return null;

  const ownWidth = widthOf(parsed.indent, tabWidth);
  const depth = ancestorWidths(lines, index, ownWidth, tabWidth).length;
  const ordered = /^\d/.test(parsed.marker);

  return {
    lineStart: line.start,
    lineEnd: line.end,
    indent: parsed.indent,
    marker: parsed.marker,
    spacing: parsed.spacing,
    checkbox: parsed.checkbox,
    content: parsed.content,
    depth,
    ordered,
    number: ordered ? Number.parseInt(parsed.marker, 10) : null,
  };
}

/** 項目に本文があるか。task list のチェックボックスは本文として数えない。 */
export function isEmptyItem(item: ListItem): boolean {
  return item.content.trim() === "";
}

/** 次の項目の marker。ordered なら番号を 1 つ進める。 */
function nextMarker(item: Pick<ListItem, "marker" | "ordered" | "number">): string {
  if (!item.ordered || item.number == null) return item.marker;
  const delimiter = item.marker.slice(-1);
  return `${item.number + 1}${delimiter}`;
}

/** 新しい項目の接頭辞を組み立てる。 */
function prefixOf(
  indent: string,
  marker: string,
  spacing: string,
  checkbox: string | null,
): string {
  // チェック済みの項目から続けるときは、未チェックで始める。
  const box = checkbox ? checkbox.replace(/\[[xX]\]/, "[ ]") : "";
  return `${indent}${marker}${spacing}${box}`;
}

/**
 * 指定した幅のインデントを持つ、直近のリスト行を探す。
 *
 * outdent 先の marker と番号を、その階層の実際の書き方に合わせるため。
 */
function findSiblingAt(
  lines: RawLine[],
  lineIndex: number,
  targetWidth: number,
  tabWidth: number,
): { parsed: ParsedLine; ordered: boolean; number: number | null } | null {
  for (let i = lineIndex - 1; i >= 0; i--) {
    const line = lines[i]!;
    if (line.text.trim() === "") continue;
    const parsed = parseLine(line.text);
    if (!parsed) continue;
    const width = widthOf(parsed.indent, tabWidth);
    if (width === targetWidth) {
      const ordered = /^\d/.test(parsed.marker);
      return {
        parsed,
        ordered,
        number: ordered ? Number.parseInt(parsed.marker, 10) : null,
      };
    }
    if (width < targetWidth) return null;
  }
  return null;
}

/**
 * Enter。
 *
 * リスト項目でなければ null を返し、通常の改行に任せる。
 */
export function handleEnter(text: string, pos: number, tabWidth = 2): EditChange | null {
  const item = parseListItem(text, pos, tabWidth);
  if (!item) return null;

  const lines = splitLines(text);
  const lineIndex = lineIndexAt(lines, pos);

  if (isEmptyItem(item)) {
    // --- 空の項目 ---
    if (item.depth === 0) {
      // リストを終了して通常段落へ。行の中身を消し、改行だけ残す。
      return {
        from: item.lineStart,
        to: item.lineEnd,
        insert: "\n",
        cursor: item.lineStart + 1,
      };
    }

    // 1 段浅い階層へ移す。**行を置き換えるだけで、改行は入れない。**
    // ここで改行を入れると空の通常行ができてしまう。
    const ownWidth = widthOf(item.indent, tabWidth);
    const ancestors = ancestorWidths(lines, lineIndex, ownWidth, tabWidth);
    const targetWidth = ancestors[ancestors.length - 1] ?? 0;
    const sibling = findSiblingAt(lines, lineIndex, targetWidth, tabWidth);

    const indent = sibling ? sibling.parsed.indent : " ".repeat(targetWidth);
    const marker = sibling
      ? nextMarker({
          marker: sibling.parsed.marker,
          ordered: sibling.ordered,
          number: sibling.number,
        })
      : item.marker;
    const spacing = sibling ? sibling.parsed.spacing : item.spacing;
    const insert = prefixOf(indent, marker, spacing, item.checkbox);

    return {
      from: item.lineStart,
      to: item.lineEnd,
      insert,
      cursor: item.lineStart + insert.length,
    };
  }

  // --- 本文のある項目。同じ depth に新しい項目を作る ---
  const insert = `\n${prefixOf(
    item.indent,
    nextMarker(item),
    item.spacing,
    item.checkbox,
  )}`;

  return {
    from: pos,
    to: pos,
    insert,
    cursor: pos + insert.length,
  };
}

/** indent と marker を差し替える。本文から見たカーソル位置は保つ。 */
function reshape(
  item: ListItem,
  nextIndent: string,
  nextMarkerText: string,
  pos: number,
): EditChange {
  const removed = item.indent.length + item.marker.length;
  const inserted = nextIndent + nextMarkerText;
  const cursorInLine = Math.max(pos - item.lineStart, removed);
  return {
    from: item.lineStart,
    to: item.lineStart + removed,
    insert: inserted,
    cursor: item.lineStart + cursorInLine - removed + inserted.length,
  };
}

/**
 * 移った先の階層で使う marker。
 *
 * 番号付きの項目は、その階層に先行する番号付きの兄弟がいれば続きの番号、
 * いなければ 1 から振り直す。字下げした項目が親の連番を引き継がないように。
 */
function markerAt(
  item: ListItem,
  lines: RawLine[],
  lineIndex: number,
  targetWidth: number,
  tabWidth: number,
): string {
  if (!item.ordered) return item.marker;
  const sibling = findSiblingAt(lines, lineIndex, targetWidth, tabWidth);
  if (sibling?.ordered) {
    return nextMarker({
      marker: sibling.parsed.marker,
      ordered: true,
      number: sibling.number,
    });
  }
  return `1${item.marker.slice(-1)}`;
}

/**
 * Tab。1 段深くする。
 *
 * 直前の兄弟の本文の頭までは必ず下げる。`1. ` の下を 2 桁しか下げないと、
 * CommonMark では子ではなく同じリストの兄弟として読まれるため。
 */
export function handleIndent(text: string, pos: number, tabWidth = 2): EditChange | null {
  const item = parseListItem(text, pos, tabWidth);
  if (!item) return null;

  const lines = splitLines(text);
  const lineIndex = lineIndexAt(lines, pos);
  const ownWidth = widthOf(item.indent, tabWidth);

  let nextIndent: string;
  if (item.indent.includes("\t")) {
    // タブでインデントされた文書はタブのまま。
    nextIndent = item.indent + "\t";
  } else {
    const parent = findSiblingAt(lines, lineIndex, ownWidth, tabWidth);
    const parentContent = parent
      ? ownWidth + parent.parsed.marker.length + widthOf(parent.parsed.spacing, tabWidth)
      : 0;
    nextIndent = " ".repeat(Math.max(ownWidth + tabWidth, parentContent));
  }

  const marker = markerAt(item, lines, lineIndex, widthOf(nextIndent, tabWidth), tabWidth);
  return reshape(item, nextIndent, marker, pos);
}

/** Shift+Tab。1 段浅くする。すでに一番外側なら何もしない。 */
export function handleOutdent(text: string, pos: number, tabWidth = 2): EditChange | null {
  const item = parseListItem(text, pos, tabWidth);
  if (!item || item.indent === "") return null;

  const lines = splitLines(text);
  const lineIndex = lineIndexAt(lines, pos);
  const ownWidth = widthOf(item.indent, tabWidth);
  const ancestors = ancestorWidths(lines, lineIndex, ownWidth, tabWidth);
  const targetWidth = ancestors[ancestors.length - 1] ?? Math.max(0, ownWidth - tabWidth);
  const sibling = findSiblingAt(lines, lineIndex, targetWidth, tabWidth);

  const nextIndent = sibling
    ? sibling.parsed.indent
    : item.indent.includes("\t")
      ? item.indent.slice(0, -1)
      : " ".repeat(targetWidth);

  const marker = markerAt(item, lines, lineIndex, widthOf(nextIndent, tabWidth), tabWidth);
  return reshape(item, nextIndent, marker, pos);
}

/**
 * Backspace。記号だけの項目を行ごと消し、1 つ上の行末へ戻る。
 *
 * 既定の動作では字下げ、記号、空白を 1 つずつ消すことになり、何度も押す必要がある。
 * 本文がある項目や、カーソルが記号より前にあるときは既定の動作に任せる。
 */
export function handleBackspace(text: string, pos: number, tabWidth = 2): EditChange | null {
  const item = parseListItem(text, pos, tabWidth);
  if (!item || !isEmptyItem(item)) return null;

  const prefixEnd =
    item.lineStart +
    item.indent.length +
    item.marker.length +
    item.spacing.length +
    (item.checkbox?.length ?? 0);
  if (pos < prefixEnd) return null;

  const from = Math.max(0, item.lineStart - 1);
  return { from, to: item.lineEnd, insert: "", cursor: from };
}
