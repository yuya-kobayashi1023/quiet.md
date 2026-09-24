import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { ensureSyntaxTree } from "@codemirror/language";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { hangingIndents, listMarks } from "./list-layout";

/** `|` の位置をカーソルとした state を作る。 */
function setup(source: string, tabSize = 4) {
  const cursor = Math.max(source.indexOf("|"), 0);
  const state = EditorState.create({
    doc: source.replace("|", ""),
    extensions: [markdown({ base: markdownLanguage }), EditorState.tabSize.of(tabSize)],
  });
  ensureSyntaxTree(state, state.doc.length);
  return { state, cursor };
}

function hangs(source: string, tabSize = 4) {
  return Object.fromEntries(hangingIndents(setup(source, tabSize).state));
}

/** 濃くする marker と薄くする marker を、行番号で返す。 */
function marks(source: string) {
  const { state, cursor } = setup(source);
  const { siblings, others } = listMarks(state, cursor);
  const lines = (nodes: typeof siblings) => nodes.map((node) => state.doc.lineAt(node.from).number);
  return { siblings: lines(siblings), others: lines(others) };
}

describe("折り返しの頭そろえ", () => {
  it("marker の後ろの本文の桁にそろえる", () => {
    expect(hangs("- a\n  - b\n\n10. c\n- [ ] d")).toEqual({ 1: 2, 2: 4, 4: 4, 5: 6 });
  });

  it("継続行はその行の字下げにそろえ、リストの外には付けない", () => {
    expect(hangs("text\n\n- a\n  more\n\nafter")).toEqual({ 3: 2, 4: 2 });
  });

  it("タブの字下げは tabSize で数える", () => {
    expect(hangs("- a\n\t- b", 4)[2]).toBe(6);
  });
});

describe("同じ深さの marker", () => {
  it("カーソルのある項目の兄弟を濃くし、同じリストのほかの深さを薄くする", () => {
    expect(marks("- a\n- b\n  - c\n  - d\n  - |\n- e")).toEqual({
      siblings: [3, 4, 5],
      others: [1, 2, 6],
    });
  });

  it("一番上の階層では、一番上の項目どうしが兄弟になる", () => {
    expect(marks("- a|\n  - b\n- c")).toEqual({ siblings: [1, 3], others: [2] });
  });

  it("同じ深さでも、別の親の子は兄弟にしない", () => {
    expect(marks("- a\n  - b|\n  - c\n- d\n  - e")).toEqual({
      siblings: [2, 3],
      others: [1, 4, 5],
    });
  });

  it("継続行や行頭にカーソルがあっても、その行の項目を基準にする", () => {
    expect(marks("- a\n  - b\n    more|\n  - c\n- d").siblings).toEqual([2, 4]);
    expect(marks("- a\n|  - b\n- c").siblings).toEqual([2]);
  });

  it("カーソルがリストの外にあれば何もしない、別のリストには触れない", () => {
    expect(marks("- a\n  - b\n\npara|\n\n- c")).toEqual({ siblings: [], others: [] });
    expect(marks("- a\n  - b\n\npara\n\n- c|")).toEqual({ siblings: [6], others: [] });
  });
});
