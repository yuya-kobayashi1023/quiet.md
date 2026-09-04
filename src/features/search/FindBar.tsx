/**
 * Find in document（U-025）。
 *
 * - Editor pane の右上に、開いている間だけ存在する
 * - Esc で閉じる
 * - Replace は MVP 外。ただし後続で足す前提でレイアウトを確保しておく
 * - Command Palette とは別物（Ctrl+K はコマンド、Ctrl+F は現在文書）
 *
 * CodeMirror の標準 search panel は使わない。Design system から浮くため。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";
import { EditorSelection } from "@codemirror/state";
import { ArrowDownIcon, ArrowUpIcon, CloseIcon } from "@/ui/components/icons";
import "./find.css";

interface FindBarProps {
  view: EditorView | null;
  onClose: () => void;
}

interface Match {
  from: number;
  to: number;
}

function findMatches(text: string, query: string, caseSensitive: boolean): Match[] {
  if (!query) return [];
  const haystack = caseSensitive ? text : text.toLowerCase();
  const needle = caseSensitive ? query : query.toLowerCase();
  const matches: Match[] = [];
  let index = haystack.indexOf(needle);
  while (index !== -1 && matches.length < 5000) {
    matches.push({ from: index, to: index + needle.length });
    index = haystack.indexOf(needle, index + Math.max(1, needle.length));
  }
  return matches;
}

export function FindBar({ view, onClose }: FindBarProps) {
  const [query, setQuery] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [current, setCurrent] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const text = view?.state.doc.toString() ?? "";
  const matches = useMemo(
    () => findMatches(text, query, caseSensitive),
    [text, query, caseSensitive],
  );

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    setCurrent(0);
  }, [query, caseSensitive]);

  const goTo = useCallback(
    (index: number) => {
      const match = matches[index];
      if (!match || !view) return;
      view.dispatch({
        selection: EditorSelection.single(match.from, match.to),
        scrollIntoView: true,
      });
    },
    [matches, view],
  );

  useEffect(() => {
    if (matches.length > 0) goTo(current);
  }, [current, matches, goTo]);

  const step = (delta: number) => {
    if (matches.length === 0) return;
    setCurrent((prev) => (prev + delta + matches.length) % matches.length);
  };

  return (
    <div className="find-bar" role="search">
      <input
        ref={inputRef}
        className="find-input"
        placeholder="この文書内を検索"
        aria-label="この文書内を検索"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          } else if (e.key === "Enter") {
            e.preventDefault();
            step(e.shiftKey ? -1 : 1);
          }
        }}
      />

      <span className="find-count" aria-live="polite">
        {query ? (matches.length === 0 ? "0件" : `${current + 1}/${matches.length}`) : ""}
      </span>

      <button
        type="button"
        className="find-btn"
        aria-label="前へ"
        title="前へ (Shift+Enter)"
        onClick={() => step(-1)}
      >
        <ArrowUpIcon />
      </button>
      <button
        type="button"
        className="find-btn"
        aria-label="次へ"
        title="次へ (Enter)"
        onClick={() => step(1)}
      >
        <ArrowDownIcon />
      </button>
      <button
        type="button"
        className={`find-btn find-toggle${caseSensitive ? " is-active" : ""}`}
        aria-pressed={caseSensitive}
        aria-label="大文字と小文字を区別"
        title="大文字と小文字を区別"
        onClick={() => setCaseSensitive((v) => !v)}
      >
        Aa
      </button>
      <button type="button" className="find-btn" aria-label="閉じる" onClick={onClose}>
        <CloseIcon />
      </button>
    </div>
  );
}
