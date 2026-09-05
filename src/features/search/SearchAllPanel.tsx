/**
 * Search All — Workspace 全体の全文検索（U-013 / ADR-011）。
 *
 * `Ctrl+Shift+F` で開く。Command palette（Ctrl+K、ファイル名）と
 * Find bar（Ctrl+F、現在の文書）とは別物で、探すのは**本文**。
 *
 * 常設 UI は増やさない（AGENTS.md §4）。開いている間だけ存在する overlay とする。
 *
 * - Archive は既定で含める。トグルで外せる
 * - 検索は Rust 側で走る。ここは入力の debounce と結果の描画だけ
 * - 行き先へ飛ぶときは、Front Matter の行数を差し引いて Editor の行へ直す
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SearchFileResult, SearchMatch, SearchResults } from "@/domain/document/types";
import * as native from "@/services/native-bridge";
import { NativeError } from "@/domain/document/errors";
import { ArchiveIcon, FileIcon } from "@/ui/components/icons";
import "./search-all.css";

/** 1 文字での検索は Workspace 全体を舐めるだけで役に立たない。 */
const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 220;

export interface SearchHit {
  path: string;
  /** ファイル先頭からの行番号（1 始まり）。Front Matter を含む。 */
  line: number;
  /** 行頭からの位置（1 始まり、UTF-16 code unit）。 */
  column: number;
  length: number;
}

interface SearchAllPanelProps {
  hasWorkspace: boolean;
  includeArchived: boolean;
  onIncludeArchivedChange: (value: boolean) => void;
  onOpenHit: (hit: SearchHit) => void;
  onClose: () => void;
}

/** preview を「一致の前 / 一致 / 一致の後」に割る。 */
function splitPreview(match: SearchMatch): [string, string, string] {
  const start = Math.max(0, Math.min(match.previewColumn, match.preview.length));
  const end = Math.min(start + match.length, match.preview.length);
  return [
    match.preview.slice(0, start),
    match.preview.slice(start, end),
    match.preview.slice(end),
  ];
}

function FileGroup({
  file,
  activeKey,
  onHover,
  onOpen,
}: {
  file: SearchFileResult;
  activeKey: string | null;
  onHover: (key: string) => void;
  onOpen: (path: string, match: SearchMatch) => void;
}) {
  const hidden = file.matchCount - file.matches.length;

  return (
    <section className="search-group">
      <header className="search-group-head">
        <FileIcon className="search-group-icon" />
        <span className="search-group-name">{file.document.filename}</span>
        <span className="search-group-path">{file.document.relativePath}</span>
        {file.archived ? (
          <ArchiveIcon className="search-group-archived" aria-label="アーカイブ済み" />
        ) : null}
        <span className="search-group-count">{file.matchCount}</span>
      </header>

      {file.matches.map((match) => {
        const key = `${file.document.path}:${match.line}:${match.column}`;
        const [before, hit, after] = splitPreview(match);
        return (
          <button
            key={key}
            type="button"
            data-key={key}
            className={`search-hit${key === activeKey ? " is-active" : ""}`}
            onMouseEnter={() => onHover(key)}
            onClick={() => onOpen(file.document.path, match)}
          >
            <span className="search-hit-line">{match.line}</span>
            <span className="search-hit-preview">
              {match.previewTruncatedStart ? <span className="search-ellipsis">…</span> : null}
              {before}
              <mark>{hit}</mark>
              {after}
              {match.previewTruncatedEnd ? <span className="search-ellipsis">…</span> : null}
            </span>
          </button>
        );
      })}

      {hidden > 0 ? (
        <p className="search-group-more">ほか {hidden} 件（この文書では表示を省略）</p>
      ) : null}
    </section>
  );
}

