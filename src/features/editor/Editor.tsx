/**
 * Editor（CodeMirror 6 / U-003）。
 *
 * 守るべき制約:
 * - Markdown の記号だけを控えめに色付ける（ui-spec.md §8）
 * - IME 入力で文字を落とさない（AC-C）
 * - **外から text を流し込み直さない。**カーソル・選択・スクロールが飛ぶ（U-008）
 * - 設定変更は Compartment で差し替える。EditorState を作り直さない
 * - Editor 内部に二重スクロールを作らない（ui-spec.md §6）
 */

import { useEffect, useRef } from "react";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { drawSelection, EditorView, highlightSpecialChars, keymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import {
  bracketMatching,
  HighlightStyle,
  indentUnit,
  syntaxHighlighting,
} from "@codemirror/language";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { tags } from "@lezer/highlight";
import { searchKeymap } from "@codemirror/search";
import "./editor.css";

/**
 * Markdown の「意味を持つ記号」だけを色付ける。
 * 本文自体を多色にしない（ui-spec.md §8）。
 */
const quietHighlight = HighlightStyle.define([
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

const baseTheme = EditorView.theme({
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

interface EditorProps {
  /** 初期値。以降このコンポーネントは外から text を受け取らない。 */
  initialText: string;
  /** 文書が切り替わったことを示す。これが変わったときだけ内容を差し替える。 */
  documentKey: string;
  fontSize: number;
  tabWidth: number;
  lineWrap: boolean;
  spellCheck: boolean;
  onChange: (text: string) => void;
  onCursorChange: (info: { line: number; column: number }) => void;
  onReady: (view: EditorView) => void;
}

export function Editor({
  initialText,
  documentKey,
  fontSize,
  tabWidth,
  lineWrap,
  spellCheck,
  onChange,
  onCursorChange,
  onReady,
}: EditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);

  // 設定ごとに Compartment を持ち、再構成で差し替える。
  const wrapCompartment = useRef(new Compartment());
  const tabCompartment = useRef(new Compartment());
  const fontCompartment = useRef(new Compartment());

  // 最新の callback を ref 経由で参照する。
  // これらの変化で Editor を作り直すと、そのたびにカーソルが飛ぶ（U-008）。
  const callbacks = useRef({ onChange, onCursorChange, onReady });
  callbacks.current = { onChange, onCursorChange, onReady };
  const initial = useRef({ initialText, fontSize, tabWidth, lineWrap, spellCheck });
  initial.current = { initialText, fontSize, tabWidth, lineWrap, spellCheck };

  useEffect(() => {
    const parent = host.current;
    if (!parent) return;
    const settings = initial.current;

    const extensions: Extension[] = [
      history(),
      drawSelection(),
      highlightSpecialChars(),
      bracketMatching(),
      markdown({ base: markdownLanguage, codeLanguages: [] }),
      syntaxHighlighting(quietHighlight),
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
      baseTheme,
      wrapCompartment.current.of(settings.lineWrap ? EditorView.lineWrapping : []),
      tabCompartment.current.of([
        EditorState.tabSize.of(settings.tabWidth),
        indentUnit.of(" ".repeat(settings.tabWidth)),
      ]),
      fontCompartment.current.of(
        EditorView.theme({ "&": { fontSize: `${settings.fontSize}px` } }),
      ),
      EditorView.contentAttributes.of({
        spellcheck: String(settings.spellCheck),
        "aria-label": "Markdown エディタ",
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          callbacks.current.onChange(update.state.doc.toString());
        }
        if (update.selectionSet || update.docChanged) {
          const head = update.state.selection.main.head;
          const line = update.state.doc.lineAt(head);
          callbacks.current.onCursorChange({
            line: line.number,
            column: head - line.from + 1,
          });
        }
      }),
    ];

    const instance = new EditorView({
      state: EditorState.create({ doc: settings.initialText, extensions }),
      parent,
    });
    view.current = instance;
    callbacks.current.onReady(instance);

    return () => {
      instance.destroy();
      view.current = null;
    };
    // documentKey が変わったときだけ作り直す。text や設定の変化では作り直さない。
  }, [documentKey]);

  // 設定の反映。dispatch による再構成なので、カーソルと履歴は保たれる。
  useEffect(() => {
    view.current?.dispatch({
      effects: wrapCompartment.current.reconfigure(lineWrap ? EditorView.lineWrapping : []),
    });
  }, [lineWrap]);

  useEffect(() => {
    view.current?.dispatch({
      effects: tabCompartment.current.reconfigure([
        EditorState.tabSize.of(tabWidth),
        indentUnit.of(" ".repeat(tabWidth)),
      ]),
    });
  }, [tabWidth]);

  useEffect(() => {
    view.current?.dispatch({
      effects: fontCompartment.current.reconfigure(
        EditorView.theme({ "&": { fontSize: `${fontSize}px` } }),
      ),
    });
  }, [fontSize]);

  useEffect(() => {
    const content = view.current?.contentDOM;
    if (content) content.spellcheck = spellCheck;
  }, [spellCheck]);

  return <div className="editor-host" ref={host} />;
}
