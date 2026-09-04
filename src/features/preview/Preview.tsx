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

import { useCallback, useMemo } from "react";
import { renderMarkdown } from "@/domain/document/markdown";
import type { FrontmatterFields } from "@/domain/document/frontmatter";
import * as native from "@/services/native-bridge";
import "./preview.css";

interface PreviewProps {
  title: string;
  body: string;
  fields: FrontmatterFields;
  baseDir: string;
  typeface: "serif" | "sans";
  onOpenDocument: (relativeHref: string) => void;
}

function resolveAsset(absolutePath: string): string {
  if (!native.isNative()) return absolutePath;
  // convertFileSrc は同期関数だが動的 import が必要なので、
  // Tauri が注入する global を直接使う。
  const convert = (
    window as unknown as { __TAURI__?: { core?: { convertFileSrc?: (p: string) => string } } }
  ).__TAURI__?.core?.convertFileSrc;
  return convert ? convert(absolutePath) : absolutePath;
}

export function Preview({
  title,
  body,
  fields,
  baseDir,
  typeface,
  onOpenDocument,
}: PreviewProps) {
  const { html } = useMemo(
    () => renderMarkdown(body, { baseDir, resolveAsset }),
    [body, baseDir],
  );

  /**
   * リンクのクリックを捌く（U-023）。
   * WebView 内で遷移させない。
   */
  const onClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const anchor = (event.target as HTMLElement).closest("a");
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
    [onOpenDocument],
  );

  const tags = fields.tags?.filter(Boolean) ?? [];
  const hasMeta = tags.length > 0 || fields.status || fields.created;

  return (
    <article className="preview" data-typeface={typeface} onClick={onClick}>
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
          {fields.status ? <span>{fields.status}</span> : null}
          {fields.created ? <span>{fields.created}</span> : null}
        </div>
      ) : null}

      {/* html は rehype-sanitize を通した後のもの（U-023）。 */}
      <div className="preview-body" dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}
