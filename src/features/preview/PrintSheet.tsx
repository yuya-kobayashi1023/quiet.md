/**
 * PDF 書き出しのための紙面（ADR-021）。
 *
 * Native の `export_pdf` は Window 全体を印刷する。Sidebar / TopBar / Editor を
 * 紙面から外して Preview だけを載せるために、書き出しの間だけこの要素を
 * body 直下へ置き、`print.css` の `@media print` で他を隠す。
 *
 * 紙面は常に Light。`data-theme="light"` で tokens.css の Light 値を
 * この subtree に再適用する。
 */

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { FrontmatterFields } from "@/domain/document/frontmatter";
import * as native from "@/services/native-bridge";
import { Preview } from "./Preview";
import "./print.css";

export interface PrintSheetProps {
  /** 書き出し先。Save dialog で決めた絶対パス。 */
  path: string;
  title: string;
  body: string;
  fields: FrontmatterFields;
  baseDir: string;
  typeface: "serif" | "sans";
  /** 完了で呼ぶ。失敗なら error に例外が入り、成功なら null。 */
  onDone: (path: string, error: unknown) => void;
}

export function PrintSheet({ path, title, body, fields, baseDir, typeface, onDone }: PrintSheetProps) {
  const sheet = useRef<HTMLDivElement>(null);
  // StrictMode は effect を 2 度走らせるが、印刷は 1 度でよい。
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
      // 画像が読み込まれる前に印刷すると空の枠だけが紙面に残る。
      const images = Array.from(sheet.current?.querySelectorAll("img") ?? []);
      await Promise.all(images.map((img) => img.decode().catch(() => {})));
      try {
        await native.exportPdf(path);
        onDone(path, null);
      } catch (error) {
        onDone(path, error);
      }
    })();
    // 書き出しは mount 時の内容で 1 度だけ行う。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div className="print-sheet" data-theme="light" ref={sheet} aria-hidden="true">
      <Preview
        title={title}
        body={body}
        fields={fields}
        baseDir={baseDir}
        typeface={typeface}
        onOpenDocument={() => {}}
      />
    </div>,
    document.body,
  );
}
