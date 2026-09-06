/**
 * Recent（Workspace 外で開いたファイル）の履歴。
 *
 * ADR-013 / ui-spec.md §2。
 * Workspace に属さない情報なので `.quiet/workspace.json` ではなく App settings が持つ。
 * Workspace を開いていない状態でも記録できる必要があるため、これは実装上の制約でもある。
 */

/** 履歴として持つ上限。表示件数は設定（recentVisibleCount）で別に決める。 */
export const RECENT_LIMIT = 30;

export interface RecentFile {
  /** Native が返す canonical path。 */
  path: string;
  filename: string;
  /** 最後に開いた時刻（epoch ms）。並び順に使う。 */
  openedAt: number;
}

/**
 * 同じファイルを指すかの比較キー。
 *
 * Windows は大小文字を区別せず、区切りも `\` と `/` が混ざる（domain/document-model.md §2）。
 * 大小文字を区別する OS では別ファイルを同一視しうるが、対応 OS は Windows と macOS
 * （どちらも既定で区別しない）なので、区別しない側へ倒す（U-009）。
 */
export function pathKey(path: string): string {
  return normalizeSeparators(path).toLowerCase();
}

function normalizeSeparators(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

export function filenameOf(path: string): string {
  const normalized = normalizeSeparators(path);
  return normalized.slice(normalized.lastIndexOf("/") + 1);
}

/** 開いたファイルを先頭へ積む。同じファイルは 1 件に畳み、上限を超えた古いものは捨てる。 */
export function pushRecent(
  list: RecentFile[],
  path: string,
  openedAt: number,
  limit = RECENT_LIMIT,
): RecentFile[] {
  const key = pathKey(path);
  const rest = list.filter((entry) => pathKey(entry.path) !== key);
  return [{ path, filename: filenameOf(path), openedAt }, ...rest].slice(0, limit);
}

export function removeRecent(list: RecentFile[], path: string): RecentFile[] {
  const key = pathKey(path);
  return list.filter((entry) => pathKey(entry.path) !== key);
}

/** `path` が Workspace の中にあるか。root が null のときは常に外。 */
export function isInsideWorkspace(root: string | null, path: string): boolean {
  if (!root) return false;
  const rootKey = pathKey(root);
  const target = pathKey(path);
  return target === rootKey || target.startsWith(`${rootKey}/`);
}

/**
 * Sidebar の Recent セクションに出す行。
 *
 * 現在の Workspace の中にあるファイルは Notes 側に出ているので除く。
 */
export function visibleRecents(
  list: RecentFile[],
  workspaceRoot: string | null,
  visibleCount: number,
): RecentFile[] {
  return list
    .filter((entry) => !isInsideWorkspace(workspaceRoot, entry.path))
    .slice(0, Math.max(0, visibleCount));
}
