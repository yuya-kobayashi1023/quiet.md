/**
 * Split の scroll 同期（ADR-012）。
 *
 * 割合合わせはしない。Preview 側の `data-source-line`（ADR-012 / markdown.ts）と
 * CodeMirror の行ジオメトリから対応表を作り、その間を補間する。
 * コードブロック・表・画像のように「1 行が高い」要素があってもずれないのはこのため。
 *
 * 計算そのものは `scroll-map.ts`。ここは DOM の採寸と、片方向ずつの駆動だけを持つ。
 *
 * 気をつけていること:
 * - **無限ループを作らない。** 片方を動かすともう片方の scroll が飛ぶので、
 *   駆動側を短時間ロックする
 * - 採寸は scroll のたびに行わない。内容・サイズが変わったときだけ作り直す
 * - `smooth` を使わない。追従が遅れて「引きずられる」感じになる
 */

import { useEffect, useRef, type RefObject } from "react";
import type { EditorView } from "@codemirror/view";
import { lineForTop, normalizeAnchors, topForLine, type Anchor } from "./scroll-map";

/** 画面上端ではなく、少し内側の行を基準にする。上端の行は視界に入りにくい。 */
const FOCUS_OFFSET = 72;
/** 駆動側のロックを解くまでの時間。慣性スクロールの余韻より少しだけ長く取る。 */
const RELEASE_MS = 140;

interface Options {
  editorPane: RefObject<HTMLDivElement | null>;
  previewPane: RefObject<HTMLDivElement | null>;
  editorView: RefObject<EditorView | null>;
  /** 有効なとき（Split かつ設定が ON）だけ購読する。 */
  enabled: boolean;
  /** これが変わったら対応表を作り直す。 */
  revision: unknown;
}

/**
 * Preview の `data-source-line` から対応表を作る。
 *
 * `line: 0` を先頭に置く。Preview には Title と Metadata が本文より上にあり、
 * これが無いと 1 行目でいきなり本文の先頭まで飛ぶ。
 * Editor 側にも同じ `line: 0` を置いて、両者の起点を揃える。
 */
function previewAnchors(pane: HTMLElement, lastLine: number): Anchor[] {
  const paneTop = pane.getBoundingClientRect().top - pane.scrollTop;
  const anchors: Anchor[] = [{ line: 0, top: 0 }];
  let lastBottom: number | null = null;

  for (const el of pane.querySelectorAll<HTMLElement>("[data-source-line]")) {
    const line = Number(el.dataset.sourceLine);
    if (!Number.isFinite(line)) continue;
    const rect = el.getBoundingClientRect();
    anchors.push({ line, top: rect.top - paneTop });
    lastBottom = rect.bottom - paneTop;
  }

  // 末尾。最後の要素の下端を「本文の終わり」に対応させる。
  if (lastBottom != null) anchors.push({ line: lastLine + 1, top: lastBottom });

  return normalizeAnchors(anchors);
}

/**
 * Editor 側の対応表を、Preview と**同じ行**について作る。
 *
 * 全行ぶん作らないのは、その必要がないから。両者が同じ行集合を持てば
 * 対応点そのものでのずれが 0 になり、間は同じ補間で埋まる。
 * 採寸は編集のたびに走るので、行数に比例させたくないという理由もある。
 */
function editorAnchors(pane: HTMLElement, view: EditorView, lines: number[]): Anchor[] {
  const paneTop = pane.getBoundingClientRect().top - pane.scrollTop;
  // contentDOM の先頭 = 文書の先頭。lineBlockAt の top はここからの距離。
  const contentTop = view.contentDOM.getBoundingClientRect().top - paneTop;
  const doc = view.state.doc;

  const anchors: Anchor[] = [];
  for (const line of lines) {
    if (line <= 0) {
      // Editor 側の起点は pane の先頭（Metadata と Title を含む）。
      anchors.push({ line: 0, top: 0 });
      continue;
    }
    if (line > doc.lines) {
      const last = view.lineBlockAt(doc.line(doc.lines).from);
      anchors.push({ line, top: contentTop + last.bottom });
      continue;
    }
    const block = view.lineBlockAt(doc.line(line).from);
    anchors.push({ line, top: contentTop + block.top });
  }

  return normalizeAnchors(anchors);
}

