/**
 * Workspace service。
 *
 * ファイル一覧・フォルダツリー・Archive 状態を持つ（U-005 / U-024）。
 */

import * as native from "@/services/native-bridge";
import type {
  DocumentSummary,
  WorkspaceMetadata,
  WorkspaceSnapshot,
} from "@/domain/document/types";
import { Store } from "@/services/store";

export interface WorkspaceState {
  snapshot: WorkspaceSnapshot | null;
  metadata: WorkspaceMetadata | null;
  activePath: string | null;
}

/** サイドバーが描くツリーの 1 行。 */
export type TreeRow =
  | { kind: "folder"; path: string; name: string; depth: number; expanded: boolean }
  | { kind: "file"; depth: number; document: DocumentSummary };

const EMPTY: WorkspaceState = { snapshot: null, metadata: null, activePath: null };

export class WorkspaceService {
  readonly store = new Store<WorkspaceState>(EMPTY);

  async open(path: string): Promise<WorkspaceSnapshot> {
    const result = await native.openWorkspace(path);
    const { metadata, ...snapshot } = result;
    this.store.set({ snapshot, metadata, activePath: null });
    return snapshot;
  }

  async refresh(): Promise<void> {
    const { snapshot } = this.store.get();
    if (!snapshot) return;
    const next = await native.listDocuments();
    this.store.set((prev) => ({ ...prev, snapshot: next }));
  }

  setActive(path: string | null): void {
    this.store.set((prev) => ({ ...prev, activePath: path }));
    const { snapshot, metadata } = this.store.get();
    if (!snapshot || !metadata || !path) return;
    const doc = snapshot.documents.find((d) => d.path === path);
    if (!doc || metadata.lastOpened === doc.relativePath) return;
    const next = { ...metadata, lastOpened: doc.relativePath };
    this.store.set((prev) => ({ ...prev, metadata: next }));
    void native.saveWorkspaceMetadata(next).catch(() => {});
  }

  isArchived(relativePath: string): boolean {
    return this.store.get().metadata?.archived.includes(relativePath) ?? false;
  }

  /** 論理 Archive。ファイルは移動しない（U-005）。 */
  async setArchived(relativePath: string, archived: boolean): Promise<void> {
    const metadata = await native.setArchived(relativePath, archived);
    this.store.set((prev) => ({ ...prev, metadata }));
  }

  toggleFolder(folderPath: string): void {
    const { metadata } = this.store.get();
    if (!metadata) return;
    const expanded = metadata.expandedFolders.includes(folderPath);
    const next = {
      ...metadata,
      expandedFolders: expanded
        ? metadata.expandedFolders.filter((p) => p !== folderPath)
        : [...metadata.expandedFolders, folderPath],
    };
    this.store.set((prev) => ({ ...prev, metadata: next }));
    void native.saveWorkspaceMetadata(next).catch(() => {});
  }
}

interface FolderNode {
  folders: Map<string, FolderNode>;
  files: DocumentSummary[];
}

const emptyFolder = (): FolderNode => ({ folders: new Map(), files: [] });

/** Native と同じ比較（`to_lowercase().cmp()`）。locale に依らない。 */
function compareName(a: string, b: string): number {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x < y ? -1 : x > y ? 1 : 0;
}

/**
 * ファイル一覧から、サイドバーが描く行の並びを作る。
 *
 * - Notes と Archive を分ける（U-005）
 * - 各階層でフォルダ行を名前順に置き、その後にファイル行を作成日時の新しい順に置く（ADR-019）。
 *   作成日時が同じファイルは Native の並び（名前順）を保つ
 * - フォルダは折りたたみ可能。閉じているフォルダの中身は行にしない（U-024）
 */
export function buildTree(
  documents: DocumentSummary[],
  archived: string[],
  expandedFolders: string[],
  section: "notes" | "archive",
): TreeRow[] {
  const archivedSet = new Set(archived);
  const expanded = new Set(expandedFolders);

  const root = emptyFolder();
  for (const doc of documents) {
    if (archivedSet.has(doc.relativePath) !== (section === "archive")) continue;
    const segments = doc.relativePath.split("/");
    let node = root;
    for (const name of segments.slice(0, -1)) {
      let child = node.folders.get(name);
      if (!child) {
        child = emptyFolder();
        node.folders.set(name, child);
      }
      node = child;
    }
    node.files.push(doc);
  }

  const rows: TreeRow[] = [];
  const emit = (node: FolderNode, prefix: string, depth: number) => {
    const folders = [...node.folders].sort(([a], [b]) => compareName(a, b));
    for (const [name, child] of folders) {
      const path = prefix ? `${prefix}/${name}` : name;
      const isExpanded = expanded.has(path);
      rows.push({ kind: "folder", path, name, depth, expanded: isExpanded });
      if (isExpanded) emit(child, path, depth + 1);
    }
    const files = [...node.files].sort((a, b) => b.createdAt - a.createdAt);
    for (const document of files) {
      rows.push({ kind: "file", depth, document });
    }
  };
  emit(root, "", 0);

  return rows;
}

export const workspaceService = new WorkspaceService();
