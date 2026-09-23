/**
 * Sidebar。
 *
 * .specs/ui/ui-spec.md §2 / §3、ADR-006、U-024。
 *
 * 禁止（§2）: `FILES` 見出し / Logo placeholder / footer の件数表示 /
 * Settings 上の強い divider / `Saved` 文字列。
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { DocumentSummary, SaveState } from "@/domain/document/types";
import { RECENT_COLLAPSED_COUNT, type RecentFile } from "@/domain/document/recents";
import {
  EMPTY_SELECTION,
  nextSelection,
  type SelectionClick,
  type SidebarSelection,
} from "@/domain/document/selection";
import { formatCreatedAt } from "@/domain/document/timestamps";
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
  PinIcon,
  PlusIcon,
  SettingsIcon,
  SidebarIcon,
  WorkspaceIcon,
} from "@/ui/components/icons";
import { ContextMenu, ContextMenuItem } from "@/ui/components/ContextMenu";
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
  /** ピン止め（ADR-020）。区分の先頭へ寄せる。Recent には効かない。 */
  pinned: string[];
  expandedFolders: string[];
  activePath: string | null;
  /** まとめて選択（ADR-024）。Notes と Archive のファイル行だけが対象。 */
  selection: SidebarSelection;
  saveState: SaveState;
  collapsed: boolean;
  compact: boolean;
  /** ファイル行の右端に作成日時を添える（ADR-019 §4）。Recent には出さない。 */
  showCreatedAt: boolean;
  onToggleCollapsed: () => void;
  onSelect: (doc: DocumentSummary) => void;
  onSelectionChange: (selection: SidebarSelection) => void;
  onNewNote: () => void;
  onToggleFolder: (path: string) => void;
  onOpenSettings: () => void;
  /** 選択の中を右クリックしたときは、対象の相対パス一覧も渡す（ADR-024 §6）。 */
  onContextMenu: (
    doc: DocumentSummary,
    position: { x: number; y: number },
    selectedPaths?: string[],
  ) => void;
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

/** 修飾キーからクリックの意味を決める（ADR-024 §2）。macOS の Meta は Ctrl と同じ扱い。 */
function clickKind(e: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }): SelectionClick {
  if (e.shiftKey) return "range";
  if (e.ctrlKey || e.metaKey) return "toggle";
  return "plain";
}

function FileRow({
  row,
  active,
  selected,
  saveState,
  showCreatedAt,
  onFileClick,
  onContextMenu,
}: {
  row: Extract<TreeRow, { kind: "file" }>;
  active: boolean;
  selected: boolean;
  saveState: SaveState;
  showCreatedAt: boolean;
  onFileClick: (doc: DocumentSummary, click: SelectionClick) => void;
  onContextMenu: (doc: DocumentSummary, position: { x: number; y: number }) => void;
}) {
  const { ref, tooltip, handlers } = useTruncationTooltip(row.document.filename);

  return (
    <>
      <button
        type="button"
        className={`tree-row tree-row--file${active ? " is-active" : ""}${
          selected ? " is-selected" : ""
        }`}
        style={{ paddingLeft: `${8 + row.depth * 13}px` }}
        aria-current={active ? "true" : undefined}
        // Shift+クリックの前に、行をまたぐ文字選択が始まらないようにする。
        onMouseDown={(e) => {
          if (e.shiftKey) e.preventDefault();
        }}
        onClick={(e) => onFileClick(row.document, clickKind(e))}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu(row.document, { x: e.clientX, y: e.clientY });
        }}
        {...handlers}
      >
        {row.pinned ? <PinIcon className="tree-icon tree-pin" /> : <FileIcon className="tree-icon" />}
        <span className="tree-label" ref={ref}>
          {row.document.filename}
        </span>
        {showCreatedAt ? (
          <span className="tree-time">{formatCreatedAt(row.document.createdAt)}</span>
        ) : null}
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

/** 下端に固定した区分は、行が増えても Sidebar を押し上げないよう一覧だけをスクロールさせる。 */
function SectionRows({ docked, children }: { docked: boolean; children: ReactNode }) {
  return docked ? <div className="dock-list">{children}</div> : <>{children}</>;
}

