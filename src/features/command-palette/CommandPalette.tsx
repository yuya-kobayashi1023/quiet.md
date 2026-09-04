/**
 * Command Palette / Quick Open。
 *
 * interactions.md §10: `Ctrl+K` で開く。Esc で閉じる。
 * requirements.md §3.5: Prototype は見た目サンプルだったが、Production では
 * 実際の検索とコマンド実行を接続する。
 *
 * Quick Open（`Ctrl+P`）とコマンドは 1 つの入口に統合している。
 * `>` で始めるとコマンドだけに絞る。
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { DocumentSummary } from "@/domain/document/types";
import "./palette.css";

export interface Command {
  id: string;
  label: string;
  shortcut?: string;
  run: () => void;
}

interface PaletteProps {
  commands: Command[];
  documents: DocumentSummary[];
  onOpenDocument: (doc: DocumentSummary) => void;
  onClose: () => void;
}

type Row =
  | { kind: "command"; command: Command }
  | { kind: "document"; document: DocumentSummary };

/** 部分一致で十分。文字が順に現れるかを見る簡易 fuzzy。 */
function matches(query: string, text: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return true;
  let i = 0;
  for (const char of t) {
    if (char === q[i]) i++;
    if (i === q.length) return true;
  }
  return false;
}

export function CommandPalette({
  commands,
  documents,
  onOpenDocument,
  onClose,
}: PaletteProps) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const rows: Row[] = useMemo(() => {
    const commandMode = query.startsWith(">");
    const q = commandMode ? query.slice(1).trim() : query.trim();

    const commandRows: Row[] = commands
      .filter((c) => matches(q, c.label))
      .map((command) => ({ kind: "command", command }));

    if (commandMode) return commandRows;

    const documentRows: Row[] = documents
      .filter((d) => matches(q, d.relativePath))
      .slice(0, 50)
      .map((document) => ({ kind: "document", document }));

    // 入力がないときはコマンドを先に、入力があればファイルを先に出す。
    return q ? [...documentRows, ...commandRows] : [...commandRows, ...documentRows];
  }, [commands, documents, query]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${index}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [index]);

  const run = (row: Row | undefined) => {
    if (!row) return;
    onClose();
    if (row.kind === "command") row.command.run();
    else onOpenDocument(row.document);
  };

  return (
    <div
      className="palette-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="palette" role="dialog" aria-modal="true" aria-label="コマンドパレット">
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="ファイル名で検索、または > でコマンド"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndex((i) => Math.min(i + 1, rows.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              run(rows[index]);
            }
          }}
        />

        <div className="palette-list" ref={listRef} role="listbox">
          {rows.length === 0 ? (
            <p className="palette-empty">一致するものがありません</p>
          ) : (
            rows.map((row, i) => (
              <button
                key={row.kind === "command" ? row.command.id : row.document.path}
                type="button"
                role="option"
                aria-selected={i === index}
                data-index={i}
                className={`palette-row${i === index ? " is-active" : ""}`}
                onMouseEnter={() => setIndex(i)}
                onClick={() => run(row)}
              >
                <span className="palette-label">
                  {row.kind === "command" ? row.command.label : row.document.filename}
                </span>
                {row.kind === "command" ? (
                  row.command.shortcut ? (
                    <kbd>{row.command.shortcut}</kbd>
                  ) : null
                ) : (
                  <span className="palette-hint">{row.document.relativePath}</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
