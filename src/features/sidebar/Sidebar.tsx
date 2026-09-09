/**
 * Sidebar。
 *
 * .specs/ui/ui-spec.md §2 / §3、ADR-006、U-024。
 *
 * 禁止（§2）: `FILES` 見出し / Logo placeholder / footer の件数表示 /
 * Settings 上の強い divider / `Saved` 文字列。
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { DocumentSummary, SaveState } from "@/domain/document/types";
import { RECENT_COLLAPSED_COUNT, type RecentFile } from "@/domain/document/recents";
import {
  isSameWorkspace,
  relativeOpenedAt,
  type WorkspaceEntry,
} from "@/domain/document/workspaces";
import { buildTree, type TreeRow } from "@/services/workspace-service";
import {
  ArchiveIcon,
  ChevronDownIcon,
  ChevronIcon,
  FileIcon,
  FolderIcon,
  PlusIcon,
  SettingsIcon,
  SidebarIcon,
  WorkspaceIcon,
} from "@/ui/components/icons";
import { Tooltip, useTruncationTooltip } from "@/ui/components/Tooltip";
import "./sidebar.css";

interface SidebarProps {
  documents: DocumentSummary[];
  /**
   * Workspace 外で開いたファイル（ADR-013）。新しい順、履歴ぶんすべて。
   * 何件見せるかは Sidebar 側の畳み状態で決める。
   */
  recents: RecentFile[];
  /** 過去に開いた Workspace（ADR-016）。新しい順。 */
  workspaces: WorkspaceEntry[];
  /** 今開いている Workspace の root path。 */
  workspaceRoot: string | null;
  /** 今開いている Workspace の表示名。未選択なら null。 */
  workspaceName: string | null;
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
  onSelectWorkspace: (entry: WorkspaceEntry) => void;
  /** フォルダを選んで Workspace として開く。ドロップダウン最下部から呼ぶ。 */
  onOpenWorkspace: () => void;
  onWorkspaceContextMenu: (
    entry: WorkspaceEntry,
    position: { x: number; y: number },
  ) => void;
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

/**
 * Workspace 履歴の 1 件（ADR-016）。
 *
 * 表示名はフォルダ名だけなので、同名フォルダが並びうる。Tooltip は常にフルパス。
 * 右端に相対時刻を添える。並び順そのものが「新しい順」なので、絶対時刻は出さない。
 */
function WorkspaceMenuItem({
  entry,
  current,
  onSelect,
  onContextMenu,
}: {
  entry: WorkspaceEntry;
  current: boolean;
  onSelect: SidebarProps["onSelectWorkspace"];
  onContextMenu: SidebarProps["onWorkspaceContextMenu"];
}) {
  const { ref, tooltip, handlers } = useTruncationTooltip(entry.path, { always: true });

  return (
    <>
      <button
        type="button"
        role="menuitem"
        className={`ws-item${current ? " is-current" : ""}`}
        aria-current={current ? "true" : undefined}
        onClick={() => onSelect(entry)}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu(entry, { x: e.clientX, y: e.clientY });
        }}
        {...handlers}
      >
        <WorkspaceIcon className="tree-icon" />
        <span className="ws-item-name" ref={ref}>
          {entry.name}
        </span>
        <span className="ws-item-time">{relativeOpenedAt(entry.openedAt)}</span>
      </button>
      {tooltip}
    </>
  );
}

/**
 * Workspace の切り替えドロップダウン（ADR-016）。
 *
 * `.tree` は overflow を持つので、この Popover は `.tree` の外・Sidebar 直下に置く。
 * 位置は開いた時点の anchor から決める。
 */
