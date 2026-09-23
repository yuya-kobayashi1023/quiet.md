import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { ensureSyntaxTree } from "@codemirror/language";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { listLines } from "./list-layout";

/** `|` の位置をカーソルとして、行番号ごとの見た目を返す。 */
function layout(source: string, tabSize = 4) {
  const cursor = source.indexOf("|");
  const doc = source.replace("|", "");
  const state = EditorState.create({
    doc,
    extensions: [markdown({ base: markdownLanguage }), EditorState.tabSize.of(tabSize)],
  });
  ensureSyntaxTree(state, state.doc.length);
  return Object.fromEntries(listLines(state, cursor === -1 ? 0 : cursor));
}

describe("折り返しの頭そろえ", () => {
  it("marker の後ろの本文の桁にそろえる", () => {
    expect(layout("- a\n  - b\n\n10. c\n- [ ] d")).toEqual({
      1: { hang: 2, guides: [] },
      2: { hang: 4, guides: [] },
      4: { hang: 4, guides: [] },
      5: { hang: 6, guides: [] },
    });
  });

  it("継続行はその行の字下げにそろえ、リストの外には付けない", () => {
    expect(layout("text\n\n- a\n  more\n\nafter")).toEqual({
      3: { hang: 2, guides: [] },
      4: { hang: 2, guides: [] },
    });
  });

  it("タブの字下げは tabSize で数える", () => {
    expect(layout("- a\n\t- b", 4)[2]).toEqual({ hang: 6, guides: [] });
  });
});

describe("縦線", () => {
  it("カーソルがあるリストで、親の marker の真下に子の範囲だけ引く", () => {
    expect(layout("- a|\n  - b\n    - c\n  - d\n- e")).toEqual({
      1: { hang: 2, guides: [] },
      2: { hang: 4, guides: [0] },
      3: { hang: 6, guides: [0, 2] },
      4: { hang: 4, guides: [0] },
      5: { hang: 2, guides: [] },
    });
  });

  it("カーソルが別のリストや本文にあれば引かない", () => {
    const source = "- a\n  - b\n\npara|\n\n- c\n  - d";
    const lines = Object.values(layout(source));
    expect(lines.flatMap((line) => line.guides)).toEqual([]);
  });

  it("リストの外にカーソルを移すと消え、別のリストに入るとそちらだけに引く", () => {
    expect(layout("- a\n  - b\n\npara\n\n- c\n  - d|")).toEqual({
      1: { hang: 2, guides: [] },
      2: { hang: 4, guides: [] },
      6: { hang: 2, guides: [] },
      7: { hang: 4, guides: [0] },
    });
  });
});
