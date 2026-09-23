/**
 * エディタ本文の右クリックメニュー（ADR-025）。
 *
 * 項目の並びと出し分けは ADR-025 §2。書式をどう付け外しするかは domain の
 * inline-format / line-prefix が決め、ここは CodeMirror への接続だけを持つ。
 * 実行したら本文へ focus を戻す。メニューのために編集面を離れたままにしない。
 */

import { redo, undo } from "@codemirror/commands";
import { EditorSelection } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import {
  insertLink,
  toggleInlineFormat,
  type FormatEdit,
  type InlineMarker,
} from "@/domain/document/inline-format";
import { toggleLinePrefix, type LinePrefix } from "@/domain/document/line-prefix";
import { ContextMenu, ContextMenuItem, type MenuPosition } from "@/ui/components/ContextMenu";

/** 右クリックの瞬間に Editor が持っていた状態（ADR-025 §3 のカーソル移動を済ませた後）。 */
export interface EditorContextTarget {
  position: MenuPosition;
  /** 選択している文字列。未選択なら空。 */
  selected: string;
  canUndo: boolean;
  canRedo: boolean;
}

/** 検索の項目に出す文字数の上限。 */
const SEARCH_LABEL_LIMIT = 20;

function applyEdit(view: EditorView, edit: FormatEdit) {
  view.dispatch({
    changes: { from: edit.from, to: edit.to, insert: edit.insert },
    selection: EditorSelection.single(edit.selection.from, edit.selection.to),
    scrollIntoView: true,
    userEvent: "input.format",
  });
}

function inlineFormat(marker: InlineMarker) {
  return (view: EditorView) => {
    const { from, to } = view.state.selection.main;
    applyEdit(view, toggleInlineFormat(view.state.doc.toString(), from, to, marker));
  };
}

function linePrefix(prefix: LinePrefix) {
  return (view: EditorView) => {
    const { from, to } = view.state.selection.main;
    applyEdit(view, toggleLinePrefix(view.state.doc.toString(), from, to, prefix));
  };
}

function insertLinkAt(view: EditorView) {
  const { from, to } = view.state.selection.main;
  applyEdit(view, insertLink(view.state.doc.toString(), from, to));
}

async function copySelection(view: EditorView) {
  const { from, to } = view.state.selection.main;
  await navigator.clipboard.writeText(view.state.sliceDoc(from, to));
}

async function cutSelection(view: EditorView) {
  await copySelection(view);
  view.dispatch({ ...view.state.replaceSelection(""), userEvent: "delete.cut" });
}

/**
 * クリップボードから読み直して挿入する（ADR-025 §6）。
 *
 * WebView では `execCommand("paste")` が効かない。画像とリンクの貼り付けは
 * paste イベントに依存しているので、ここで扱うのは文字列だけ。
 */
async function pasteText(view: EditorView) {
  const text = await navigator.clipboard.readText();
  view.dispatch({
    ...view.state.replaceSelection(text),
    scrollIntoView: true,
    userEvent: "input.paste",
  });
}

function searchLabel(selected: string): string {
  const oneLine = selected.replace(/\s+/g, " ").trim();
  return oneLine.length > SEARCH_LABEL_LIMIT
    ? `${oneLine.slice(0, SEARCH_LABEL_LIMIT)}…`
    : oneLine;
}

export function EditorContextMenu({
  target,
  view,
  onSearch,
  onError,
  onClose,
}: {
  target: EditorContextTarget;
  view: EditorView | null;
  onSearch: (query: string) => void;
  onError: (message: string) => void;
  onClose: () => void;
}) {
  const hasSelection = target.selected.length > 0;

  const run = (command: (view: EditorView) => void) => {
    if (view) {
      command(view);
      view.focus();
    }
    onClose();
  };

  const runClipboard = (command: (view: EditorView) => Promise<void>, failure: string) => {
    if (view) {
      const editor = view;
      void command(editor)
        .catch(() => onError(failure))
        .finally(() => editor.focus());
    }
    onClose();
  };

  return (
    <ContextMenu position={target.position} onClose={onClose}>
      <ContextMenuItem shortcut="Ctrl+Z" disabled={!target.canUndo} onClick={() => run(undo)}>
        元に戻す
      </ContextMenuItem>
      <ContextMenuItem shortcut="Ctrl+Y" disabled={!target.canRedo} onClick={() => run(redo)}>
        やり直す
      </ContextMenuItem>
      <hr />
      <ContextMenuItem
        shortcut="Ctrl+X"
        disabled={!hasSelection}
        onClick={() => runClipboard(cutSelection, "クリップボードへコピーできませんでした")}
      >
        切り取り
      </ContextMenuItem>
      <ContextMenuItem
        shortcut="Ctrl+C"
        disabled={!hasSelection}
        onClick={() => runClipboard(copySelection, "クリップボードへコピーできませんでした")}
      >
        コピー
      </ContextMenuItem>
      <ContextMenuItem
        shortcut="Ctrl+V"
        onClick={() => runClipboard(pasteText, "クリップボードから貼り付けられませんでした")}
      >
        貼り付け
      </ContextMenuItem>
      <hr />
      <ContextMenuItem onClick={() => run(inlineFormat("**"))}>太字
      </ContextMenuItem>
      <ContextMenuItem onClick={() => run(inlineFormat("*"))}>斜体
      </ContextMenuItem>
      <ContextMenuItem onClick={() => run(inlineFormat("`"))}>インラインコード
      </ContextMenuItem>
      <ContextMenuItem onClick={() => run(insertLinkAt)}>リンク</ContextMenuItem>
      <hr />
      <ContextMenuItem onClick={() => run(linePrefix("> "))}>引用</ContextMenuItem>
      <ContextMenuItem onClick={() => run(linePrefix("- "))}>箇条書き</ContextMenuItem>
      <ContextMenuItem onClick={() => run(linePrefix("- [ ] "))}>チェックリスト</ContextMenuItem>
      {hasSelection ? (
        <>
          <hr />
          <ContextMenuItem
            onClick={() => {
              onSearch(target.selected);
              onClose();
            }}
          >
            "{searchLabel(target.selected)}" を検索
          </ContextMenuItem>
        </>
      ) : null}
    </ContextMenu>
  );
}