function WorkspacePicker({
  workspaces,
  workspaceRoot,
  anchor,
  collapsed,
  onSelect,
  onOpenWorkspace,
  onContextMenu,
  onClose,
}: {
  workspaces: WorkspaceEntry[];
  workspaceRoot: string | null;
  anchor: HTMLElement | null;
  collapsed: boolean;
  onSelect: SidebarProps["onSelectWorkspace"];
  onOpenWorkspace: () => void;
  onContextMenu: SidebarProps["onWorkspaceContextMenu"];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  /*
   * 位置は開いた時点で確定させる（最初の paint から正しい位置に出す）。
   * 後から effect でずらすと、その 1 フレームぶん別の場所に見える。
   */
  const [top] = useState(() => {
    const parent = anchor?.closest(".sidebar");
    if (!anchor || !parent) return 0;
    return anchor.getBoundingClientRect().bottom - parent.getBoundingClientRect().top + 4;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    // click ではなく mousedown。開閉ボタン側の toggle と二重発火しないよう遅らせる。
    const timer = setTimeout(() => window.addEventListener("mousedown", onDown), 0);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  // 開いた直後は今の Workspace へ focus を置く。無ければ先頭。
  useLayoutEffect(() => {
    const first = ref.current?.querySelector<HTMLButtonElement>('[role="menuitem"]');
    const current = ref.current?.querySelector<HTMLButtonElement>(".ws-item.is-current");
    (current ?? first)?.focus();
  }, []);

  /** ↑↓ で候補を移動する。末尾の「新しいワークスペースを開く」も移動先に含める。 */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = Array.from(
      ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [],
    );
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const step = e.key === "ArrowDown" ? 1 : -1;
    const next = (index + step + items.length) % items.length;
    items[next]?.focus();
  };

  return (
    <div
      ref={ref}
      className={`ws-pop${collapsed ? " ws-pop--rail" : ""}`}
      role="menu"
      aria-label="Workspace"
      style={{ top }}
      onKeyDown={onKeyDown}
    >
      <div className="ws-list">
        {workspaces.map((entry) => (
          <WorkspaceMenuItem
            key={entry.path}
            entry={entry}
            current={isSameWorkspace(entry.path, workspaceRoot)}
            onSelect={onSelect}
            onContextMenu={onContextMenu}
          />
        ))}
      </div>
      {/* 一覧のスクロールに巻き込まれない位置に置く。履歴が空でもここは必ず出る。 */}
      <div className="ws-foot">
        <button type="button" role="menuitem" className="ws-item" onClick={onOpenWorkspace}>
          <PlusIcon className="tree-icon" />
          <span className="ws-item-name">新しいワークスペースを開く…</span>
        </button>
      </div>
    </div>
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
    workspaces,
    workspaceRoot,
    workspaceName,
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
    onSelectWorkspace,
    onOpenWorkspace,
    onWorkspaceContextMenu,
  } = props;

  const notes = buildTree(documents, archived, expandedFolders, "notes");
  const archiveRows = buildTree(documents, archived, expandedFolders, "archive");
  const hasDirty = saveState !== "clean";

  const [pickerOpen, setPickerOpen] = useState(false);
  const [recentExpanded, setRecentExpanded] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const closePicker = useCallback(() => setPickerOpen(false), []);

  // Workspace が変わったら閉じる。Context menu の「開く」から切り替えたときもここで閉じる。
  useEffect(() => setPickerOpen(false), [workspaceRoot]);

  const picker = pickerOpen ? (
    <WorkspacePicker
      workspaces={workspaces}
      workspaceRoot={workspaceRoot}
      anchor={anchorRef.current}
      collapsed={collapsed}
      onSelect={(entry) => {
        closePicker();
        onSelectWorkspace(entry);
      }}
      onOpenWorkspace={() => {
        closePicker();
        onOpenWorkspace();
      }}
      onContextMenu={onWorkspaceContextMenu}
      onClose={closePicker}
    />
  ) : null;

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
          {/* Workspace の切り替えは畳んだままでもできる（ADR-016）。 */}
          <button
            type="button"
            ref={anchorRef}
            className="rail-btn"
            aria-label="Workspace を切り替える"
            title="Workspace を切り替える"
            aria-haspopup="menu"
            aria-expanded={pickerOpen}
            onClick={() => setPickerOpen((open) => !open)}
          >
            <WorkspaceIcon />
          </button>
          <div className="rail-divider" aria-hidden="true" />
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
        {picker}
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
        {/*
          今開いている Workspace（ADR-016）。
          履歴を並べるのではなく 1 行だけ出し、切り替えは右の ⌄ から。
        */}
        <section className="tree-section">
          <div className="section-head">
            <h2 className="section-label">Workspace</h2>
            <button
              type="button"
              className="section-action"
              aria-label="Workspace を切り替える"
              title="Workspace を切り替える"
              aria-haspopup="menu"
              aria-expanded={pickerOpen}
              onClick={() => setPickerOpen((open) => !open)}
            >
              <ChevronDownIcon className={`ws-caret${pickerOpen ? " is-open" : ""}`} />
            </button>
          </div>
          <button
            type="button"
            ref={anchorRef}
            className={`tree-row tree-row--file${workspaceName ? " is-active" : ""}`}
            style={{ paddingLeft: "8px" }}
            title={workspaceRoot ?? undefined}
            aria-haspopup="menu"
            aria-expanded={pickerOpen}
            onClick={() => setPickerOpen((open) => !open)}
          >
            <WorkspaceIcon className="tree-icon" />
            <span className="tree-label">{workspaceName ?? "Workspace を選択"}</span>
          </button>
        </section>

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

      </nav>

      {picker}

      {/*
        Workspace 外で開いたファイル（ADR-013）。新しい順。
        Notes と一緒にスクロールさせず、Sidebar の下端へ固定する。
      */}
      {recents.length > 0 ? (
        <section className="sidebar-recent" aria-label="Recent">
          <div className="section-head">
            <h2 className="section-label">Recent</h2>
          </div>
          <div className="recent-list">
            {(recentExpanded ? recents : recents.slice(0, RECENT_COLLAPSED_COUNT)).map((file) => (
              <RecentRow
                key={file.path}
                file={file}
                active={file.path === activePath}
                saveState={saveState}
                onSelect={onSelectRecent}
                onContextMenu={onRecentContextMenu}
              />
            ))}
          </div>
          {recents.length > RECENT_COLLAPSED_COUNT ? (
            <button
              type="button"
              className="recent-more"
              aria-expanded={recentExpanded}
              onClick={() => setRecentExpanded((expanded) => !expanded)}
            >
              {recentExpanded ? "Less" : `More (${recents.length - RECENT_COLLAPSED_COUNT})`}
            </button>
          ) : null}
        </section>
      ) : null}

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

/**
 * Workspace 履歴の Context menu（ADR-016）。
 *
 * 対象はフォルダなので、ファイル向けの操作（名前変更・複製・Archive）は出さない。
 */
export function WorkspaceContextMenu({
  entry,
  position,
  onClose,
  onAction,
}: {
  entry: WorkspaceEntry;
  position: { x: number; y: number };
  onClose: () => void;
  onAction: (action: string, entry: WorkspaceEntry) => void;
}) {
  const { ref, style } = useMenuPosition(position, onClose);

  const run = (action: string) => {
    onAction(action, entry);
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