export function useSyncScroll({
  editorPane,
  previewPane,
  editorView,
  enabled,
  revision,
}: Options): void {
  /** 今どちらが動かしているか。null なら誰でも掴める。 */
  const driver = useRef<"editor" | "preview" | null>(null);
  const release = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frame = useRef<number | null>(null);
  const maps = useRef<{ editor: Anchor[]; preview: Anchor[] }>({
    editor: [],
    preview: [],
  });

  useEffect(() => {
    const editor = editorPane.current;
    const preview = previewPane.current;
    if (!enabled || !editor || !preview) return;

    const measure = () => {
      const view = editorView.current;
      if (!view) {
        maps.current = { editor: [], preview: [] };
        return;
      }
      const previewMap = previewAnchors(preview, view.state.doc.lines);
      maps.current = {
        preview: previewMap,
        editor: editorAnchors(editor, view, previewMap.map((a) => a.line)),
      };
    };

    // 採寸は getBoundingClientRect を並べるので layout を強制する。
    // 編集のたびに同期呼びすると入力が重くなるため、1 フレームにまとめる。
    let measureFrame: number | null = null;
    const scheduleMeasure = () => {
      if (measureFrame != null) return;
      measureFrame = requestAnimationFrame(() => {
        measureFrame = null;
        measure();
      });
    };

    /** `from` の位置に合わせて `to` を動かす。 */
    const sync = (who: "editor" | "preview") => {
      const { editor: editorMap, preview: previewMap } = maps.current;
      if (editorMap.length === 0 || previewMap.length === 0) return;

      const [from, to, fromMap, toMap] =
        who === "editor"
          ? ([editor, preview, editorMap, previewMap] as const)
          : ([preview, editor, previewMap, editorMap] as const);

      const line = lineForTop(fromMap, from.scrollTop + FOCUS_OFFSET);
      const next = topForLine(toMap, line) - FOCUS_OFFSET;
      const clamped = Math.max(0, Math.min(next, to.scrollHeight - to.clientHeight));

      // 1px 未満の差で動かさない。往復のがたつきになる。
      if (Math.abs(to.scrollTop - clamped) < 1) return;
      to.scrollTop = clamped;
    };

    const onScroll = (who: "editor" | "preview") => () => {
      // 相手が動かしている最中の scroll は、こちらが起こした結果なので無視する。
      if (driver.current && driver.current !== who) return;
      driver.current = who;
      if (release.current) clearTimeout(release.current);
      release.current = setTimeout(() => {
        driver.current = null;
      }, RELEASE_MS);

      // 1 フレームに 1 回だけ動かす。
      if (frame.current != null) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        sync(who);
      });
    };

    const onEditorScroll = onScroll("editor");
    const onPreviewScroll = onScroll("preview");

    // 内容と寸法の変化で採寸し直す。scroll のたびには測らない。
    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(editor);
    observer.observe(preview);
    const mutation = new MutationObserver(scheduleMeasure);
    mutation.observe(preview, { childList: true, subtree: true, characterData: true });

    // 画像は遅れて読み込まれ、そのぶん Preview の高さが変わる。
    const onLoad = (e: Event) => {
      if ((e.target as HTMLElement | null)?.tagName === "IMG") scheduleMeasure();
    };
    preview.addEventListener("load", onLoad, true);

    editor.addEventListener("scroll", onEditorScroll, { passive: true });
    preview.addEventListener("scroll", onPreviewScroll, { passive: true });
    measure();

    return () => {
      editor.removeEventListener("scroll", onEditorScroll);
      preview.removeEventListener("scroll", onPreviewScroll);
      preview.removeEventListener("load", onLoad, true);
      observer.disconnect();
      mutation.disconnect();
      if (release.current) clearTimeout(release.current);
      if (frame.current != null) cancelAnimationFrame(frame.current);
      if (measureFrame != null) cancelAnimationFrame(measureFrame);
      release.current = null;
      frame.current = null;
      driver.current = null;
    };
  }, [enabled, revision, editorPane, previewPane, editorView]);
}
