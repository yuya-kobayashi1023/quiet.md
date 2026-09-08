/**
 * Workspace 履歴（過去に開いたフォルダ）。
 *
 * ADR-015 / ui-spec.md §2。
 * Workspace そのものの履歴なので、特定の Workspace に属さない。
 * `.quiet/workspace.json` ではなく App settings が持つ（Recent と同じ理由）。
 */

import { filenameOf, pathKey } from "./recents";

/** 覚えておく Workspace の数。表示件数もこれと同じ。 */
export const WORKSPACE_LIMIT = 10;

export interface WorkspaceEntry {
  /** Native が返す canonical な root path。 */
  path: string;
  /** 末尾のフォルダ名。Sidebar に出す表示名。 */
  name: string;
  /** 最後に開いた時刻（epoch ms）。並び順に使う。 */
  openedAt: number;
}

/** 同じフォルダを指すか。比較規則は Recent と同じ（Windows の大小文字差と区切りを吸収）。 */
export function isSameWorkspace(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return pathKey(a) === pathKey(b);
}

/** 開いた Workspace を先頭へ積む。同じフォルダは 1 件に畳み、上限を超えた古いものは捨てる。 */
export function pushWorkspace(
  list: WorkspaceEntry[],
  path: string,
  openedAt: number,
  limit = WORKSPACE_LIMIT,
): WorkspaceEntry[] {
  const key = pathKey(path);
  const rest = list.filter((entry) => pathKey(entry.path) !== key);
  return [{ path, name: filenameOf(path), openedAt }, ...rest].slice(0, limit);
}

export function removeWorkspace(list: WorkspaceEntry[], path: string): WorkspaceEntry[] {
  const key = pathKey(path);
  return list.filter((entry) => pathKey(entry.path) !== key);
}
