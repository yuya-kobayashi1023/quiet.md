// @vitest-environment jsdom

/**
 * 実際の CodeMirror 上での箇条書き編集。
 *
 * `list-editing.test.ts` はロジックだけを見る。こちらは**キーマップの優先順位**を見る。
 * `@codemirror/lang-markdown` も Enter に独自のリスト継続処理を持っているため、
 * こちらが先に走らないと、空項目の Enter で空行が残ってしまう。
 * 実際にその不具合を出したので、テストで固定する。
 */

import { afterEach, describe, expect, it } from "vitest";
import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView, runScopeHandlers } from "@codemirror/view";
import { indentUnit } from "@codemirror/language";
import { coreExtensions } from "./extensions";
import { listCommands } from "./list-keymap";

let view: EditorView | null = null;

afterEach(() => {
  view?.destroy();
  view = null;
});

/** `|` の位置にカーソルを置いた EditorView を作る。 */
function editorWith(source: string): EditorView {
  const pos = source.indexOf("|");
  if (pos === -1) throw new Error("テストの入力に | が必要です");
  const doc = source.slice(0, pos) + source.slice(pos + 1);

  const parent = document.createElement("div");
  document.body.appendChild(parent);

  view = new EditorView({
    state: EditorState.create({
      doc,
      selection: EditorSelection.single(pos),
      extensions: [
        ...coreExtensions(),
        EditorState.tabSize.of(2),
        indentUnit.of("  "),
      ],
    }),
    parent,
  });
  return view;
}

/** 実際の keydown を、CodeMirror の優先順位解決を通して流す。 */
function press(target: EditorView, key: string, shiftKey = false): boolean {
  const event = new KeyboardEvent("keydown", { key, shiftKey, bubbles: true });
  return runScopeHandlers(target, event, "editor");
}

function snapshot(target: EditorView): string {
  const doc = target.state.doc.toString();
  const head = target.state.selection.main.head;
  return doc.slice(0, head) + "|" + doc.slice(head);
}

describe("CodeMirror 上の Enter", () => {
  it("本文のある項目では同じ階層に項目を作る", () => {
    const editor = editorWith("- Item A|");
    expect(press(editor, "Enter")).toBe(true);
    expect(snapshot(editor)).toBe("- Item A\n- |");
  });

  it("ネストされた項目でも同じ階層を保つ", () => {
    const editor = editorWith("- Item A\n  - Item B|");
    press(editor, "Enter");
    expect(snapshot(editor)).toBe("- Item A\n  - Item B\n  - |");
  });

  it("空のネストされた項目では 1 段浅くなり、空行を作らない", () => {
    const editor = editorWith("- Item A\n  - Item B\n  - |");
    press(editor, "Enter");

    expect(snapshot(editor)).toBe("- Item A\n  - Item B\n- |");
    // lang-markdown の Enter が先に走ると、ここに空行が入る。
    expect(editor.state.doc.toString()).not.toMatch(/\n[ \t]+\n/);
    expect(editor.state.doc.lines).toBe(3);
  });

  it("空の最上位項目ではリストが終わる", () => {
    const editor = editorWith("- Item A\n- |");
    press(editor, "Enter");
    expect(snapshot(editor)).toBe("- Item A\n\n|");
  });

  it("リストでない行は既定の改行に任せる", () => {
    const editor = editorWith("ただの段落|");
    press(editor, "Enter");
    expect(editor.state.doc.toString()).toBe("ただの段落\n");
  });

  it("IME 変換中は横取りしない", () => {
    const editor = editorWith("- Item A|");
    // EditorView の composing は getter なので、必要な形だけ持つ view を渡す。
    const composingView = {
      composing: true,
      state: editor.state,
      dispatch: () => {
        throw new Error("変換中に dispatch してはいけない");
      },
    } as unknown as EditorView;

    expect(listCommands.enter(composingView)).toBe(false);
  });

  it("変換中でなければ介入する（上のテストの対照）", () => {
    const editor = editorWith("- Item A|");
    expect(listCommands.enter(editor)).toBe(true);
    expect(snapshot(editor)).toBe("- Item A\n- |");
  });
});

describe("CodeMirror 上の Tab / Shift+Tab", () => {
  it("Tab で 1 段深くなる", () => {
    const editor = editorWith("- Item A\n- Item B|");
    expect(press(editor, "Tab")).toBe(true);
    expect(snapshot(editor)).toBe("- Item A\n  - Item B|");
  });

  it("Shift+Tab で 1 段浅くなる", () => {
    const editor = editorWith("- Item A\n  - Item B|");
    expect(press(editor, "Tab", true)).toBe(true);
    expect(snapshot(editor)).toBe("- Item A\n- Item B|");
  });

  it("一番外側で Shift+Tab しても崩れない", () => {
    const editor = editorWith("- Item A|");
    press(editor, "Tab", true);
    expect(editor.state.doc.toString()).toBe("- Item A");
  });

  it("範囲選択中は既定のインデントに任せる", () => {
    const editor = editorWith("- Item A\n- Item B|");
    editor.dispatch({ selection: EditorSelection.range(0, editor.state.doc.length) });
    press(editor, "Tab");
    // リスト編集としては介入しない（複数行のインデントは既定の動作）。
    expect(editor.state.doc.toString().startsWith("  - Item A")).toBe(true);
  });
});

describe("5 つの状態遷移を続けて実行する", () => {
  it("入力 → ネスト → 浅く → リスト終了まで通しで動く", () => {
    const editor = editorWith("|");

    editor.dispatch({ changes: { from: 0, insert: "- Item A" }, selection: { anchor: 8 } });

    // 1. non-empty + Enter → 同じ depth
    press(editor, "Enter");
    editor.dispatch({
      changes: { from: editor.state.selection.main.head, insert: "Item B" },
      selection: { anchor: editor.state.selection.main.head + 6 },
    });
    expect(editor.state.doc.toString()).toBe("- Item A\n- Item B");

    // 2. Tab → depth + 1
    press(editor, "Tab");
    expect(editor.state.doc.toString()).toBe("- Item A\n  - Item B");

    // 3. non-empty + Enter → 同じ depth（ネスト側）
    press(editor, "Enter");
    expect(editor.state.doc.toString()).toBe("- Item A\n  - Item B\n  - ");

    // 4. empty + Enter (depth 1) → depth 0 へ。空行を作らない
    press(editor, "Enter");
    expect(editor.state.doc.toString()).toBe("- Item A\n  - Item B\n- ");

    // 5. empty + Enter (depth 0) → リスト終了
    press(editor, "Enter");
    expect(editor.state.doc.toString()).toBe("- Item A\n  - Item B\n\n");
    expect(snapshot(editor)).toBe("- Item A\n  - Item B\n\n|");
  });
});
