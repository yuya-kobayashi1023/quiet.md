/**
 * Native bridge.
 *
 * Frontend から Filesystem へ触る唯一の経路（architecture.md §2）。
 * ここ以外で `invoke` を呼ばない。
 *
 * Tauri の外（ブラウザでの UI 確認・テスト）では、メモリ上のフォールバックへ落ちる。
 * 本番の挙動と混ざらないよう、フォールバックであることを `isNative()` で判別できるようにしてある。
 */

import type {
  DiskRevision,
  DocumentContent,
  DocumentSummary,
  LineEnding,
  RecoverySnapshot,
  RenameResult,
  SavedImage,
  SearchQuery,
  SearchResults,
  WorkspaceMetadata,
  WorkspaceSnapshot,
} from "@/domain/document/types";
import { NativeError, toNativeError } from "@/domain/document/errors";
import { browserFallback } from "./browser-fallback";

type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
type ListenFn = (
  event: string,
  handler: (event: { payload: unknown }) => void,
) => Promise<() => void>;

let invokeImpl: InvokeFn | null = null;
let listenImpl: ListenFn | null = null;

export function isNative(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * ローカルファイルを Preview の `<img>` が読める asset protocol の URL にする。
 *
 * `@tauri-apps/api/core` の `convertFileSrc` は `__TAURI_INTERNALS__` へ委譲するだけなので、
 * 描画中に同期で呼べるよう同じ global を直接使う（`withGlobalTauri` は有効にしていない）。
 * ブラウザではパスをそのまま返す。
 */
export function assetUrl(absolutePath: string): string {
  if (!isNative()) return absolutePath;
  const internals = (
    window as unknown as {
      __TAURI_INTERNALS__: { convertFileSrc?: (path: string, protocol: string) => string };
    }
  ).__TAURI_INTERNALS__;
  return internals.convertFileSrc ? internals.convertFileSrc(absolutePath, "asset") : absolutePath;
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isNative()) {
    return browserFallback<T>(cmd, args);
  }
  if (!invokeImpl) {
    const core = await import("@tauri-apps/api/core");
    invokeImpl = core.invoke as InvokeFn;
  }
  try {
    return await invokeImpl<T>(cmd, args);
  } catch (raw) {
    throw toNativeError(raw);
  }
}

async function listen(): Promise<ListenFn> {
  if (!listenImpl) {
    const evt = await import("@tauri-apps/api/event");
    listenImpl = evt.listen as unknown as ListenFn;
  }
  return listenImpl;
}

export const FILE_CHANGE_EVENT = "quiet://file-change";
/** 実行中のアプリへ「これを開け」と指示するイベント（ADR-013）。 */
export const OPEN_TARGET_EVENT = "quiet://open-target";
/** Window へ落とされたものが Markdown でもフォルダでもなかったことを知らせるイベント。 */
export const DROP_REJECTED_EVENT = "quiet://drop-rejected";

export type FileWatchEvent =
  | { type: "changed"; path: string; revision: DiskRevision }
  | { type: "removed"; path: string }
  | { type: "created"; path: string };

export async function onFileChange(
  handler: (event: FileWatchEvent) => void,
): Promise<() => void> {
  if (!isNative()) return () => {};
  return (await listen())(FILE_CHANGE_EVENT, (e) => handler(e.payload as FileWatchEvent));
}

/* ------------------------------------------------------------------ *
 * 起動対象（ADR-013）
 * ------------------------------------------------------------------ */

/** 関連付け起動・CLI 引数・二重起動・Open with を正規化したもの。 */
export type OpenTarget =
  | { kind: "workspace"; path: string }
  | { kind: "file"; path: string };

/**
 * 起動時に渡された対象を引き取る。2 度目は null。
 *
 * 起動直後は WebView がまだ listen していないので、event ではなくここで引き取る。
 */
export const takeLaunchTarget = () => invoke<OpenTarget | null>("take_launch_target");

/** この Window が今開いている文書を Native へ知らせる（U-021）。 */
export const registerDocumentWindow = (path: string | null) =>
  invoke<void>("register_document_window", { path });

export async function currentWindowLabel(): Promise<string> {
  if (!isNative()) return "main";
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow().label;
}

