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

/**
 * ファイル一覧から、サイドバーが描く行の並びを作る。
 *
 * - Notes と Archive を分ける（U-005）
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
  const target = documents.filter((doc) =>
    section === "archive"
      ? archivedSet.has(doc.relativePath)
      : !archivedSet.has(doc.relativePath),
  );

  const rows: TreeRow[] = [];
  const seenFolders = new Set<string>();

  for (const doc of target) {
    const segments = doc.relativePath.split("/");
    const folders = segments.slice(0, -1);

    let prefix = "";
    let visible = true;
    for (let depth = 0; depth < folders.length; depth++) {
      const name = folders[depth]!;
      prefix = prefix ? `${prefix}/${name}` : name;

      if (visible && !seenFolders.has(prefix)) {
        seenFolders.add(prefix);
        rows.push({
          kind: "folder",
          path: prefix,
          name,
          depth,
          expanded: expanded.has(prefix),
        });
      }
      if (!expanded.has(prefix)) {
        visible = false;
      }
    }

    if (visible) {
      rows.push({ kind: "file", depth: folders.length, document: doc });
    }
  }

  return rows;
}

export const workspaceService = new WorkspaceService();
