/**
 * Sidebar。
 *
 * .specs/ui/ui-spec.md §2 / §3、ADR-006、U-024。
 *
 * 禁止（§2）: `FILES` 見出し / Logo placeholder / footer の件数表示 /
 * Settings 上の強い divider / `Saved` 文字列。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { DocumentSummary, SaveState } from "@/domain/document/types";
import type { RecentFile } from "@/domain/document/recents";
import { buildTree, type TreeRow } from "@/services/workspace-service";
import {
  ArchiveIcon,
  ChevronIcon,
  FileIcon,
  FolderIcon,
  PlusIcon,
  SettingsIcon,
  SidebarIcon,
} from "@/ui/components/icons";
import { Tooltip, useTruncationTooltip } from "@/ui/components/Tooltip";
import "./sidebar.css";

interface SidebarProps {
  documents: DocumentSummary[];
  /** Workspace 外で開いたファイル（ADR-013）。表示件数で絞ったもの。 */
  recents: RecentFile[];
  archived: string[];
  expandedFolders: string[];
  activePath: string | null;
  saveState: SaveState;
  collapsed: boolean;
  compact: boolean;
  onToggleCollapsed: () => void;
  onSelect: (doc: DocumentSummary) => void;
  onNewNote: () => void;
  onToggleFolder: (path: string) => void;
  onOpenSettings: () => void;
  onContextMenu: (doc: DocumentSummary, position: { x: number; y: number }) => void;
  onSelectRecent: (file: RecentFile) => void;
  onRecentContextMenu: (file: RecentFile, position: { x: number; y: number }) => void;
}

/** Dirty dot。clean のときは何も出さない（ADR-003）。 */
function SaveDot({ state }: { state: SaveState }) {
  if (state === "clean") return null;
  const isProblem = state === "save_error" || state === "conflict" || state === "missing";
  return (
    <span
      className={`save-dot${isProblem ? " save-dot--problem" : ""}`}
      role="img"
      aria-label={isProblem ? "保存に問題があります" : "未保存の変更があります"}
    />
  );
}

function FileRow({
  row,
  active,
  saveState,
  onSelect,
  onContextMenu,
}: {
  row: Extract<TreeRow, { kind: "file" }>;
  active: boolean;
  saveState: SaveState;
  onSelect: (doc: DocumentSummary) => void;
  onContextMenu: SidebarProps["onContextMenu"];
}) {
  const { ref, tooltip, handlers } = useTruncationTooltip(row.document.filename);

  return (
    <>
      <button
        type="button"
        className={`tree-row tree-row--file${active ? " is-active" : ""}`}
        style={{ paddingLeft: `${8 + row.depth * 13}px` }}
        aria-current={active ? "true" : undefined}
        onClick={() => onSelect(row.document)}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu(row.document, { x: e.clientX, y: e.clientY });
        }}
        {...handlers}
      >
        <FileIcon className="tree-icon" />
        <span className="tree-label" ref={ref}>
          {row.document.filename}
        </span>
        {active ? <SaveDot state={saveState} /> : null}
      </button>
      {tooltip}
    </>
  );
}

/**
 * Recent の 1 行。
 *
 * Workspace の外にあるので相対パスを持たない。名前が同じファイルが並びうるため、
 * Tooltip では常にフルパスを見せる。
 */
function RecentRow({
  file,
  active,
  saveState,
  onSelect,
  onContextMenu,
}: {
  file: RecentFile;
  active: boolean;
  saveState: SaveState;
  onSelect: SidebarProps["onSelectRecent"];
  onContextMenu: SidebarProps["onRecentContextMenu"];
}) {
  const { ref, tooltip, handlers } = useTruncationTooltip(file.path, { always: true });

  return (
    <>
      <button
        type="button"
        className={`tree-row tree-row--file${active ? " is-active" : ""}`}
        style={{ paddingLeft: "8px" }}
        aria-current={active ? "true" : undefined}
        onClick={() => onSelect(file)}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu(file, { x: e.clientX, y: e.clientY });
        }}
        {...handlers}
      >
        <FileIcon className="tree-icon" />
        <span className="tree-label" ref={ref}>
          {file.filename}
        </span>
        {active ? <SaveDot state={saveState} /> : null}
      </button>
      {tooltip}
    </>
  );
}

