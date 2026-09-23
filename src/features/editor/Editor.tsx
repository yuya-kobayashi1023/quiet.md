/**
 * Editor（CodeMirror 6 / U-003）。
 *
 * 守るべき制約:
 * - Markdown の記号だけを控えめに色付ける（ui-spec.md §8）
 * - IME 入力で文字を落とさない（AC-C）
 * - **外から text を流し込み直さない。**カーソル・選択・スクロールが飛ぶ（U-008）
 * - 箇条書きの Enter / Tab / Shift+Tab は階層編集として扱う（list-keymap）
 * - 設定変更は Compartment で差し替える。EditorState を作り直さない
 * - Editor 内部に二重スクロールを作らない（ui-spec.md §6）
 *
 * 拡張の構成は `extensions.ts`。テストと同じものを使う。
 */

import { useEffect, useRef } from "react";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { redoDepth, undoDepth } from "@codemirror/commands";
import { indentUnit } from "@codemirror/language";
import { baseTheme, coreExtensions } from "./extensions";
import type { EditorContextTarget } from "./EditorContextMenu";
import { fullWidthInput } from "./fullwidth-input";
import { imagePaste, type ImageSaver } from "./image-paste";
import "./editor.css";

interface EditorProps {
  /** 初期値。以降このコンポーネントは外から text を受け取らない。 */
  initialText: string;
  /** 文書が切り替わったことを示す。これが変わったときだけ内容を差し替える。 */
  documentKey: string;
  fontSize: number;
  tabWidth: number;
  lineWrap: boolean;
  spellCheck: boolean;
  /** 全角の英数字と記号を IME 確定時に半角へ直す（ADR-022）。 */
  halfWidthAscii: boolean;
  /** 区切り記号（： ； ， ． ～）も半角にする。halfWidthAscii が false なら効かない。 */
  halfWidthSeparators: boolean;
  onChange: (text: string) => void;
  onCursorChange: (info: { line: number; column: number }) => void;
  onReady: (view: EditorView) => void;
  /** クリップボードの画像を保存して相対パスを返す。無ければ画像の貼り付けは既定のまま。 */
  onPasteImage?: ImageSaver;
  /** 本文の右クリック（ADR-025）。無ければ WebView の既定メニューのまま。 */
  onContextMenu?: (target: EditorContextTarget) => void;
}

export function Editor({
  initialText,
  documentKey,
  fontSize,
  tabWidth,
  lineWrap,
  spellCheck,
  halfWidthAscii,
  halfWidthSeparators,
  onChange,
  onCursorChange,
  onReady,
  onPasteImage,
  onContextMenu,
}: EditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);

  // 設定ごとに Compartment を持ち、再構成で差し替える。
  const wrapCompartment = useRef(new Compartment());
  const tabCompartment = useRef(new Compartment());
  const fontCompartment = useRef(new Compartment());
  const halfWidthCompartment = useRef(new Compartment());

  // 最新の callback を ref 経由で参照する。
  // これらの変化で Editor を作り直すと、そのたびにカーソルが飛ぶ（U-008）。
  const callbacks = useRef({ onChange, onCursorChange, onReady, onPasteImage, onContextMenu });
  callbacks.current = { onChange, onCursorChange, onReady, onPasteImage, onContextMenu };
  const initial = useRef({
    initialText,
    fontSize,
    tabWidth,
    lineWrap,
    spellCheck,
    halfWidthAscii,
    halfWidthSeparators,
  });
  initial.current = {
    initialText,
    fontSize,
    tabWidth,
    lineWrap,
    spellCheck,
    halfWidthAscii,
    halfWidthSeparators,
  };

  useEffect(() => {
    const parent = host.current;
    if (!parent) return;
    const settings = initial.current;

    const extensions: Extension[] = [
      ...coreExtensions(),
      // 全角記号の置き換え。設定で差し替わるので coreExtensions には入れない。
      halfWidthCompartment.current.of(
        fullWidthInput({
          ascii: settings.halfWidthAscii,
          separators: settings.halfWidthSeparators,
        }),
      ),
      // アプリ側の saver が要るので coreExtensions には入れない。
      imagePaste(() => callbacks.current.onPasteImage),
      EditorView.domEventHandlers({
        contextmenu: (event, view) => {
          const handler = callbacks.current.onContextMenu;
          if (!handler) return false;
          event.preventDefault();

          // 選択の外を押したらそこへカーソルを移す。項目の対象を見た目と合わせる（ADR-025 §3）。
          const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
          const before = view.state.selection.main;
          if (pos != null && (pos < before.from || pos > before.to)) {
            view.dispatch({ selection: { anchor: pos } });
          }

          const selection = view.state.selection.main;
          handler({
            position: { x: event.clientX, y: event.clientY },
            selected: view.state.sliceDoc(selection.from, selection.to),
            canUndo: undoDepth(view.state) > 0,
            canRedo: redoDepth(view.state) > 0,
          });
          return true;
        },
      }),
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

  useEffect(() => {
    view.current?.dispatch({
      effects: halfWidthCompartment.current.reconfigure(
        fullWidthInput({ ascii: halfWidthAscii, separators: halfWidthSeparators }),
      ),
    });
  }, [halfWidthAscii, halfWidthSeparators]);

  return <div className="editor-host" ref={host} />;
}
