/**
 * Preview。
 *
 * ui-spec.md §11:
 * - `PREVIEW` ラベルを置かない
 * - Front Matter は Raw YAML ではなく意味を圧縮して出す
 * - Table は横幅超過時だけ横スクロール。縦の入れ子スクロールを作らない
 *
 * U-020: 本文の `#` は H1 のまま。先頭のタイトルは画面の chrome であり、
 * 文書の見出しではない（書き出し時も見出し構造に含めない）。
 */

import { useCallback, useMemo, useRef } from "react";
import { COPY_BUTTON_CLASS, renderMarkdown, TASK_LINE_ATTR } from "@/domain/document/markdown";
import type { FrontmatterFields } from "@/domain/document/frontmatter";
import * as native from "@/services/native-bridge";
import "./preview.css";

interface PreviewProps {
  title: string;
  body: string;
  fields: FrontmatterFields;
  baseDir: string;
  typeface: "serif" | "sans";
  /** コードブロックにコピーボタンを出す。画面の Preview だけ true。紙面（PrintSheet）は渡さない。 */
  copyButtons?: boolean;
  onOpenDocument: (relativeHref: string) => void;
  /** タスクのチェックボックスがクリックされた。line は本文の行番号（1 始まり）。 */
  onToggleTask: (line: number) => void;
}

/** Check を見せておく長さ。principles.md §4「Copy → Copy アイコンを一時的に Check へ」。 */
const COPIED_MS = 1500;

/** 直前にコピーしたボタン。Check を戻す timer と一緒に持つ。 */
interface Copied {
  button: HTMLElement;
  timer: number;
}

const resolveAsset = native.assetUrl;

export function Preview({
  title,
  body,
  fields,
  baseDir,
  typeface,
  copyButtons = false,
  onOpenDocument,
  onToggleTask,
}: PreviewProps) {
  // React 19 は dangerouslySetInnerHTML のオブジェクトが別物なら文字列が同じでも innerHTML を
  // 入れ直す。本文が変わったときだけ DOM を作り直すよう、オブジェクトごと memo する。
  // 入れ直しが起きるとコピーボタンの Check（data-copied）が消える。
  const markup = useMemo(
    // sourceLines は Split の scroll 同期が使う行の対応表（ADR-012）。
    // 画面表示のためだけの印であり、書き出し HTML には付けない。
    () => ({
      __html: renderMarkdown(body, { baseDir, resolveAsset, sourceLines: true, copyButtons }).html,
    }),
    [body, baseDir, copyButtons],
  );

  // 本文が変わると DOM ごと作り直されるので、Check の状態は React ではなく DOM 属性に持つ。
  // 新しい DOM に data-copied は無く、それで正しい。
  const copied = useRef<Copied | null>(null);

  const copyCode = useCallback((button: HTMLElement) => {
    const code = button.parentElement?.querySelector("code");
    if (!code) return;
    // highlight は fence の最後の改行を残す。貼り付け先に空行を足さない。
    const text = (code.textContent ?? "").replace(/\n$/, "");
    void navigator.clipboard.writeText(text).catch(() => {});

    if (copied.current) {
      window.clearTimeout(copied.current.timer);
      delete copied.current.button.dataset.copied;
    }
    button.dataset.copied = "true";
    copied.current = {
      button,
      timer: window.setTimeout(() => {
        delete button.dataset.copied;
        copied.current = null;
      }, COPIED_MS),
    };
  }, []);

  /**
   * クリックを捌く。
   *
   * - タスクのチェックボックスは本文の `[ ]` を反転させる。preventDefault はしない。
   *   本文が変わると Preview が描き直されるので、DOM の checked は本文と一致する
   * - コードブロックのコピーボタンは本文をクリップボードへ写す
   * - リンクは WebView 内で遷移させない（U-023）
   */
  const onClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const target = event.target as HTMLElement;
      if (target instanceof HTMLInputElement && target.type === "checkbox") {
        const line = target.getAttribute(TASK_LINE_ATTR);
        if (line) onToggleTask(Number(line));
        return;
      }

      const button = target.closest<HTMLElement>(`button.${COPY_BUTTON_CLASS}`);
      if (button) {
        copyCode(button);
        return;
      }

      const anchor = target.closest("a");
      if (!anchor) return;
      event.preventDefault();

      const kind = anchor.getAttribute("data-link");
      const href = anchor.getAttribute("href") ?? "";

      if (kind === "external") {
        void native.openExternal(href).catch(() => {});
        return;
      }
      if (kind === "document") {
        onOpenDocument(href);
        return;
      }
      if (kind === "anchor") {
        const id = href.slice(1);
        const target = document.getElementById(id) ?? document.getElementById(`user-content-${id}`);
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      // blocked は何もしない。
    },
    [copyCode, onOpenDocument, onToggleTask],
  );

  const tags = fields.tags?.filter(Boolean) ?? [];
  const hasMeta = tags.length > 0 || fields.status || fields.created;

  return (
    <article className="preview" data-typeface={typeface} onClick={onClick}>
      {/* 紙面（print.css）はこの header の下に罫を引く。画面では素の block。 */}
      <header className="preview-header">
        <h1 className="preview-title">{title || "Untitled"}</h1>

        {hasMeta ? (
          <div className="preview-meta">
            {tags.length > 0 ? (
              <span className="preview-meta-tags">
                {tags.map((tag, i) => (
                  <span key={tag}>
                    {i > 0 ? <span className="preview-meta-dot">·</span> : null}
                    {tag}
                  </span>
                ))}
              </span>
            ) : null}
            {fields.status ? <span className="preview-meta-status">{fields.status}</span> : null}
            {fields.created ? (
              <span className="preview-meta-created">{fields.created}</span>
            ) : null}
          </div>
        ) : null}
      </header>

      {/* html は rehype-sanitize を通した後のもの（U-023）。 */}
      <div className="preview-body" dangerouslySetInnerHTML={markup} />
    </article>
  );
}