function Section({
  label,
  rows,
  activePath,
  saveState,
  onSelect,
  onToggleFolder,
  onContextMenu,
  action,
}: {
  label: string;
  rows: TreeRow[];
  activePath: string | null;
  saveState: SaveState;
  onSelect: (doc: DocumentSummary) => void;
  onToggleFolder: (path: string) => void;
  onContextMenu: SidebarProps["onContextMenu"];
  action?: { label: string; onClick: () => void };
}) {
  if (rows.length === 0 && !action) return null;

  return (
    <section className="tree-section">
      <div className="section-head">
        <h2 className="section-label">{label}</h2>
        {action ? (
          <button
            type="button"
            className="section-action"
            aria-label={action.label}
            title={action.label}
            onClick={action.onClick}
          >
            <PlusIcon />
          </button>
        ) : null}
      </div>

      {rows.map((row) =>
        row.kind === "folder" ? (
          <button
            key={`folder:${row.path}`}
            type="button"
            className="tree-row tree-row--folder"
            style={{ paddingLeft: `${8 + row.depth * 13}px` }}
            aria-expanded={row.expanded}
            onClick={() => onToggleFolder(row.path)}
          >
            <ChevronIcon
              className={`tree-chevron${row.expanded ? " is-expanded" : ""}`}
            />
            <FolderIcon className="tree-icon" />
            <span className="tree-label">{row.name}</span>
          </button>
        ) : (
          <FileRow
            key={row.document.path}
            row={row}
            active={row.document.path === activePath}
            saveState={saveState}
            onSelect={onSelect}
            onContextMenu={onContextMenu}
          />
        ),
      )}
    </section>
  );
}

