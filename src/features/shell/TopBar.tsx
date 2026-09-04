/**
 * Top bar。
 *
 * ui-spec.md §4 / §5 / §6:
 * - Tabs は禁止。左は Breadcrumb（現在位置を示すだけ）
 * - 中央寄りに Write / Split / Read
 * - 右に TOC / Command palette / More
 */

import type { ViewMode } from "@/services/settings-service";
import { ContentsIcon, MoreIcon, SearchIcon } from "@/ui/components/icons";
import "./shell.css";

interface TopBarProps {
  breadcrumb: string[];
  viewMode: ViewMode;
  tocOpen: boolean;
  onViewMode: (mode: ViewMode) => void;
  onToggleToc: () => void;
  onOpenPalette: () => void;
  onMore: (position: { x: number; y: number }) => void;
  children?: React.ReactNode;
}

const MODES: { value: ViewMode; label: string; shortcut: string }[] = [
  { value: "write", label: "Write", shortcut: "Ctrl+1" },
  { value: "split", label: "Split", shortcut: "Ctrl+2" },
  { value: "read", label: "Read", shortcut: "Ctrl+3" },
];

export function TopBar({
  breadcrumb,
  viewMode,
  tocOpen,
  onViewMode,
  onToggleToc,
  onOpenPalette,
  onMore,
  children,
}: TopBarProps) {
  return (
    <header className="topbar">
      <nav className="breadcrumb" aria-label="現在位置">
        {breadcrumb.map((segment, index) => (
          <span key={`${segment}-${index}`}>
            {index > 0 ? <span className="breadcrumb-sep">/</span> : null}
            <span className={index === breadcrumb.length - 1 ? "breadcrumb-current" : ""}>
              {segment}
            </span>
          </span>
        ))}
      </nav>

      <div className="view-switch" role="tablist" aria-label="表示モード">
        {MODES.map((mode) => (
          <button
            key={mode.value}
            type="button"
            role="tab"
            aria-selected={viewMode === mode.value}
            className={viewMode === mode.value ? "is-active" : ""}
            title={`${mode.label} (${mode.shortcut})`}
            onClick={() => onViewMode(mode.value)}
          >
            {mode.label}
          </button>
        ))}
      </div>

      <div className="top-actions">
        <div className="toc-control">
          <button
            type="button"
            className="icon-btn"
            aria-label="目次"
            aria-expanded={tocOpen}
            title="目次"
            onClick={onToggleToc}
          >
            <ContentsIcon />
          </button>
          {children}
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label="コマンドパレット"
          title="コマンドパレット (Ctrl+K)"
          onClick={onOpenPalette}
        >
          <SearchIcon />
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="その他"
          title="その他"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            onMore({ x: rect.right - 200, y: rect.bottom + 4 });
          }}
        >
          <MoreIcon />
        </button>
      </div>
    </header>
  );
}

/**
 * Status bar。
 *
 * ui-spec.md §12: 左は Ln / Col / 文字数、右は UTF-8 / Markdown / Spaces。
 * **保存済み状態は出さない**（ADR-003）。
 *
 * 改行コードを出すのは、保持していることをユーザーが確認できるようにするため。
 */
export function StatusBar({
  line,
  column,
  count,
  countMode,
  lineEnding,
  tabWidth,
  onToggleCountMode,
}: {
  line: number;
  column: number;
  count: number;
  countMode: "characters" | "words";
  lineEnding: "lf" | "crlf";
  tabWidth: number;
  onToggleCountMode: () => void;
}) {
  return (
    <footer className="statusbar">
      <div className="status-group">
        <span>
          Ln {line}, Col {column}
        </span>
        <button
          type="button"
          className="status-button"
          onClick={onToggleCountMode}
          title="文字数と語数を切り替える"
        >
          {countMode === "characters" ? `${count} 文字` : `${count} words`}
        </button>
      </div>
      <div className="status-group">
        <span>UTF-8</span>
        <span>{lineEnding === "crlf" ? "CRLF" : "LF"}</span>
        <span>Markdown</span>
        <span>Spaces: {tabWidth}</span>
      </div>
    </footer>
  );
}