export function SearchAllPanel({
  hasWorkspace,
  includeArchived,
  onIncludeArchivedChange,
  onOpenHit,
  onClose,
}: SearchAllPanelProps) {
  const [query, setQuery] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  /** 遅れて返ってきた古い検索結果で新しい結果を上書きしないための番号。 */
  const runId = useRef(0);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!hasWorkspace || trimmed.length < MIN_QUERY_LENGTH) {
      setResults(null);
      setError(null);
      setRunning(false);
      return;
    }

    const id = ++runId.current;
    setRunning(true);
    const timer = setTimeout(() => {
      void native
        .searchWorkspace({ query: trimmed, includeArchived, caseSensitive })
        .then((next) => {
          if (runId.current !== id) return;
          setResults(next);
          setError(null);
        })
        .catch((e: unknown) => {
          if (runId.current !== id) return;
          setResults(null);
          setError(e instanceof NativeError ? e.message : "検索に失敗しました");
        })
        .finally(() => {
          if (runId.current === id) setRunning(false);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, includeArchived, caseSensitive, hasWorkspace]);

  /** キーボード移動のために、全ヒットを 1 本の並びとして持つ。 */
  const flat = useMemo(() => {
    const rows: { key: string; path: string; match: SearchMatch }[] = [];
    for (const file of results?.files ?? []) {
      for (const match of file.matches) {
        rows.push({
          key: `${file.document.path}:${match.line}:${match.column}`,
          path: file.document.path,
          match,
        });
      }
    }
    return rows;
  }, [results]);

  useEffect(() => {
    setActiveKey(flat[0]?.key ?? null);
  }, [flat]);

  useEffect(() => {
    if (!activeKey) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-key="${CSS.escape(activeKey)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeKey]);

  const open = useCallback(
    (path: string, match: SearchMatch) => {
      onClose();
      onOpenHit({ path, line: match.line, column: match.column, length: match.length });
    },
    [onClose, onOpenHit],
  );

  const step = (delta: number) => {
    if (flat.length === 0) return;
    const at = flat.findIndex((row) => row.key === activeKey);
    const next = Math.min(flat.length - 1, Math.max(0, (at === -1 ? 0 : at) + delta));
    setActiveKey(flat[next]!.key);
  };

  const trimmed = query.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < MIN_QUERY_LENGTH;

  return (
    <div
      className="search-all-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="search-all"
        role="dialog"
        aria-modal="true"
        aria-label="ワークスペース内を検索"
      >
        <div className="search-all-head">
          <input
            ref={inputRef}
            className="search-all-input"
            placeholder="ワークスペース内の本文を検索"
            aria-label="ワークスペース内の本文を検索"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                step(1);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                step(-1);
              } else if (e.key === "Enter") {
                e.preventDefault();
                const row = flat.find((r) => r.key === activeKey);
                if (row) open(row.path, row.match);
              }
            }}
          />

          <button
            type="button"
            className={`search-all-toggle${caseSensitive ? " is-active" : ""}`}
            aria-pressed={caseSensitive}
            title="大文字と小文字を区別"
            onClick={() => setCaseSensitive((v) => !v)}
          >
            Aa
          </button>

          {/* Archive を含めるかは Search All 固有の設定。Settings へは出さない。 */}
          <label className="search-all-check">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => onIncludeArchivedChange(e.target.checked)}
            />
            アーカイブを含む
          </label>
        </div>

        <div className="search-all-status" aria-live="polite">
          {!hasWorkspace
            ? "先に Workspace を開いてください"
            : error
              ? error
              : tooShort
                ? `${MIN_QUERY_LENGTH} 文字以上で検索します`
                : running
                  ? "検索中…"
                  : results
                    ? results.totalMatches === 0
                      ? `一致なし（${results.scannedFiles} 文書を検索）`
                      : `${results.totalMatches} 件 / ${results.files.length} 文書${
                          results.truncated ? "（上限に達したため一部のみ）" : ""
                        }`
                    : ""}
        </div>

        <div className="search-all-list" ref={listRef}>
          {(results?.files ?? []).map((file) => (
            <FileGroup
              key={file.document.path}
              file={file}
              activeKey={activeKey}
              onHover={setActiveKey}
              onOpen={open}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
