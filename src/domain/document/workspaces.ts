/**
 * Workspace 履歴（過去に開いたフォルダ）。
 *
 * ADR-016 / ui-spec.md §2。
 * Workspace そのものの履歴なので、特定の Workspace に属さない。
 * `.quiet/workspace.json` ではなく App settings が持つ（Recent と同じ理由）。
 */

import { filenameOf, isInsideWorkspace, pathKey } from "./recents";

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

/**
 * `path` を含む Workspace のうち、最も深いもの。どれにも属さなければ null（ADR-018 §2）。
 *
 * 入れ子の Workspace で外側へ切り替わらないよう、root が長いほうを採る。
 */
export function workspaceForPath(list: WorkspaceEntry[], path: string): WorkspaceEntry | null {
  return list.reduce<WorkspaceEntry | null>((deepest, entry) => {
    if (!isInsideWorkspace(entry.path, path)) return deepest;
    if (deepest && pathKey(deepest.path).length >= pathKey(entry.path).length) return deepest;
    return entry;
  }, null);
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

/**
 * 履歴に添える相対時刻（ADR-016）。
 *
 * 並び順は既に新しい順なので、ここで要るのは「どのくらい前か」の粗い手がかりだけ。
 * 分・時間・日・週・月・年で丸め、絶対時刻は出さない。
 */
export function relativeOpenedAt(openedAt: number, now = Date.now()): string {
  const minutes = Math.floor(Math.max(0, now - openedAt) / 60_000);
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "昨日";
  if (days < 7) return `${days}日前`;
  if (days < 30) return `${Math.floor(days / 7)}週間前`;
  if (days < 365) return `${Math.floor(days / 30)}か月前`;
  return `${Math.floor(days / 365)}年前`;
}

export function removeWorkspace(list: WorkspaceEntry[], path: string): WorkspaceEntry[] {
  const key = pathKey(path);
  return list.filter((entry) => pathKey(entry.path) !== key);
}