function Section({
  label,
  rows,
  activePath,
  selectedPaths,
  saveState,
  showCreatedAt,
  onFileClick,
  onToggleFolder,
  onContextMenu,
  action,
  disclosure,
}: {
  label: string;
  rows: TreeRow[];
  activePath: string | null;
  selectedPaths: ReadonlySet<string>;
  saveState: SaveState;
  showCreatedAt: boolean;
  onFileClick: (doc: DocumentSummary, click: SelectionClick) => void;
  onToggleFolder: (path: string) => void;
  onContextMenu: (doc: DocumentSummary, position: { x: number; y: number }) => void;
  action?: { label: string; onClick: () => void };
  /**
   * 見出しごと畳めるようにし、Sidebar の下端へ固定する（ADR-023）。渡さない区分は常に開いたまま。
   * 開くと一覧は見出しの下に出るが、区分ごと下端に据わっているので、見た目は上へ伸びる。
   */
  disclosure?: { open: boolean; onToggle: () => void };
}) {
  if (rows.length === 0 && !action) return null;

  const visibleRows = disclosure && !disclosure.open ? [] : rows;

  return (
    <section className={disclosure ? "sidebar-dock" : "tree-section"}>
      {disclosure ? (
        <button
          type="button"
          className="section-head section-head--toggle"
          aria-expanded={disclosure.open}
          onClick={disclosure.onToggle}
        >
          <span className="section-label">{label}</span>
          <ChevronDownIcon className="recent-caret" />
        </button>
      ) : (
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
      )}

      <SectionRows docked={disclosure !== undefined}>
        {visibleRows.map((row) =>
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
              selected={selectedPaths.has(row.document.relativePath)}
              saveState={saveState}
              showCreatedAt={showCreatedAt}
              onFileClick={onFileClick}
              onContextMenu={onContextMenu}
            />
          ),
        )}
      </SectionRows>
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
    pinned,
    expandedFolders,
    activePath,
    selection,
    saveState,
    collapsed,
    compact,
    showCreatedAt,
    onToggleCollapsed,
    onSelect,
    onSelectionChange,
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

  const notes = buildTree(documents, archived, expandedFolders, "notes", pinned);
  const archiveRows = buildTree(documents, archived, expandedFolders, "archive", pinned);
  const hasDirty = saveState !== "clean";

  const [pickerOpen, setPickerOpen] = useState(false);
  /*
   * Recent は畳んだ状態で始める。開いていると Notes より下が賑やかになり、
   * 「たまに戻る」ためのものが常に視界へ入る（ui-spec.md §2）。
   */
  const [recentOpen, setRecentOpen] = useState(false);
  const [recentExpanded, setRecentExpanded] = useState(false);
  // Archive も同じ理由で畳んだ状態から始める（ADR-023）。開閉は metadata に保存しない。
  const [archiveOpen, setArchiveOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const closePicker = useCallback(() => setPickerOpen(false), []);

  // Workspace が変わったら閉じる。Context menu の「開く」から切り替えたときもここで閉じる。
  useEffect(() => setPickerOpen(false), [workspaceRoot]);

  const activeInArchive = archiveRows.some(
    (row) => row.kind === "file" && row.document.path === activePath,
  );

  /*
   * 開いているノートが Archive 側にあるなら開く（ADR-023 §3）。行が見えないと Active 表示が出ない。
   * activePath も依存に入れているので、自分で閉じた状態は次のノートを開くまで保たれる。
   */
  useEffect(() => {
    if (activeInArchive) setArchiveOpen(true);
  }, [activePath, activeInArchive]);

  /*
   * 選択と Shift の範囲が乗る並び（ADR-024 §3）。
   * いま見えているファイル行だけを Notes → Archive の順に置く。畳んだフォルダの中と、
   * 閉じている Archive の行は入らないので、見えない行へ操作が及ばない。
   */
  const fileOrder = [...notes, ...(archiveOpen ? archiveRows : [])].flatMap((row) =>
    row.kind === "file" ? [row.document.relativePath] : [],
  );
  const visible = new Set(fileOrder);
  const selected = selection.paths.filter((path) => visible.has(path));
  const selectedSet = new Set(selected);

  const onFileClick = (doc: DocumentSummary, click: SelectionClick) => {
    if (click !== "plain") {
      onSelectionChange(nextSelection(selection, fileOrder, doc.relativePath, click));
      return;
    }
    if (selection.paths.length > 0) onSelectionChange(EMPTY_SELECTION);
    onSelect(doc);
  };

  const onFileContextMenu = (doc: DocumentSummary, position: { x: number; y: number }) => {
    const inside = selectedSet.has(doc.relativePath);
    // 選択の外を押したら選択を捨てて、従来どおり 1 件のメニューへ戻す（ADR-024 §6）。
    if (!inside && selection.paths.length > 0) onSelectionChange(EMPTY_SELECTION);
    onContextMenu(doc, position, inside && selected.length > 1 ? selected : undefined);
  };

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
          selectedPaths={selectedSet}
          saveState={saveState}
          showCreatedAt={showCreatedAt}
          onFileClick={onFileClick}
          onToggleFolder={onToggleFolder}
          onContextMenu={onFileContextMenu}
          action={{ label: "新規ノート", onClick: onNewNote }}
        />
      </nav>

      {picker}

      {/*
        Archive（ADR-023）。Notes をできるだけ多く見せるため、Recent と同じく下端へ固定する。
      */}
      <Section
        label="Archive"
        rows={archiveRows}
        activePath={activePath}
        selectedPaths={selectedSet}
        saveState={saveState}
        showCreatedAt={showCreatedAt}
        onFileClick={onFileClick}
        onToggleFolder={onToggleFolder}
        onContextMenu={onFileContextMenu}
        disclosure={{ open: archiveOpen, onToggle: () => setArchiveOpen((open) => !open) }}
      />

      {/*
        Workspace 外で開いたファイル（ADR-013）。新しい順。
        Notes と一緒にスクロールさせず、Sidebar の下端へ固定する。
      */}
      {recents.length > 0 ? (
        <section className="sidebar-recent" aria-label="Recent">
          <button
            type="button"
            className="section-head section-head--toggle"
            aria-expanded={recentOpen}
            aria-controls="recent-list"
            onClick={() => setRecentOpen((open) => !open)}
          >
            <span className="section-label">Recent</span>
            <ChevronDownIcon className="recent-caret" />
          </button>
          {recentOpen ? (
            <>
              <div className="recent-list" id="recent-list">
                {(recentExpanded ? recents : recents.slice(0, RECENT_COLLAPSED_COUNT)).map(
                  (file) => (
                    <RecentRow
                      key={file.path}
                      file={file}
                      active={file.path === activePath}
                      saveState={saveState}
                      onSelect={onSelectRecent}
                      onContextMenu={onRecentContextMenu}
                    />
                  ),
                )}
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
            </>
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

/** Context menu（interactions.md §13）。 */
export function FileContextMenu({
  document: doc,
  position,
  archived,
  pinned,
  onClose,
  onAction,
}: {
  document: DocumentSummary;
  position: { x: number; y: number };
  archived: boolean;
  pinned: boolean;
  onClose: () => void;
  onAction: (action: string, doc: DocumentSummary) => void;
}) {
  const run = useCallback(
    (action: string) => {
      onAction(action, doc);
      onClose();
    },
    [doc, onAction, onClose],
  );

  return (
    <ContextMenu position={position} onClose={onClose}>
      <ContextMenuItem onClick={() => run("open")}>開く</ContextMenuItem>
      <ContextMenuItem onClick={() => run("open-new-window")}>
        新しいウィンドウで開く
      </ContextMenuItem>
      <hr />
      <ContextMenuItem onClick={() => run("rename")}>名前を変更</ContextMenuItem>
      <ContextMenuItem onClick={() => run("duplicate")}>複製</ContextMenuItem>
      <ContextMenuItem onClick={() => run("copy-path")}>パスをコピー</ContextMenuItem>
      <ContextMenuItem onClick={() => run("reveal")}>エクスプローラーで表示</ContextMenuItem>
      <hr />
      <ContextMenuItem onClick={() => run(pinned ? "unpin" : "pin")}>
        {pinned ? "ピン止めを外す" : "ピン止め"}
      </ContextMenuItem>
      <ContextMenuItem onClick={() => run(archived ? "restore" : "archive")}>
        {archived ? "アーカイブから戻す" : "アーカイブ"}
      </ContextMenuItem>
    </ContextMenu>
  );
}

/**
 * まとめて選択した行の Context menu（ADR-024 §7）。
 *
 * 1 件にしか意味を持たない操作（開く・名前を変更）と、実行のたびにウィンドウや
 * ファイルが増える操作（新しいウィンドウで開く・複製）は出さない。
 * Archive とピン止めの項目は、選択の中に変えられる行があるときだけ出す。
 */
export function MultiFileContextMenu({
  paths,
  position,
  archived,
  pinned,
  onClose,
  onAction,
}: {
  paths: string[];
  position: { x: number; y: number };
  archived: string[];
  pinned: string[];
  onClose: () => void;
  onAction: (action: string, paths: string[]) => void;
}) {
  const run = (action: string) => {
    onAction(action, paths);
    onClose();
  };

  const archivedSet = new Set(archived);
  const pinnedSet = new Set(pinned);
  const hasArchived = paths.some((path) => archivedSet.has(path));
  const hasUnarchived = paths.some((path) => !archivedSet.has(path));
  const hasPinned = paths.some((path) => pinnedSet.has(path));
  const hasUnpinned = paths.some((path) => !pinnedSet.has(path));

  return (
    <ContextMenu position={position} onClose={onClose}>
      <p className="context-menu-head">{paths.length} 件を選択中</p>
      <hr />
      {hasUnarchived ? (
        <ContextMenuItem onClick={() => run("archive")}>アーカイブ</ContextMenuItem>
      ) : null}
      {hasArchived ? (
        <ContextMenuItem onClick={() => run("restore")}>アーカイブから戻す</ContextMenuItem>
      ) : null}
      <hr />
      {hasUnpinned ? (
        <ContextMenuItem onClick={() => run("pin")}>ピン止め</ContextMenuItem>
      ) : null}
      {hasPinned ? (
        <ContextMenuItem onClick={() => run("unpin")}>ピン止めを外す</ContextMenuItem>
      ) : null}
      <hr />
      <ContextMenuItem onClick={() => run("copy-path")}>パスをコピー</ContextMenuItem>
      <hr />
      <ContextMenuItem onClick={() => run("clear-selection")}>選択を解除</ContextMenuItem>
    </ContextMenu>
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
  const run = (action: string) => {
    onAction(action, file);
    onClose();
  };

  return (
    <ContextMenu position={position} onClose={onClose}>
      <ContextMenuItem onClick={() => run("open")}>開く</ContextMenuItem>
      <ContextMenuItem onClick={() => run("open-new-window")}>
        新しいウィンドウで開く
      </ContextMenuItem>
      <hr />
      <ContextMenuItem onClick={() => run("open-folder")}>
        このフォルダを Workspace として開く
      </ContextMenuItem>
      <ContextMenuItem onClick={() => run("copy-path")}>パスをコピー</ContextMenuItem>
      <ContextMenuItem onClick={() => run("reveal")}>エクスプローラーで表示</ContextMenuItem>
      <hr />
      <ContextMenuItem onClick={() => run("forget")}>履歴から削除</ContextMenuItem>
    </ContextMenu>
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
  const run = (action: string) => {
    onAction(action, entry);
    onClose();
  };

  return (
    <ContextMenu position={position} onClose={onClose}>
      <ContextMenuItem onClick={() => run("open")}>開く</ContextMenuItem>
      <ContextMenuItem onClick={() => run("open-new-window")}>
        新しいウィンドウで開く
      </ContextMenuItem>
      <hr />
      <ContextMenuItem onClick={() => run("copy-path")}>パスをコピー</ContextMenuItem>
      <ContextMenuItem onClick={() => run("reveal")}>エクスプローラーで表示</ContextMenuItem>
      <hr />
      <ContextMenuItem onClick={() => run("forget")}>履歴から削除</ContextMenuItem>
    </ContextMenu>
  );
}

export { Tooltip };