export function Sidebar(props: SidebarProps) {
  const {
    documents,
    recents,
    archived,
    expandedFolders,
    activePath,
    saveState,
    collapsed,
    compact,
    onToggleCollapsed,
    onSelect,
    onNewNote,
    onToggleFolder,
    onOpenSettings,
    onContextMenu,
    onSelectRecent,
    onRecentContextMenu,
  } = props;

  const notes = buildTree(documents, archived, expandedFolders, "notes");
  const archiveRows = buildTree(documents, archived, expandedFolders, "archive");
  const hasDirty = saveState !== "clean";

  if (collapsed) {
    return (
      <aside className="sidebar sidebar--collapsed" data-compact={compact}>
        {/* Top bar と同じ高さの帯。ここも title bar として掴める（ADR-010）。 */}
        <div className="sidebar-top" data-tauri-drag-region="deep">
          <button
            type="button"
            className="icon-btn"
            aria-label="サイドバーを開く"
            title="サイドバーを開く (Ctrl+B)"
            onClick={onToggleCollapsed}
          >
            <SidebarIcon />
          </button>
        </div>
        <nav className="rail" aria-label="サイドバー">
          <button type="button" className="rail-btn" aria-label="ノート" onClick={onToggleCollapsed}>
            <FileIcon />
            {hasDirty ? <span className="rail-dot" aria-hidden="true" /> : null}
          </button>
          <button type="button" className="rail-btn" aria-label="新規ノート" onClick={onNewNote}>
            <PlusIcon />
          </button>
          <button type="button" className="rail-btn" aria-label="アーカイブ" onClick={onToggleCollapsed}>
            <ArchiveIcon />
          </button>
        </nav>
        <div className="sidebar-bottom">
          <button
            type="button"
            className="rail-btn"
            aria-label="設定"
            title="設定 (Ctrl+,)"
            onClick={onOpenSettings}
          >
            <SettingsIcon />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="sidebar" data-compact={compact}>
      <div className="sidebar-top" data-tauri-drag-region="deep">
        <button
          type="button"
          className="icon-btn"
          aria-label="サイドバーを閉じる"
          title="サイドバーを閉じる (Ctrl+B)"
          onClick={onToggleCollapsed}
        >
          <SidebarIcon />
        </button>
      </div>

      <nav className="tree" aria-label="ファイル">
        <Section
          label="Notes"
          rows={notes}
          activePath={activePath}
          saveState={saveState}
          onSelect={onSelect}
          onToggleFolder={onToggleFolder}
          onContextMenu={onContextMenu}
          action={{ label: "新規ノート", onClick: onNewNote }}
        />
        <Section
          label="Archive"
          rows={archiveRows}
          activePath={activePath}
          saveState={saveState}
          onSelect={onSelect}
          onToggleFolder={onToggleFolder}
          onContextMenu={onContextMenu}
        />

        {/* Workspace 外で開いたファイル（ADR-013）。新しい順。 */}
        {recents.length > 0 ? (
          <section className="tree-section">
            <div className="section-head">
              <h2 className="section-label">Recent</h2>
            </div>
            {recents.map((file) => (
              <RecentRow
                key={file.path}
                file={file}
                active={file.path === activePath}
                saveState={saveState}
                onSelect={onSelectRecent}
                onContextMenu={onRecentContextMenu}
              />
            ))}
          </section>
        ) : null}
      </nav>

      <div className="sidebar-bottom">
        <button type="button" className="utility-row" onClick={onOpenSettings}>
          <SettingsIcon className="tree-icon" />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}

/**
 * Context menu の位置合わせと閉じ方（interactions.md §13）。
 *
 * 画面の右端・下端からはみ出さない位置へ寄せ、Escape と外側クリックで閉じる。
 */
function useMenuPosition(position: { x: number; y: number }, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const [adjusted, setAdjusted] = useState(position);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setAdjusted({
      x: Math.min(position.x, window.innerWidth - rect.width - 8),
      y: Math.min(position.y, window.innerHeight - rect.height - 8),
    });
  }, [position]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = () => onClose();
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  return { ref, style: { left: adjusted.x, top: adjusted.y } };
}

/** Context menu（interactions.md §13）。 */
export function FileContextMenu({
  document: doc,
  position,
  archived,
  onClose,
  onAction,
}: {
  document: DocumentSummary;
  position: { x: number; y: number };
  archived: boolean;
  onClose: () => void;
  onAction: (action: string, doc: DocumentSummary) => void;
}) {
  const { ref, style } = useMenuPosition(position, onClose);

  const run = useCallback(
    (action: string) => {
      onAction(action, doc);
      onClose();
    },
    [doc, onAction, onClose],
  );

  return (
    <div
      ref={ref}
      className="context-menu"
      role="menu"
      style={style}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button type="button" role="menuitem" onClick={() => run("open")}>
        開く
      </button>
      <button type="button" role="menuitem" onClick={() => run("open-new-window")}>
        新しいウィンドウで開く
      </button>
      <hr />
      <button type="button" role="menuitem" onClick={() => run("rename")}>
        名前を変更
      </button>
      <button type="button" role="menuitem" onClick={() => run("duplicate")}>
        複製
      </button>
      <button type="button" role="menuitem" onClick={() => run("copy-path")}>
        パスをコピー
      </button>
      <button type="button" role="menuitem" onClick={() => run("reveal")}>
        エクスプローラーで表示
      </button>
      <hr />
      <button type="button" role="menuitem" onClick={() => run(archived ? "restore" : "archive")}>
        {archived ? "アーカイブから戻す" : "アーカイブ"}
      </button>
    </div>
  );
}

/**
 * Recent 行の Context menu（ADR-013）。
 *
 * Workspace の外にあるファイルなので、Archive・Rename・複製は出さない。
 * Archive は Workspace metadata の相対パスに紐づくため、そもそも適用できない。
 */
export function RecentContextMenu({
  file,
  position,
  onClose,
  onAction,
}: {
  file: RecentFile;
  position: { x: number; y: number };
  onClose: () => void;
  onAction: (action: string, file: RecentFile) => void;
}) {
  const { ref, style } = useMenuPosition(position, onClose);

  const run = (action: string) => {
    onAction(action, file);
    onClose();
  };

  return (
    <div
      ref={ref}
      className="context-menu"
      role="menu"
      style={style}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button type="button" role="menuitem" onClick={() => run("open")}>
        開く
      </button>
      <button type="button" role="menuitem" onClick={() => run("open-new-window")}>
        新しいウィンドウで開く
      </button>
      <hr />
      <button type="button" role="menuitem" onClick={() => run("open-folder")}>
        このフォルダを Workspace として開く
      </button>
      <button type="button" role="menuitem" onClick={() => run("copy-path")}>
        パスをコピー
      </button>
      <button type="button" role="menuitem" onClick={() => run("reveal")}>
        エクスプローラーで表示
      </button>
      <hr />
      <button type="button" role="menuitem" onClick={() => run("forget")}>
        履歴から削除
      </button>
    </div>
  );
}

export { Tooltip };