/** 実行中に届いた「これを開け」を受け取る。自分の Window 宛だけを通す。 */
export async function onOpenTarget(
  handler: (target: OpenTarget) => void,
): Promise<() => void> {
  if (!isNative()) return () => {};
  const label = await currentWindowLabel();
  return (await listen())(OPEN_TARGET_EVENT, (e) => {
    const payload = e.payload as (OpenTarget & { window: string }) | undefined;
    if (!payload || payload.window !== label) return;
    handler({ kind: payload.kind, path: payload.path } as OpenTarget);
  });
}

/** Window へ落とされたものを開けなかったことを受け取る。自分の Window 宛だけを通す。 */
export async function onDropRejected(handler: () => void): Promise<() => void> {
  if (!isNative()) return () => {};
  const label = await currentWindowLabel();
  return (await listen())(DROP_REJECTED_EVENT, (e) => {
    const payload = e.payload as { window: string } | undefined;
    if (!payload || payload.window !== label) return;
    handler();
  });
}

/* ------------------------------------------------------------------ *
 * Workspace
 * ------------------------------------------------------------------ */

export interface OpenWorkspaceResult extends WorkspaceSnapshot {
  metadata: WorkspaceMetadata;
}

export const openWorkspace = (path: string) =>
  invoke<OpenWorkspaceResult>("open_workspace", { path });

export const listDocuments = () => invoke<WorkspaceSnapshot>("list_documents");

export const allowSingleFile = (path: string) =>
  invoke<string>("allow_single_file", { path });

export const loadWorkspaceMetadata = () =>
  invoke<WorkspaceMetadata>("load_workspace_metadata");

export const saveWorkspaceMetadata = (metadata: WorkspaceMetadata) =>
  invoke<void>("save_workspace_metadata", { metadata });

// まとめて渡し、metadata の書き込みを 1 回にまとめる（ADR-024 §10）。
export const setArchived = (relativePaths: string[], archived: boolean) =>
  invoke<WorkspaceMetadata>("set_archived", { relativePaths, archived });

export const setPinned = (relativePaths: string[], pinned: boolean) =>
  invoke<WorkspaceMetadata>("set_pinned", { relativePaths, pinned });

/** Workspace 全体の全文検索（U-013 / ADR-011）。 */
export const searchWorkspace = (query: SearchQuery) =>
  invoke<SearchResults>("search_workspace", { query });

/* ------------------------------------------------------------------ *
 * Document
 * ------------------------------------------------------------------ */

export const readDocument = (path: string) =>
  invoke<DocumentContent>("read_document", { path });

export interface SaveDocumentInput {
  path: string;
  content: string;
  lineEnding: LineEnding;
  hasBom: boolean;
  expectedRevision: DiskRevision | null;
}

export const saveDocument = (input: SaveDocumentInput) =>
  invoke<DiskRevision>("save_document", { input });

export const createDocument = (input: {
  directory?: string;
  filename?: string;
}) => invoke<DocumentSummary>("create_document", { input });

export const renameDocument = (from: string, toFilename: string) =>
  invoke<RenameResult>("rename_document", { from, toFilename });

export const duplicateDocument = (path: string) =>
  invoke<string>("duplicate_document", { path });

export const documentRevision = (path: string) =>
  invoke<DiskRevision>("document_revision", { path });

/** クリップボードの画像をノートの `assets/` へ保存する（AUTO-050）。 */
export const savePastedImage = (notePath: string, filename: string, dataBase64: string) =>
  invoke<SavedImage>("save_pasted_image", { notePath, filename, dataBase64 });

/* ------------------------------------------------------------------ *
 * Recovery（U-014）
 * ------------------------------------------------------------------ */

export const writeRecoverySnapshot = (path: string, content: string) =>
  invoke<void>("write_recovery_snapshot", { path, content });

export const clearRecoverySnapshot = (path: string) =>
  invoke<void>("clear_recovery_snapshot", { path });

export const listRecoverySnapshots = () =>
  invoke<RecoverySnapshot[]>("list_recovery_snapshots");

/* ------------------------------------------------------------------ *
 * Settings
 * ------------------------------------------------------------------ */

export const loadAppSettings = () => invoke<unknown>("load_app_settings");

export const saveAppSettings = (settingsJson: unknown) =>
  invoke<void>("save_app_settings", { settingsJson });

