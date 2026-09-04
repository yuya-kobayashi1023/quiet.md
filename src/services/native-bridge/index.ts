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

export const FILE_CHANGE_EVENT = "quiet://file-change";

export type FileWatchEvent =
  | { type: "changed"; path: string; revision: DiskRevision }
  | { type: "removed"; path: string }
  | { type: "created"; path: string };

export async function onFileChange(
  handler: (event: FileWatchEvent) => void,
): Promise<() => void> {
  if (!isNative()) return () => {};
  if (!listenImpl) {
    const evt = await import("@tauri-apps/api/event");
    listenImpl = evt.listen as unknown as ListenFn;
  }
  return listenImpl(FILE_CHANGE_EVENT, (e) => handler(e.payload as FileWatchEvent));
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

export const setArchived = (relativePath: string, archived: boolean) =>
  invoke<WorkspaceMetadata>("set_archived", { relativePath, archived });

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

export const openExternal = (url: string) =>
  invoke<void>("open_external", { url });

export const openInNewWindow = (path: string) =>
  invoke<void>("open_in_new_window", { path });

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

export { NativeError };
