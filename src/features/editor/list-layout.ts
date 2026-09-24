/**
 * 箇条書きの字下げを見やすくする（ui-spec.md §7「箇条書きの字下げ」）。
 *
 * - 折り返した行を、項目の本文の頭にそろえる（全リスト）
 * - カーソルのある項目と同じ深さの兄弟の marker を濃くし、同じリストのほかの marker を薄くする
 *
 * 行の構造は Lezer の構文木から読む。正規表現で読むと、リスト内のコードブロックや
 * 字下げのない継続行を取り違えるため。
 */

import { countColumn, type EditorState, type Extension, type Range } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import type { SyntaxNode } from "@lezer/common";

/** marker 行の本文が始まる桁。task list なら `[ ] ` の後ろ。 */
function contentColumn(state: EditorState, mark: SyntaxNode): number {
  const line = state.doc.lineAt(mark.to);
  const rest = line.text.slice(mark.to - line.from);
  const lead = /^[ \t]+(\[[ xX]\][ \t]+)?/.exec(rest)?.[0] ?? "";
  return countColumn(line.text, state.tabSize, mark.to - line.from + lead.length);
}

/**
 * `from`〜`to` の範囲にある行について、折り返した 2 行目以降を始める桁を行番号ごとに返す。
 * 桁は表示上の桁（タブは tabSize で展開）。
 */
export function hangingIndents(
  state: EditorState,
  from = 0,
  to = state.doc.length,
): Map<number, number> {
  const hangs = new Map<number, number>();
  syntaxTree(state).iterate({
    from,
    to,
    enter(node) {
      if (node.name !== "ListItem") return;
      const mark = node.node.getChild("ListMark");
      if (!mark) return;
      const first = state.doc.lineAt(node.from).number;
      const last = state.doc.lineAt(node.to).number;
      hangs.set(first, contentColumn(state, mark));
      // 継続行は、その行自身の字下げ位置へそろえる。子リストの marker 行は子の ListItem が上書きする。
      for (let n = first + 1; n <= last; n++) {
        const line = state.doc.line(n);
        const indent = /^[ \t]*/.exec(line.text)?.[0].length ?? 0;
        if (indent < line.length) hangs.set(n, countColumn(line.text, state.tabSize, indent));
      }
    },
  });
  return hangs;
}

export interface ListMarks {
  /** カーソルのある項目と、同じリストに並ぶ兄弟の marker。 */
  siblings: SyntaxNode[];
  /** 同じ一番外側のリストにある、それ以外の marker。 */
  others: SyntaxNode[];
}

/** `cursor` のある項目を基準に、marker を兄弟とそれ以外に分ける。リストの外なら両方とも空。 */
export function listMarks(state: EditorState, cursor: number): ListMarks {
  // 行頭のカーソルは -1 側だと前の行の項目に入るので、その行の最初の文字から探す。
  const line = state.doc.lineAt(cursor);
  const indent = /^[ \t]*/.exec(line.text)?.[0].length ?? 0;
  const start =
    indent < line.length
      ? syntaxTree(state).resolveInner(line.from + indent, 1)
      : syntaxTree(state).resolveInner(cursor, -1);
  let item: SyntaxNode | null = null;
  let outermost: SyntaxNode | null = null;
  for (let node: SyntaxNode | null = start; node; node = node.parent) {
    if (node.name === "ListItem") item ??= node;
    if (node.name === "BulletList" || node.name === "OrderedList") outermost = node;
  }
  const marks: ListMarks = { siblings: [], others: [] };
  const list = item?.parent;
  if (!list || !outermost) return marks;

  const scope = outermost;
  syntaxTree(state).iterate({
    from: scope.from,
    to: scope.to,
    enter(ref) {
      if (ref.name !== "ListMark" || ref.from < scope.from || ref.to > scope.to) return;
      const isSibling = ref.node.parent?.parent?.from === list.from && ref.node.parent.parent.to === list.to;
      (isSibling ? marks.siblings : marks.others).push(ref.node);
    },
  });
  return marks;
}

const siblingMark = Decoration.mark({ class: "cm-list-mark-sibling" });
const otherMark = Decoration.mark({ class: "cm-list-mark-other" });

function build(view: EditorView): DecorationSet {
  const { state } = view;
  const decorations: Range<Decoration>[] = [];
  const hangs = new Map<number, number>();
  for (const { from, to } of view.visibleRanges) {
    for (const [number, hang] of hangingIndents(state, from, to)) hangs.set(number, hang);
  }
  for (const [number, hang] of hangs) {
    const style = `padding-left: ${hang}ch; text-indent: -${hang}ch`;
    decorations.push(Decoration.line({ attributes: { style } }).range(state.doc.line(number).from));
  }
  const { siblings, others } = listMarks(state, state.selection.main.head);
  for (const mark of siblings) decorations.push(siblingMark.range(mark.from, mark.to));
  for (const mark of others) decorations.push(otherMark.range(mark.from, mark.to));
  return Decoration.set(decorations, true);
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
  /*
   * 差は色相ではなく明るさと太さでつける。薄い marker も同じオレンジを背景へ寄せただけなので、
   * 色の見分けにくい人にも「濃い / 薄い」として伝わる。
   * `*` まで指定するのは、構文ハイライトの span が内側に入っても色を上書きするため。
   */
  EditorView.theme({
    ".cm-list-mark-sibling, .cm-list-mark-sibling *": {
      fontWeight: "600",
    },
    ".cm-list-mark-other, .cm-list-mark-other *": {
      color: "color-mix(in srgb, var(--syntax-marker) 35%, var(--canvas))",
    },
  }),
];
