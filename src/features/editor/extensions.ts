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
import { languages as codeLanguages } from "@codemirror/language-data";
import { tags } from "@lezer/highlight";
import { selectNextOccurrence, selectSelectionMatches } from "@codemirror/search";
import { listKeymap } from "./list-keymap";
import { fenceInput } from "./fence-input";
import { linkPaste } from "./link-paste";

/**
 * Markdown の「意味を持つ記号」だけを色付ける。
 * 本文自体を多色にしない（ui-spec.md §8）。
 */
export const quietHighlight = HighlightStyle.define([
  { tag: tags.url, color: "var(--text-muted)" },
  { tag: tags.link, color: "var(--accent-text)" },
  { tag: tags.heading, color: "var(--text-primary)", fontWeight: "500" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "600" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.quote, color: "var(--text-prose)" },

  /*
   * 記号（#, >, -, backtick, []() など）は**必ずこの並びの最後に置く**。
   *
   * lezer-markdown は ATXHeading1/... のように子孫へも役を継がせるので、
   * HeaderMark には heading と processingInstruction の両方の class が付く。
   * HighlightStyle は配列順のまま CSS を吐き、詳細度は同じ（class 1 個）なので
   * **後ろに書いた規則が勝つ**。記号を前に置くと heading / quote の色で塗り潰され、
   * 見出しの # や引用の > が本文と同色になる（ui-spec.md §8 に反する）。
   */
  { tag: tags.processingInstruction, color: "var(--syntax-marker)" },
  { tag: tags.meta, color: "var(--syntax-marker)" },
  { tag: tags.contentSeparator, color: "var(--syntax-marker)" },

  /*
   * Fenced code block の中だけで効く役（ADR-009）。
   * Markdown 本文はこれらの tag を出さないので、上の規則とは衝突しない。
   * Preview 側（preview.css の .hljs-*）と役の対応を必ず揃えること。
   */
  {
    tag: [
      tags.keyword,
      tags.controlKeyword,
      tags.definitionKeyword,
      tags.moduleKeyword,
      tags.operatorKeyword,
      tags.self,
      tags.atom,
      tags.bool,
      tags.null,
    ],
    color: "var(--code-keyword)",
  },
  {
    tag: [tags.string, tags.special(tags.string), tags.regexp, tags.escape],
    color: "var(--code-string)",
  },
  { tag: [tags.number, tags.integer, tags.float], color: "var(--code-number)" },
  {
    tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment],
    color: "var(--code-comment)",
    fontStyle: "italic",
  },
  {
    tag: [
      tags.function(tags.variableName),
      tags.function(tags.propertyName),
      tags.typeName,
      tags.className,
      tags.propertyName,
      tags.attributeName,
      tags.tagName,
      tags.namespace,
    ],
    color: "var(--code-entity)",
  },
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
  /*
   * 選択範囲。
   *
   * `!important` が要る。CodeMirror の base theme は
   * `&light.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground`
   * （class 5 個）で `#d7d4f0` を当てており、ここの規則（class 2 個）では負ける。
   * さらに base theme は EditorView.darkTheme を立てない限り常に `&light` 側なので、
   * Dark でも淡い紫が塗られ、Dark の明るい本文色と同化する。
   * 詳細度で並べるより `!important` の方が、あとから読んで意図が分かる。
   */
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "var(--selection) !important",
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
    /*
     * 入力ハンドラなので keymap の順序とは干渉しない。
     * 全角記号の置き換え（`fullWidthInput`）は設定で差し替わるので、ここではなく
     * Editor 側の Compartment にある。反応する文字が半角の `` ` `` と全角の `｀` で
     * 分かれているため、並び順は結果を変えない。
     */
    // ``` の閉じ補完。
    fenceInput,
    // 選択して URL を貼ると `[選択文字](URL)` にする。paste イベントなので keymap の順序とは干渉しない。
    linkPaste,
    history(),
    drawSelection(),
    highlightSpecialChars(),
    bracketMatching(),
    // codeLanguages は lazy import。fence に言語が書かれた時だけ読み込まれるので、
    // 起動時のバンドルには載らない（ADR-009）。
    markdown({ base: markdownLanguage, codeLanguages }),
    syntaxHighlighting(quietHighlight),
    /*
     * `searchKeymap` は丸ごとは入れない。`Mod-f` に `openSearchPanel` が入っており、
     * CodeMirror 標準の search panel が開いてしまう。
     * 検索は Find bar（U-025）と Search All（ADR-011）が担当で、標準 panel は使わない
     * （Design system から浮くため）。`Mod-f` は Shift 付きにも当たるので、
     * `Ctrl+Shift+F` でも同じ panel が出ていた。
     *
     * panel を開かない選択系のコマンドだけを残す。
     */
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      { key: "Mod-d", run: selectNextOccurrence, preventDefault: true },
      { key: "Mod-Shift-l", run: selectSelectionMatches },
      indentWithTab,
    ]),
  ];
}
