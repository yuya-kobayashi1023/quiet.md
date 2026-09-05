/**
 * Editor の拡張構成。
 *
 * Editor コンポーネントとテストの両方がここを使う。
 * **キーマップの優先順位はこのファイルの並び順そのもの**なので、
 * 順序を変えるときは `list-keymap.test.ts` を必ず通すこと。
 */

import { Prec, type Extension } from "@codemirror/state";
import { drawSelection, EditorView, highlightSpecialChars, keymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { tags } from "@lezer/highlight";
import { searchKeymap } from "@codemirror/search";
import { listKeymap } from "./list-keymap";

/**
 * Markdown の「意味を持つ記号」だけを色付ける。
 * 本文自体を多色にしない（ui-spec.md §8）。
 */
export const quietHighlight = HighlightStyle.define([
  { tag: tags.processingInstruction, color: "var(--syntax-marker)" },
  { tag: tags.meta, color: "var(--syntax-marker)" },
  { tag: tags.contentSeparator, color: "var(--syntax-marker)" },
  { tag: tags.url, color: "var(--text-muted)" },
  { tag: tags.link, color: "var(--accent-text)" },
  { tag: tags.heading, color: "var(--text-primary)", fontWeight: "500" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "600" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.quote, color: "var(--text-prose)" },
]);

export const baseTheme = EditorView.theme({
  "&": { backgroundColor: "transparent", color: "var(--text-editor)" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    // スクロールは pane が持つ。Editor 内部に 2 本目を作らない。
    overflow: "visible",
    fontFamily: "var(--font-mono)",
    lineHeight: "1.84",
  },
  ".cm-content": { padding: 0, caretColor: "var(--text-primary)" },
  ".cm-line": { padding: 0 },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--text-primary)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "var(--selection)",
  },
  ".cm-searchMatch": {
    backgroundColor: "color-mix(in srgb, var(--accent) 22%, transparent)",
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "color-mix(in srgb, var(--accent) 42%, transparent)",
  },
});

/**
 * 編集の中核。テーマ・フォント・折り返しなど、設定で差し替わるものは含めない。
 *
 * `listKeymap` は `markdown()` より**前**に置く。
 * `@codemirror/lang-markdown` は Enter に独自のリスト継続処理を持っており、
 * 後ろに置くとそちらが先に走って、空項目の Enter で空行が残る。
 * さらに `Prec.highest` で確実に先頭へ出す。
 */
export function coreExtensions(): Extension[] {
  return [
    Prec.highest(listKeymap),
    history(),
    drawSelection(),
    highlightSpecialChars(),
    bracketMatching(),
    markdown({ base: markdownLanguage, codeLanguages: [] }),
    syntaxHighlighting(quietHighlight),
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
  ];
}
