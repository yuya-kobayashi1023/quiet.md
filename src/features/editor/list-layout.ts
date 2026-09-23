/**
 * 箇条書きの字下げを見やすくする（ui-spec.md §7「箇条書きの字下げ」）。
 *
 * - 折り返した行を、項目の本文の頭にそろえる（全リスト）
 * - カーソルがある箇条書きの中だけ、親項目の marker の真下に縦線を引く
 *
 * 行の構造は Lezer の構文木から読む。正規表現で読むと、リスト内のコードブロックや
 * 字下げのない継続行を取り違えるため。
 */

import { countColumn, type EditorState, type Extension } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import type { SyntaxNode } from "@lezer/common";

/** 1 行ぶんの見た目。列はすべて表示上の桁（タブは tabSize で展開）。 */
export interface ListLine {
  /** 折り返した 2 行目以降を始める桁。0 なら字下げしない。 */
  hang: number;
  /** 縦線を引く桁。左から順。 */
  guides: number[];
}

function columnAt(state: EditorState, pos: number): number {
  const line = state.doc.lineAt(pos);
  return countColumn(line.text, state.tabSize, pos - line.from);
}

/** marker 行の本文が始まる桁。task list なら `[ ] ` の後ろ。 */
function contentColumn(state: EditorState, mark: SyntaxNode): number {
  const line = state.doc.lineAt(mark.to);
  const rest = line.text.slice(mark.to - line.from);
  const lead = /^[ \t]+(\[[ xX]\][ \t]+)?/.exec(rest)?.[0] ?? "";
  return countColumn(line.text, state.tabSize, mark.to - line.from + lead.length);
}

function outermostList(state: EditorState, pos: number): SyntaxNode | null {
  let found: SyntaxNode | null = null;
  for (let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, -1); node; node = node.parent) {
    if (node.name === "BulletList" || node.name === "OrderedList") found = node;
  }
  return found;
}

/**
 * `from`〜`to` の範囲にある行の見た目を、行番号ごとに返す。
 * 縦線は `cursor` を含む一番外側のリストの中だけに引く。
 */
export function listLines(
  state: EditorState,
  cursor: number,
  from = 0,
  to = state.doc.length,
): Map<number, ListLine> {
  const lines = new Map<number, ListLine>();
  const at = (lineNumber: number) => {
    let line = lines.get(lineNumber);
    if (!line) lines.set(lineNumber, (line = { hang: 0, guides: [] }));
    return line;
  };

  syntaxTree(state).iterate({
    from,
    to,
    enter(node) {
      if (node.name !== "ListItem") return;
      const mark = node.node.getChild("ListMark");
      if (!mark) return;
      const first = state.doc.lineAt(node.from).number;
      const last = state.doc.lineAt(node.to).number;
      at(first).hang = contentColumn(state, mark);
      // 継続行は、その行自身の字下げ位置へそろえる。子リストの marker 行は子の ListItem が上書きする。
      for (let n = first + 1; n <= last; n++) {
        const line = state.doc.line(n);
        const indent = /^[ \t]*/.exec(line.text)?.[0].length ?? 0;
        if (indent < line.length) at(n).hang = countColumn(line.text, state.tabSize, indent);
      }
    },
  });

  const list = outermostList(state, cursor);
  if (list) {
    syntaxTree(state).iterate({
      from: list.from,
      to: list.to,
      enter(ref) {
        if (ref.name !== "ListItem" || ref.from < list.from || ref.to > list.to) return;
        const mark = ref.node.getChild("ListMark");
        const child = ref.node.getChild("BulletList") ?? ref.node.getChild("OrderedList");
        if (!mark || !child) return;
        const column = columnAt(state, mark.from);
        const start = state.doc.lineAt(child.from).number;
        const end = state.doc.lineAt(ref.to).number;
        for (let n = start; n <= end; n++) at(n).guides.push(column);
      },
    });
  }

  for (const line of lines.values()) line.guides.sort((a, b) => a - b);
  return lines;
}

/**
 * 縦線は 1px の背景として描く。行の背景なので、折り返した行や空行もつながって見える。
 * 位置は `ch` で決まる。等幅フォントなので、桁と画面上の位置が一致する。
 */
function lineStyle({ hang, guides }: ListLine): string {
  const style: string[] = [];
  if (hang > 0) style.push(`padding-left: ${hang}ch`, `text-indent: -${hang}ch`);
  if (guides.length > 0) {
    style.push(
      `background-image: ${guides.map(() => "var(--list-guide)").join(", ")}`,
      `background-position: ${guides.map((column) => `calc(${column}ch + 0.5ch) 0`).join(", ")}`,
      "background-size: 1px 100%",
      "background-repeat: no-repeat",
    );
  }
  return style.join("; ");
}

function build(view: EditorView): DecorationSet {
  const { state } = view;
  const decorations = [];
  const seen = new Map<number, ListLine>();
  for (const { from, to } of view.visibleRanges) {
    for (const [number, line] of listLines(state, state.selection.main.head, from, to)) {
      seen.set(number, line);
    }
  }
  for (const number of [...seen.keys()].sort((a, b) => a - b)) {
    const style = lineStyle(seen.get(number)!);
    if (style) {
      decorations.push(Decoration.line({ attributes: { style } }).range(state.doc.line(number).from));
    }
  }
  return Decoration.set(decorations);
}

export const listLayout: Extension = [
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = build(view);
      }
      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          update.selectionSet ||
          update.viewportChanged ||
          syntaxTree(update.startState) !== syntaxTree(update.state)
        ) {
          this.decorations = build(update.view);
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  ),
  EditorView.theme({
    "&": {
      "--list-guide": "linear-gradient(var(--border), var(--border))",
    },
  }),
];