/* ------------------------------------------------------------------ *
 * System
 * ------------------------------------------------------------------ */

export const revealInFileManager = (path: string) =>
  invoke<void>("reveal_in_file_manager", { path });

/**
 * Workspace の外にあるパスを Explorer / Finder で選択状態で表示する（ADR-016 / ADR-021）。
 *
 * 中身へは触れないので Workspace scope の判定は要らない。実在確認だけ Native が行う。
 */
export const revealPath = (path: string) => invoke<void>("reveal_path", { path });

/** 書き出した PDF を OS の既定のアプリで開く（ADR-021 §1）。`.pdf` 以外は Native が断る。 */
export const openPdf = (path: string) => invoke<void>("open_pdf", { path });

export const openExternal = (url: string) =>
  invoke<void>("open_external", { url });

export const openInNewWindow = (path: string) =>
  invoke<void>("open_in_new_window", { path });

/** Workspace を新しい Window で開く（ADR-016）。 */
export const openWorkspaceInNewWindow = (path: string) =>
  invoke<void>("open_workspace_in_new_window", { path });

/** Explorer の右クリック「Quiet で開く」の登録状態（ADR-014）。 */
export interface ContextMenuStatus {
  /** この OS で登録できるか。Windows 以外は false。 */
  supported: boolean;
  /** 今の実行ファイルを指す登録が揃っているか。 */
  enabled: boolean;
}

export const contextMenuStatus = () => invoke<ContextMenuStatus>("context_menu_status");

export const setContextMenu = (enabled: boolean) =>
  invoke<ContextMenuStatus>("set_context_menu", { enabled });

/**
 * この Window の紙面を PDF として書き出す（ADR-021）。
 *
 * 何を紙面に載せるかは `@media print`（`print.css`）が決める。呼ぶ前に
 * `PrintSheet` を mount しておく。
 */
export const exportPdf = (path: string) => invoke<void>("export_pdf", { path });

/* ------------------------------------------------------------------ *
 * Window（ADR-010 / Custom title bar）
 *
 * Drag / double click による最大化は Tauri が注入する `data-tauri-drag-region`
 * のハンドラが担う。ここが持つのはボタンから叩く操作だけ。
 * ------------------------------------------------------------------ */

async function currentWindow() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

export async function minimizeWindow(): Promise<void> {
  if (!isNative()) return;
  await (await currentWindow()).minimize();
}

export async function toggleMaximizeWindow(): Promise<void> {
  if (!isNative()) return;
  await (await currentWindow()).toggleMaximize();
}

export async function closeWindow(): Promise<void> {
  if (!isNative()) return;
  await (await currentWindow()).close();
}

/**
 * 最大化状態を購読する。呼んだ直後に現在値を 1 回渡す。
 *
 * 最大化はボタン以外（Aero Snap、ダブルクリック、Win+↑）でも変わるので、
 * ボタン側で状態を持たずにここから受け取る。
 */
export async function onWindowMaximizeChange(
  handler: (maximized: boolean) => void,
): Promise<() => void> {
  if (!isNative()) return () => {};
  const win = await currentWindow();
  handler(await win.isMaximized());
  return await win.onResized(async () => {
    handler(await win.isMaximized());
  });
}

/* ------------------------------------------------------------------ *
 * Native dialogs
 * ------------------------------------------------------------------ */

export async function chooseWorkspace(): Promise<string | null> {
  if (!isNative()) return null;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const result = await open({ directory: true, multiple: false });
  return typeof result === "string" ? result : null;
}

export async function chooseMarkdownFile(): Promise<string | null> {
  if (!isNative()) return null;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const result = await open({
    multiple: false,
    filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
  });
  return typeof result === "string" ? result : null;
}

export async function saveAsMarkdown(defaultName: string): Promise<string | null> {
  if (!isNative()) return null;
  const { save } = await import("@tauri-apps/plugin-dialog");
  const result = await save({
    defaultPath: defaultName,
    filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
  });
  return result ?? null;
}

/** PDF の保存先を選ぶ（ADR-021）。キャンセルは null。 */
export async function saveAsPdf(defaultName: string): Promise<string | null> {
  if (!isNative()) return null;
  const { save } = await import("@tauri-apps/plugin-dialog");
  const result = await save({
    defaultPath: defaultName,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  return result ?? null;
}

export { NativeError };
