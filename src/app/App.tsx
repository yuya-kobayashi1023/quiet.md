/**
 * App shell。
 *
 * 状態の持ち主は service 側。ここは組み立てとキーボード操作だけを担う。
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { EditorView } from "@codemirror/view";
import { EditorSelection } from "@codemirror/state";
import {
  Sidebar,
  FileContextMenu,
  RecentContextMenu,
  WorkspaceContextMenu,
} from "@/features/sidebar/Sidebar";
import { StatusBar, TopBar } from "@/features/shell/TopBar";
import { useSyncScroll } from "@/features/shell/use-sync-scroll";
import { Editor } from "@/features/editor/Editor";
import { Preview } from "@/features/preview/Preview";
import { Metadata } from "@/features/frontmatter/Metadata";
import { TocPopover } from "@/features/toc/TocPopover";
import { SettingsModal } from "@/features/settings/SettingsModal";
import { CommandPalette, type Command } from "@/features/command-palette/CommandPalette";
import { FindBar } from "@/features/search/FindBar";
import { SearchAllPanel, type SearchHit } from "@/features/search/SearchAllPanel";
import { ProblemBanner, Toast, type ToastState } from "@/ui/components/Banner";
import { whenNotComposing } from "@/ui/ime";
import {
  addFrontmatter,
  detectFrontmatter,
  parseFrontmatter,
} from "@/domain/document/frontmatter";
import { extractHeadings, HEADING_ID_PREFIX } from "@/domain/document/markdown";
import { filenameWithExtension, type DocumentSummary } from "@/domain/document/types";
import {
  filenameOf,
  isInsideWorkspace,
  RECENT_LIMIT,
  visibleRecents,
  type RecentFile,
} from "@/domain/document/recents";
import { workspaceForPath, type WorkspaceEntry } from "@/domain/document/workspaces";
import { documentService } from "@/services/document-service";
import { settingsService, type ViewMode } from "@/services/settings-service";
import { workspaceService } from "@/services/workspace-service";
import * as native from "@/services/native-bridge";
import { NativeError } from "@/domain/document/errors";
import "@/ui/global.css";

function useStore<T>(store: { get: () => T; subscribe: (fn: () => void) => () => void }): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/**
 * New Window の URL から開く対象を取り出す（ADR-013）。
 *
 * Native は新しい Window を `index.html?path=` / `?workspace=` で開く。
 */
function targetFromLocation(): native.OpenTarget | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const file = params.get("path");
  if (file) return { kind: "file", path: file };
  const workspace = params.get("workspace");
  if (workspace) return { kind: "workspace", path: workspace };
  return null;
}

/** パスの親フォルダ。区切りは Native が返した形をそのまま使う。 */
function parentOf(path: string): string {
  const separator = path.includes("\\") ? "\\" : "/";
  const at = path.lastIndexOf(separator);
  return at <= 0 ? path : path.slice(0, at);
}

