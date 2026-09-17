/**
 * ノートを開き直したときに戻すカーソル位置。
 *
 * Recent と同じ理由で App settings が持つ（recents.ts 冒頭）。
 * Workspace の外で開いたファイルにも効かせたいし、ユーザーのフォルダへ書き込みたくない。
 */

import { pathKey } from "./recents";

/**
 * 1 始まりの行と桁。StatusBar に出す値と同じ。
 *
 * 文字オフセットで持たないのは、開き直すまでにファイルが外で書き換わりうるから。
 * 行と桁なら復元時に文書の範囲へ丸めるだけで、行ずれがあっても近くに落ちる。
 */
export interface CursorPosition {
  line: number;
  column: number;
}

export interface RememberedPosition extends CursorPosition {
  /** Native が返す canonical path。 */
  path: string;
  /** 記録した時刻（epoch ms）。上限を超えたときに古いものから捨てる。 */
  updatedAt: number;
}

/** 記録として持つ上限。 */
export const POSITION_LIMIT = 200;

/** 位置を先頭へ積む。同じファイルは 1 件に畳み、上限を超えた古いものは捨てる。 */
export function rememberPosition(
  list: RememberedPosition[],
  path: string,
  position: CursorPosition,
  updatedAt: number,
  limit = POSITION_LIMIT,
): RememberedPosition[] {
  const rest = forgetPosition(list, path);
  return [{ path, line: position.line, column: position.column, updatedAt }, ...rest].slice(
    0,
    limit,
  );
}

export function positionOf(list: RememberedPosition[], path: string): CursorPosition | null {
  const key = pathKey(path);
  const entry = list.find((candidate) => pathKey(candidate.path) === key);
  return entry ? { line: entry.line, column: entry.column } : null;
}

export function forgetPosition(list: RememberedPosition[], path: string): RememberedPosition[] {
  const key = pathKey(path);
  return list.filter((entry) => pathKey(entry.path) !== key);
}
