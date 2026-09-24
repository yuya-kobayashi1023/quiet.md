/**
 * 箇条書きの階層編集を CodeMirror へ接続する。
 *
 * 判断そのものは `domain/document/list-editing` が持つ。
 * ここは「いつ介入し、いつ既定の動作へ譲るか」だけを決める。
 */

import { keymap, type Command, type EditorView } from "@codemirror/view";
import {
  handleBackspace,
  handleEnter,
  handleIndent,
  handleOutdent,
  type EditChange,
} from "@/domain/document/list-editing";

type Handler = (text: string, pos: number, tabWidth: number) => EditChange | null;

function run(view: EditorView, handler: Handler): boolean {
  // IME の変換中は横取りしない。Enter は変換確定に使われる。
  if (view.composing) return false;

  const { state } = view;
  const selection = state.selection.main;
  // 範囲選択中は既定の動作へ譲る（複数行のインデント等）。
  if (!selection.empty) return false;

  const change = handler(state.doc.toString(), selection.head, state.tabSize);
  if (!change) return false;

  view.dispatch({
    changes: { from: change.from, to: change.to, insert: change.insert },
    selection: { anchor: change.cursor },
    scrollIntoView: true,
    userEvent: "input.list",
  });
  return true;
}

const enterInList: Command = (view) => run(view, handleEnter);
const indentInList: Command = (view) => run(view, handleIndent);
const outdentInList: Command = (view) => run(view, handleOutdent);
const backspaceInList: Command = (view) => run(view, handleBackspace);

/**
 * テストから直接叩くための入口。
 *
 * IME 変換中と範囲選択中に介入しないことは、keymap 越しでは再現しにくいので
 * ここを通して確かめる。
 */
export const listCommands = {
  enter: enterInList,
  indent: indentInList,
  outdent: outdentInList,
  backspace: backspaceInList,
};

/**
 * リスト編集のキーマップ。
 *
 * 優先度は `extensions.ts` 側で `Prec.highest` を付けて決める。
 * `@codemirror/lang-markdown` も Enter を握っているため、
 * ここで `Prec.high` を付けるだけでは足りない（並び順で負ける）。
 *
 * リスト外では false を返すので、既定の動作がそのまま走る。
 */
export const listKeymap = keymap.of([
  { key: "Enter", run: enterInList },
  { key: "Tab", run: indentInList },
  { key: "Shift-Tab", run: outdentInList },
  { key: "Backspace", run: backspaceInList },
]);
