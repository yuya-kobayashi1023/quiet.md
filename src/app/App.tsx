/**
 * App shell。
 *
 * 状態の持ち主は service 側。ここは組み立てとキーボード操作だけを担う。
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { EditorView } from "@codemirror/view";
import { Sidebar, FileContextMenu } from "@/features/sidebar/Sidebar";
import { StatusBar, TopBar } from "@/features/shell/TopBar";
import { Editor } from "@/features/editor/Editor";
import { Preview } from "@/features/preview/Preview";
import { Metadata } from "@/features/frontmatter/Metadata";
import { TocPopover } from "@/features/toc/TocPopover";
import { SettingsModal } from "@/features/settings/SettingsModal";
import { CommandPalette, type Command } from "@/features/command-palette/CommandPalette";
import { ProblemBanner, Toast, type ToastState } from "@/ui/components/Banner";
import { detectFrontmatter, parseFrontmatter } from "@/domain/document/frontmatter";
import { extractHeadings, HEADING_ID_PREFIX } from "@/domain/document/markdown";
import { filenameWithExtension, type DocumentSummary } from "@/domain/document/types";
import { documentService } from "@/services/document-service";
import { settingsService, type ViewMode } from "@/services/settings-service";
import { workspaceService } from "@/services/workspace-service";
import * as native from "@/services/native-bridge";
import { NativeError } from "@/domain/document/errors";
import "@/ui/global.css";

function useStore<T>(store: { get: () => T; subscribe: (fn: () => void) => () => void }): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export function App() {
  const settings = useStore(settingsService.store);
  const workspace = useStore(workspaceService.store);
  const docState = useStore(documentService.store);
  const session = docState.session;

  const [tocOpen, setTocOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    document: DocumentSummary;
    position: { x: number; y: number };
  } | null>(null);

  const editorView = useRef<EditorView | null>(null);
  const editorPane = useRef<HTMLDivElement>(null);
  const previewPane = useRef<HTMLDivElement>(null);

  const showToast = useCallback((message: string, action?: ToastState["action"]) => {
    setToast({ id: Date.now(), message, action });
  }, []);

  /* ---------------------------------------------------------------- *
   * 起動
   * ---------------------------------------------------------------- */

  useEffect(() => {
    void (async () => {
      await settingsService.load();
      const last = settingsService.get().lastWorkspace;
      if (last) {
        try {
          await workspaceService.open(last);
        } catch {
          // 前回の Workspace が無くなっていても起動は続ける。
        }
      } else if (!native.isNative()) {
        // ブラウザでの確認用。フォールバックの Workspace を開く。
        await workspaceService.open("/notes");
      }

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
  }, []);

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
    await workspaceService.open(path);
    settingsService.update({ lastWorkspace: path });
  }, []);

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
        id: "toggle-sidebar",
        label: "サイドバーの表示切替",
        shortcut: "Ctrl+B",
        run: () => settingsService.update({ sidebarCollapsed: !settings.sidebarCollapsed }),
      },
      { id: "write", label: "Write", shortcut: "Ctrl+1", run: () => setView("write") },
      { id: "split", label: "Split", shortcut: "Ctrl+2", run: () => setView("split") },
      { id: "read", label: "Read", shortcut: "Ctrl+3", run: () => setView("read") },
      { id: "settings", label: "設定", shortcut: "Ctrl+,", run: () => setSettingsOpen(true) },
      { id: "toc", label: "目次", run: () => setTocOpen(true) },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [newNote, openWorkspace, settings.sidebarCollapsed],
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
      } else if (key === "n") {
        e.preventDefault();
        void newNote();
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
  }, [newNote]);

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
        />

        <div className="main">
          <TopBar
            breadcrumb={breadcrumb}
            viewMode={settings.viewMode}
            tocOpen={tocOpen}
            onViewMode={setView}
            onToggleToc={() => setTocOpen((v) => !v)}
            onOpenPalette={() => setPaletteOpen(true)}
            onMore={() => showToast("More メニューは未実装です")}
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
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          e.currentTarget.blur();
                        }
                        if (e.key === "Escape") {
                          setTitleDraft(null);
                          setTitleError(null);
                          e.currentTarget.blur();
                        }
                      }}
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

      {contextMenu ? (
        <FileContextMenu
          document={contextMenu.document}
          position={contextMenu.position}
          archived={workspaceService.isArchived(contextMenu.document.relativePath)}
          onClose={() => setContextMenu(null)}
          onAction={(action, doc) => void onContextAction(action, doc)}
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