export function App() {
  const settings = useStore(settingsService.store);
  const workspace = useStore(workspaceService.store);
  const docState = useStore(documentService.store);
  const session = docState.session;

  const [tocOpen, setTocOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [searchAllOpen, setSearchAllOpen] = useState(false);
  /** Search All から飛んできた行き先。文書を開いた後に消費する。 */
  const [pendingHit, setPendingHit] = useState<SearchHit | null>(null);
  const [moreMenu, setMoreMenu] = useState<{ x: number; y: number } | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  /**
   * タイトルを Enter で確定したあと、本文へカーソルを移すための合図。
   *
   * Rename が成功すると `session.path` が変わり Editor が作り直されるので、
   * blur の直後に focus しても新しい view には効かない。
   * token と path の両方を依存に入れて、view が入れ替わった後にもう一度 focus する。
   */
  const [bodyFocusToken, setBodyFocusToken] = useState(0);
  const [contextMenu, setContextMenu] = useState<{
    document: DocumentSummary;
    position: { x: number; y: number };
  } | null>(null);
  const [recentMenu, setRecentMenu] = useState<{
    file: RecentFile;
    position: { x: number; y: number };
  } | null>(null);
  const [workspaceMenu, setWorkspaceMenu] = useState<{
    entry: WorkspaceEntry;
    position: { x: number; y: number };
  } | null>(null);

  const editorView = useRef<EditorView | null>(null);
  const editorPane = useRef<HTMLDivElement>(null);
  const previewPane = useRef<HTMLDivElement>(null);

  const showToast = useCallback((message: string, action?: ToastState["action"]) => {
    setToast({ id: Date.now(), message, action });
  }, []);

  /**
   * 絶対パスで文書を開く（ADR-013）。
   *
   * Workspace の中なら通常どおり開く。外なら明示的に許可を取ってから開き、
   * Recent へ積む。許可は「ユーザーが明示的に開いたもの」だけに与える
   * （architecture.md §12）。
   */
  const openPath = useCallback(async (path: string): Promise<void> => {
    const root = workspaceService.store.get().snapshot?.rootPath ?? null;
    const inside = isInsideWorkspace(root, path);
    const target = inside ? path : await native.allowSingleFile(path);

    await documentService.open(target);
    if (!inside) settingsService.rememberRecent(target);

    workspaceService.setActive(target);
    setTitleDraft(null);
    setTitleError(null);
  }, []);

  /**
   * Workspace を開く唯一の経路（ADR-016）。
   *
   * 起動時の復元・フォルダ選択・New Window・Recent の「このフォルダを Workspace として開く」が
   * ここへ集まる。履歴に積むのは Native が返した canonical な root path。
   * 呼び出し側が渡した表記のままだと、同じフォルダが別の行として並びうる。
   */
  const openWorkspacePath = useCallback(async (path: string): Promise<void> => {
    const snapshot = await workspaceService.open(path);
    settingsService.update({ lastWorkspace: snapshot.rootPath });
    settingsService.rememberWorkspace(snapshot.rootPath);
  }, []);

  /**
   * 外から渡されたファイルを開く（ADR-018 §2）。
   *
   * 関連付け起動・CLI 引数・二重起動で届いたファイルの唯一の入口。
   * 現在の Workspace の外にあり、Workspace 履歴のいずれかに属していれば、
   * その Workspace へ切り替えてから開く。どれにも属さなければ従来どおり
   * 単体ファイルとして開いて Recent へ積む（ADR-013 §5）。
   */
  const openFileTarget = useCallback(
    async (path: string): Promise<void> => {
      const root = workspaceService.store.get().snapshot?.rootPath ?? null;
      const owner = isInsideWorkspace(root, path)
        ? null
        : workspaceForPath(settingsService.get().workspaces, path);

      if (owner) {
        try {
          await openWorkspacePath(owner.path);
        } catch (error) {
          // 切り替えに失敗しても、対象のファイルは単体ファイルとして開く（ADR-018 §2）。
          if (error instanceof NativeError && error.code === "NOT_FOUND") {
            settingsService.forgetWorkspace(owner.path);
            showToast(`${owner.name} が見つかりません。履歴から削除しました`);
          } else {
            showToast(error instanceof NativeError ? error.message : "フォルダを開けません");
          }
        }
      }

      await openPath(path);
    },
    [openPath, openWorkspacePath, showToast],
  );

  /* ---------------------------------------------------------------- *
   * 起動
   * ---------------------------------------------------------------- */

  useEffect(() => {
    void (async () => {
      await settingsService.load();

      // 起動経路は 1 本に正規化されている（ADR-013）。
      // URL の query は New Window、take_launch_target は関連付け起動と CLI 引数。
      const target = targetFromLocation() ?? (await native.takeLaunchTarget().catch(() => null));

      // 渡されたファイルが属する Workspace を先に開く。無ければ前回の Workspace（ADR-018 §3）。
      const owner =
        target?.kind === "file"
          ? workspaceForPath(settingsService.get().workspaces, target.path)
          : null;

      const workspacePath =
        target?.kind === "workspace"
          ? target.path
          : (owner?.path ?? settingsService.get().lastWorkspace);

      if (workspacePath) {
        try {
          await openWorkspacePath(workspacePath);
        } catch {
          // 前回の Workspace が無くなっていても起動は続ける。
        }
      } else if (!native.isNative()) {
        // ブラウザでの確認用。フォールバックの Workspace を開く。
        await openWorkspacePath("/notes");
      }

      if (target?.kind === "file") {
        await openPath(target.path).catch((error: unknown) => {
          // 関連付けから開いたファイルが無い・読めない場合。黙って空の画面にしない。
          showToast(error instanceof NativeError ? error.message : "ファイルを開けません");
        });
        return;
      }
      // Workspace を指定して開いたときは、前回のノートへは戻らない。
      if (target) return;

      const state = workspaceService.store.get();
      const metadata = state.metadata;
      if (settingsService.get().openLastNoteOnLaunch && metadata?.lastOpened) {
        const doc = state.snapshot?.documents.find(
          (d) => d.relativePath === metadata.lastOpened,
        );
        if (doc) {
          await documentService.open(doc.path).catch(() => {});
          workspaceService.setActive(doc.path);
        }
      }
    })();
    // openPath は mount 時点の実装で足りる（依存は service 側が持つ）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------------------------------------------------- *
   * 実行中に届く起動対象（ADR-013）
   * ---------------------------------------------------------------- */

  useEffect(() => {
    let dispose: (() => void) | undefined;
    void native
      .onOpenTarget((target) => {
        void (async () => {
          if (target.kind === "workspace") {
            await openWorkspacePath(target.path).catch(() => {});
            return;
          }
          await openFileTarget(target.path).catch((error: unknown) => {
            showToast(error instanceof NativeError ? error.message : "ファイルを開けません");
          });
        })();
      })
      .then((fn) => {
        dispose = fn;
      });
    return () => dispose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------------------------------------------------- *
   * この Window が開いている文書を Native へ知らせる（U-021）
   * ---------------------------------------------------------------- */

  useEffect(() => {
    void native.registerDocumentWindow(session?.path ?? null).catch(() => {});
  }, [session?.path]);

  /* ---------------------------------------------------------------- *
   * External change（U-010 / U-022）
   * ---------------------------------------------------------------- */

  useEffect(() => {
    let dispose: (() => void) | undefined;
    void native
      .onFileChange((event) => {
        if (event.type === "removed") {
          documentService.handleExternalDelete(event.path);
          void workspaceService.refresh();
          return;
        }
        if (event.type === "created") {
          void workspaceService.refresh();
          return;
        }
        void documentService.handleExternalChange(event.path, event.revision);
      })
      .then((fn) => {
        dispose = fn;
      });
    return () => dispose?.();
  }, []);

  /* ---------------------------------------------------------------- *
   * 即時 save（U-008）
   * ---------------------------------------------------------------- */

  useEffect(() => {
    const onBlur = () => void documentService.flush();
    const onBeforeUnload = () => void documentService.flush();
    window.addEventListener("blur", onBlur);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  /* ---------------------------------------------------------------- *
   * 派生値
   * ---------------------------------------------------------------- */

  const slice = useMemo(
    () => detectFrontmatter(session?.text ?? ""),
    [session?.text],
  );

  // Editor は本文だけを編集する。Front Matter は Metadata UI が持つ（ADR-002）。
  // 保存時に元へ戻すため、前置き部分を保持しておく。
  const frontmatterPrefix = useRef("");
  frontmatterPrefix.current = (session?.text ?? "").slice(0, slice.bodyOffset);
  const fields = useMemo(() => parseFrontmatter(slice.raw).fields, [slice.raw]);
  const headings = useMemo(() => extractHeadings(slice.body), [slice.body]);

  const breadcrumb = useMemo(() => {
    if (!session) return [workspace.snapshot?.name ?? "Quiet"];
    // Workspace の外のファイルに Workspace 名を出すと、所属を偽ることになる（ADR-013）。
    // 代わりに実際の親フォルダ名を見せる。
    if (!isInsideWorkspace(workspace.snapshot?.rootPath ?? null, session.path)) {
      return [filenameOf(parentOf(session.path)), session.filename].filter(Boolean);
    }
    const doc = workspace.snapshot?.documents.find((d) => d.path === session.path);
    const segments = doc?.relativePath.split("/") ?? [session.filename];
    return [workspace.snapshot?.name ?? "", ...segments].filter(Boolean);
  }, [session, workspace.snapshot]);

  const count = useMemo(() => {
    const body = slice.body;
    if (settings.countMode === "characters") {
      // 空白と改行を除いた文字数。日本語ではこちらが実用的（U-030）。
      return body.replace(/\s/g, "").length;
    }
    return (body.trim().match(/[A-Za-z0-9_'-]+|[぀-ヿ㐀-鿿]/g) ?? []).length;
  }, [slice.body, settings.countMode]);

  // Workspace の中にあるものは Notes 側に出ているので、Recent には出さない（ADR-013）。
  // 何件見せるかは Sidebar 側の畳み状態が決めるので、ここでは履歴ぶんすべて渡す。
  const recentRows = useMemo(
    () =>
      visibleRecents(settings.recentFiles, workspace.snapshot?.rootPath ?? null, RECENT_LIMIT),
    [settings.recentFiles, workspace.snapshot],
  );

  const baseDir = useMemo(() => {
    if (!session) return "";
    const sep = session.path.includes("\\") ? "\\" : "/";
    return session.path.slice(0, session.path.lastIndexOf(sep));
  }, [session]);

  /* ---------------------------------------------------------------- *
   * 操作
   * ---------------------------------------------------------------- */

  const openDocument = useCallback(async (doc: DocumentSummary) => {
    try {
      await documentService.open(doc.path);
      workspaceService.setActive(doc.path);
      setTitleDraft(null);
      setTitleError(null);
    } catch (error) {
      showToast(error instanceof NativeError ? error.message : "ファイルを開けません");
    }
  }, [showToast]);

  /** Recent の行を開く。無くなっていたらその場で履歴から外す（ADR-013）。 */
  const openRecent = useCallback(
    async (file: RecentFile) => {
      try {
        await openPath(file.path);
      } catch (error) {
        if (error instanceof NativeError && error.code === "NOT_FOUND") {
          settingsService.forgetRecent(file.path);
          showToast(`${file.filename} が見つかりません。履歴から削除しました`);
          return;
        }
        showToast(error instanceof NativeError ? error.message : "ファイルを開けません");
      }
    },
    [openPath, showToast],
  );

  /** ファイルを選んで開く。Workspace の外でもよい（U-001）。 */
  const openFile = useCallback(async () => {
    const path = await native.chooseMarkdownFile();
    if (!path) return;
    try {
      await openPath(path);
    } catch (error) {
      showToast(error instanceof NativeError ? error.message : "ファイルを開けません");
    }
  }, [openPath, showToast]);

  const newNote = useCallback(async () => {
    if (!workspace.snapshot) {
      showToast("先に Workspace を開いてください");
      return;
    }
    try {
      const doc = await native.createDocument({});
      await workspaceService.refresh();
      await openDocument(doc);
      // 作成直後は Rename 状態に入る（interactions.md §4）。
      setTitleDraft(doc.title);
    } catch (error) {
      showToast(error instanceof NativeError ? error.message : "作成できません");
    }
  }, [openDocument, showToast, workspace.snapshot]);

  const openWorkspace = useCallback(async () => {
    const path = await native.chooseWorkspace();
    if (!path) return;
    try {
      await openWorkspacePath(path);
    } catch (error) {
      showToast(error instanceof NativeError ? error.message : "フォルダを開けません");
    }
  }, [openWorkspacePath, showToast]);

  /**
   * Workspace 履歴の行を開く（ADR-016）。
   *
   * 無くなっていたらその場で履歴から外す。Recent の行と同じ扱い。
   */
  const openWorkspaceEntry = useCallback(
    async (entry: WorkspaceEntry) => {
      try {
        await openWorkspacePath(entry.path);
      } catch (error) {
        if (error instanceof NativeError && error.code === "NOT_FOUND") {
          settingsService.forgetWorkspace(entry.path);
          showToast(`${entry.name} が見つかりません。履歴から削除しました`);
          return;
        }
        showToast(error instanceof NativeError ? error.message : "フォルダを開けません");
      }
    },
    [openWorkspacePath, showToast],
  );

  const onWorkspaceAction = useCallback(
    async (action: string, entry: WorkspaceEntry) => {
      try {
        switch (action) {
          case "open":
            await openWorkspaceEntry(entry);
            break;
          case "open-new-window":
            await native.openWorkspaceInNewWindow(entry.path);
            break;
          case "copy-path":
            await navigator.clipboard.writeText(entry.path);
            showToast("パスをコピーしました");
            break;
          case "reveal":
            await native.revealFolder(entry.path);
            break;
          case "forget":
            settingsService.forgetWorkspace(entry.path);
            break;
        }
      } catch (error) {
        showToast(error instanceof NativeError ? error.message : "操作に失敗しました");
      }
    },
    [openWorkspaceEntry, showToast],
  );

  const commitTitle = useCallback(async () => {
    if (titleDraft == null || !session) return;
    const next = titleDraft.trim();
    setTitleDraft(null);
    if (!next || next === session.title) {
      setTitleError(null);
      return;
    }
    try {
      await documentService.rename(filenameWithExtension(next, session.filename));
      await workspaceService.refresh();
      workspaceService.setActive(documentService.session?.path ?? null);
      setTitleError(null);
    } catch (error) {
      // 失敗したら元の名前へ戻す（AC-N）。
      setTitleError(error instanceof NativeError ? error.message : "名前を変更できません");
    }
  }, [session, titleDraft]);

  // Rename の成否にかかわらず本文へ移る。失敗時はタイトルが元へ戻り
  // inline error が残るので、直したくなればタイトル欄をクリックすればよい。
  useEffect(() => {
    if (bodyFocusToken === 0) return;
    editorView.current?.focus();
  }, [bodyFocusToken, session?.path]);

  /* ---------------------------------------------------------------- *
   * Split の scroll 同期（ADR-012）
   * ---------------------------------------------------------------- */

  useSyncScroll({
    editorPane,
    previewPane,
    editorView,
    // 片方しか見えていないときに同期しても意味がない。
    enabled: settings.syncScroll && settings.viewMode === "split" && session != null,
    // 文書が変わると Editor が作り直される。対応表も作り直す。
    revision: session?.path ?? null,
  });

  /* ---------------------------------------------------------------- *
   * Search All からの移動（ADR-011）
   * ---------------------------------------------------------------- */

  const openHit = useCallback(
    async (hit: SearchHit) => {
      const doc = workspace.snapshot?.documents.find((d) => d.path === hit.path);
      if (!doc) return;
      // Read では Editor が隠れている。行へ飛ぶ以上、書ける面を出す。
      if (settingsService.get().viewMode === "read") setView("split");
      await openDocument(doc);
      setPendingHit(hit);
    },
    [openDocument, workspace.snapshot],
  );

  // 文書が開かれ、その文書の Editor が立ち上がってから選択を移す。
  // Editor は documentKey（= path）が変わったときだけ作り直されるので、
  // path も依存に入れて、作り直しの後に走らせる。
  useEffect(() => {
    if (!pendingHit || !session || session.path !== pendingHit.path) return;
    const view = editorView.current;
    if (!view) return;

    // 検索結果の行番号はファイル先頭からの通し番号。
    // Editor が持つのは本文だけなので、Front Matter の行数を引く（ADR-002）。
    const prefix = session.text.slice(0, detectFrontmatter(session.text).bodyOffset);
    const frontmatterLines = prefix === "" ? 0 : prefix.split("\n").length - 1;
    const target = Math.min(
      Math.max(1, pendingHit.line - frontmatterLines),
      view.state.doc.lines,
    );

    const line = view.state.doc.line(target);
    const from = Math.min(line.from + pendingHit.column - 1, line.to);
    const to = Math.min(from + pendingHit.length, line.to);

    view.dispatch({
      selection: EditorSelection.single(from, to),
      effects: EditorView.scrollIntoView(from, { y: "center" }),
    });
    view.focus();
    setPendingHit(null);
  }, [pendingHit, session]);

  const onContextAction = useCallback(
    async (action: string, doc: DocumentSummary) => {
      try {
        switch (action) {
          case "open":
            await openDocument(doc);
            break;
          case "open-new-window":
            await native.openInNewWindow(doc.path);
            break;
          case "rename":
            await openDocument(doc);
            setTitleDraft(doc.title);
            break;
          case "duplicate":
            await native.duplicateDocument(doc.path);
            await workspaceService.refresh();
            showToast(`${doc.filename} を複製しました`);
            break;
          case "copy-path":
            await navigator.clipboard.writeText(doc.path);
            showToast("パスをコピーしました");
            break;
          case "reveal":
            await native.revealInFileManager(doc.path);
            break;
          case "archive":
            await workspaceService.setArchived(doc.relativePath, true);
            showToast(`${doc.filename} をアーカイブしました`, {
              label: "元に戻す",
              onClick: () => void workspaceService.setArchived(doc.relativePath, false),
            });
            break;
          case "restore":
            await workspaceService.setArchived(doc.relativePath, false);
            showToast(`${doc.filename} を戻しました`);
            break;
        }
      } catch (error) {
        showToast(error instanceof NativeError ? error.message : "操作に失敗しました");
      }
    },
    [openDocument, showToast],
  );

  const onRecentAction = useCallback(
    async (action: string, file: RecentFile) => {
      try {
        switch (action) {
          case "open":
            await openRecent(file);
            break;
          case "open-new-window":
            await native.openInNewWindow(file.path);
            break;
          case "open-folder": {
            await openWorkspacePath(parentOf(file.path));
            await openPath(file.path);
            break;
          }
          case "copy-path":
            await navigator.clipboard.writeText(file.path);
            showToast("パスをコピーしました");
            break;
          case "reveal":
            // Reveal は Workspace 内か、明示的に開いたファイルにしか使えない。
            // 行を操作した時点で明示的な選択なので、ここで許可を取る。
            await native.allowSingleFile(file.path);
            await native.revealInFileManager(file.path);
            break;
          case "forget":
            settingsService.forgetRecent(file.path);
            break;
        }
      } catch (error) {
        showToast(error instanceof NativeError ? error.message : "操作に失敗しました");
      }
    },
    [openPath, openRecent, openWorkspacePath, showToast],
  );

  /* ---------------------------------------------------------------- *
   * TOC からの移動
   * ---------------------------------------------------------------- */

  const goToHeading = useCallback(
    (heading: { offset: number; id: string }) => {
      const mode = settings.viewMode;
      if (mode !== "read") {
        const view = editorView.current;
        if (view) {
          const pos = Math.min(slice.body.length, heading.offset);
          const line = view.state.doc.lineAt(Math.min(pos, view.state.doc.length));
          view.dispatch({ selection: { anchor: line.from } });
          const coords = view.coordsAtPos(line.from);
          const pane = editorPane.current;
          if (coords && pane) {
            pane.scrollTo({
              top: pane.scrollTop + coords.top - pane.getBoundingClientRect().top - 80,
              behavior: "smooth",
            });
          }
        }
      }
      if (mode !== "write") {
        const target = document.getElementById(`${HEADING_ID_PREFIX}${heading.id}`);
        const pane = previewPane.current;
        if (target && pane) {
          pane.scrollTo({
            top:
              pane.scrollTop +
              target.getBoundingClientRect().top -
              pane.getBoundingClientRect().top -
              40,
            behavior: "smooth",
          });
        }
      }
      setTocOpen(false);
    },
    [settings.viewMode, slice.body.length],
  );

  /* ---------------------------------------------------------------- *
   * Commands / Shortcuts（U-029）
   * ---------------------------------------------------------------- */

  const commands: Command[] = useMemo(
    () => [
      { id: "new", label: "新規ノート", shortcut: "Ctrl+N", run: () => void newNote() },
      { id: "save", label: "保存", shortcut: "Ctrl+S", run: () => void documentService.save() },
      {
        id: "open-workspace",
        label: "フォルダを開く",
        run: () => void openWorkspace(),
      },
      {
        id: "open-file",
        label: "ファイルを開く",
        shortcut: "Ctrl+O",
        run: () => void openFile(),
      },
      {
        id: "toggle-sidebar",
        label: "サイドバーの表示切替",
        shortcut: "Ctrl+B",
        run: () => settingsService.update({ sidebarCollapsed: !settings.sidebarCollapsed }),
      },
      { id: "write", label: "Write", shortcut: "Ctrl+1", run: () => setView("write") },
      { id: "split", label: "Split", shortcut: "Ctrl+2", run: () => setView("split") },
      { id: "read", label: "Read", shortcut: "Ctrl+3", run: () => setView("read") },
      { id: "settings", label: "設定", shortcut: "Ctrl+,", run: () => setSettingsOpen(true) },
      { id: "find", label: "この文書内を検索", shortcut: "Ctrl+F", run: () => setFindOpen(true) },
      {
        id: "search-all",
        label: "ワークスペース内を検索",
        shortcut: "Ctrl+Shift+F",
        run: () => setSearchAllOpen(true),
      },
      { id: "toc", label: "目次", run: () => setTocOpen(true) },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [newNote, openFile, openWorkspace, settings.sidebarCollapsed],
  );

  const setView = (mode: ViewMode) => settingsService.update({ viewMode: mode });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();

      if (key === "s") {
        e.preventDefault();
        void documentService.save();
      } else if (key === "b") {
        e.preventDefault();
        settingsService.update({ sidebarCollapsed: !settingsService.get().sidebarCollapsed });
      } else if (key === "k" || (key === "p" && !e.shiftKey)) {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (key === "f") {
        e.preventDefault();
        // Shift 付きは Workspace 全体（ADR-011）、無しは現在の文書（U-025）。
        if (e.shiftKey) setSearchAllOpen(true);
        else setFindOpen(true);
      } else if (key === "n") {
        e.preventDefault();
        void newNote();
      } else if (key === "o") {
        e.preventDefault();
        void openFile();
      } else if (key === ",") {
        e.preventDefault();
        setSettingsOpen(true);
      } else if (key === "1" || key === "2" || key === "3") {
        e.preventDefault();
        setView(key === "1" ? "write" : key === "2" ? "split" : "read");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newNote, openFile]);

  /* ---------------------------------------------------------------- *
   * Render
   * ---------------------------------------------------------------- */

  const problemActions = useMemo(() => {
    if (!session?.problem) return [];
    switch (session.problem.kind) {
      case "conflict":
        return [
          { label: "自分の変更を残す", onClick: () => void documentService.keepMine() },
          { label: "ディスクから再読込", onClick: () => void documentService.reloadFromDisk() },
        ];
      case "save_error":
        return [
          { label: "再試行", onClick: () => void documentService.retry() },
          {
            label: "名前を付けて保存…",
            onClick: () => {
              void (async () => {
                const target = await native.saveAsMarkdown(session.filename);
                if (!target) return;
                await native.saveDocument({
                  path: target,
                  content: session.text,
                  lineEnding: session.lineEnding,
                  hasBom: session.hasBom,
                  expectedRevision: null,
                });
                showToast("別の場所へ保存しました");
              })();
            },
          },
        ];
      case "missing":
        return [
          {
            label: "コピーを保存…",
            onClick: () => {
              void (async () => {
                const target = await native.saveAsMarkdown(session.filename);
                if (!target) return;
                await native.saveDocument({
                  path: target,
                  content: session.text,
                  lineEnding: session.lineEnding,
                  hasBom: session.hasBom,
                  expectedRevision: null,
                });
                showToast("コピーを保存しました");
              })();
            },
          },
        ];
    }
  }, [session, showToast]);

  return (
    <>
      <div className="app" data-sidebar={settings.sidebarCollapsed ? "collapsed" : "expanded"}>
        <Sidebar
          documents={workspace.snapshot?.documents ?? []}
          recents={recentRows}
          workspaces={settings.workspaces}
          workspaceRoot={workspace.snapshot?.rootPath ?? null}
          workspaceName={workspace.snapshot?.name ?? null}
          archived={workspace.metadata?.archived ?? []}
          expandedFolders={workspace.metadata?.expandedFolders ?? []}
          activePath={workspace.activePath}
          saveState={session?.saveState ?? "clean"}
          collapsed={settings.sidebarCollapsed}
          compact={settings.compactSidebar}
          onToggleCollapsed={() =>
            settingsService.update({ sidebarCollapsed: !settings.sidebarCollapsed })
          }
          onSelect={(doc) => void openDocument(doc)}
          onNewNote={() => void newNote()}
          onToggleFolder={(path) => workspaceService.toggleFolder(path)}
          onOpenSettings={() => setSettingsOpen(true)}
          onContextMenu={(document, position) => setContextMenu({ document, position })}
          onSelectRecent={(file) => void openRecent(file)}
          onRecentContextMenu={(file, position) => setRecentMenu({ file, position })}
          onSelectWorkspace={(entry) => void openWorkspaceEntry(entry)}
          onOpenWorkspace={() => void openWorkspace()}
          onWorkspaceContextMenu={(entry, position) => setWorkspaceMenu({ entry, position })}
        />

        <div className="main">
          <TopBar
            breadcrumb={breadcrumb}
            viewMode={settings.viewMode}
            tocOpen={tocOpen}
            onViewMode={setView}
            onToggleToc={() => setTocOpen((v) => !v)}
            onOpenPalette={() => setPaletteOpen(true)}
            onMore={(position) => setMoreMenu(position)}
          >
            {tocOpen ? (
              <TocPopover
                headings={headings}
                activeIndex={-1}
                onSelect={goToHeading}
                onClose={() => setTocOpen(false)}
              />
            ) : null}
          </TopBar>

          <main className="workspace" data-mode={settings.viewMode}>
            {session ? (
              <>
                <section className="pane editor-pane" ref={editorPane}>
                  {findOpen ? (
                    <FindBar view={editorView.current} onClose={() => setFindOpen(false)} />
                  ) : null}
                  <div className="editor-wrap">
                    {session.problem ? (
                      <ProblemBanner problem={session.problem} actions={problemActions} />
                    ) : null}

                    <Metadata
                      text={session.text}
                      onChange={(next) => documentService.edit(next)}
                    />

                    <textarea
                      className="title-input"
                      rows={1}
                      spellCheck={false}
                      aria-label="ファイル名"
                      value={titleDraft ?? session.title}
                      onChange={(e) => setTitleDraft(e.target.value.replace(/\n/g, ""))}
                      onFocus={() => setTitleDraft((v) => v ?? session.title)}
                      onBlur={() => void commitTitle()}
                      /*
                       * IME 変換中の Enter / Escape は横取りしない（ui/ime.ts）。
                       * ここはファイル名そのものなので、変換確定の Enter で blur すると
                       * 変換途中の文字列で Rename が走る。Escape も同様に、
                       * 変換の取り消しのつもりが編集全体の破棄になる。
                       */
                      onKeyDown={whenNotComposing((e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          setBodyFocusToken((n) => n + 1);
                          e.currentTarget.blur();
                        }
                        if (e.key === "Escape") {
                          setTitleDraft(null);
                          setTitleError(null);
                          e.currentTarget.blur();
                        }
                      })}
                      ref={(el) => {
                        if (!el) return;
                        el.style.height = "auto";
                        el.style.height = `${el.scrollHeight}px`;
                      }}
                    />
                    {titleError ? <p className="title-error">{titleError}</p> : null}

                    <Editor
                      documentKey={session.path}
                      initialText={slice.body}
                      fontSize={settings.fontSize}
                      tabWidth={settings.tabWidth}
                      lineWrap={settings.lineWrap}
                      spellCheck={settings.spellCheck}
                      onChange={(body) =>
                        documentService.edit(frontmatterPrefix.current + body)
                      }
                      onCursorChange={setCursor}
                      onReady={(view) => {
                        editorView.current = view;
                      }}
                    />
                  </div>
                </section>

                <section className="pane preview-pane" ref={previewPane}>
                  <Preview
                    title={session.title}
                    body={slice.body}
                    fields={fields}
                    baseDir={baseDir}
                    typeface={settings.previewTypeface}
                    onOpenDocument={(href) => {
                      const target = workspace.snapshot?.documents.find((d) =>
                        d.relativePath.endsWith(href.replace(/^\.\//, "")),
                      );
                      if (target) void openDocument(target);
                    }}
                  />
                </section>
              </>
            ) : (
              <div className="empty-state">
                {workspace.snapshot ? (
                  <>
                    <p>ノートを開く</p>
                    <kbd>Ctrl+P</kbd>
                  </>
                ) : (
                  <>
                    <p>ノートがありません</p>
                    <div className="empty-state-actions">
                      <button type="button" onClick={() => void newNote()}>
                        ノートを作成
                      </button>
                      <button type="button" onClick={() => void openWorkspace()}>
                        フォルダを開く
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </main>

          <StatusBar
            line={cursor.line}
            column={cursor.column}
            count={count}
            countMode={settings.countMode}
            lineEnding={session?.lineEnding ?? "lf"}
            tabWidth={settings.tabWidth}
            onToggleCountMode={() =>
              settingsService.update({
                countMode: settings.countMode === "characters" ? "words" : "characters",
              })
            }
          />
        </div>
      </div>

      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {recentMenu ? (
        <RecentContextMenu
          file={recentMenu.file}
          position={recentMenu.position}
          onClose={() => setRecentMenu(null)}
          onAction={(action, file) => void onRecentAction(action, file)}
        />
      ) : null}

      {workspaceMenu ? (
        <WorkspaceContextMenu
          entry={workspaceMenu.entry}
          position={workspaceMenu.position}
          onClose={() => setWorkspaceMenu(null)}
          onAction={(action, entry) => void onWorkspaceAction(action, entry)}
        />
      ) : null}

      {contextMenu ? (
        <FileContextMenu
          document={contextMenu.document}
          position={contextMenu.position}
          archived={workspaceService.isArchived(contextMenu.document.relativePath)}
          onClose={() => setContextMenu(null)}
          onAction={(action, doc) => void onContextAction(action, doc)}
        />
      ) : null}

      {moreMenu ? (
        <div
          className="context-menu"
          role="menu"
          style={{ left: moreMenu.x, top: moreMenu.y }}
          onMouseLeave={() => setMoreMenu(null)}
        >
          {/* Front Matter がない文書にだけ出す導線（U-018）。常設ボタンは増やさない。 */}
          {session && slice.raw == null ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                documentService.edit(addFrontmatter(session.text));
                setMoreMenu(null);
              }}
            >
              Metadata を追加
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setFindOpen(true);
              setMoreMenu(null);
            }}
          >
            この文書内を検索
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setSearchAllOpen(true);
              setMoreMenu(null);
            }}
          >
            ワークスペース内を検索
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              void openWorkspace();
              setMoreMenu(null);
            }}
          >
            フォルダを開く…
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setSettingsOpen(true);
              setMoreMenu(null);
            }}
          >
            設定
          </button>
        </div>
      ) : null}

      {searchAllOpen ? (
        <SearchAllPanel
          hasWorkspace={workspace.snapshot != null}
          includeArchived={settings.searchIncludeArchived}
          onIncludeArchivedChange={(value) =>
            settingsService.update({ searchIncludeArchived: value })
          }
          onOpenHit={(hit) => void openHit(hit)}
          onClose={() => setSearchAllOpen(false)}
        />
      ) : null}

      {settingsOpen ? <SettingsModal onClose={() => setSettingsOpen(false)} /> : null}

      {paletteOpen ? (
        <CommandPalette
          commands={commands}
          documents={workspace.snapshot?.documents ?? []}
          onOpenDocument={(doc) => void openDocument(doc)}
          onClose={() => setPaletteOpen(false)}
        />
      ) : null}
    </>
  );
}
