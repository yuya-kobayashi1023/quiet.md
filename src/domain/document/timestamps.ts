/**
 * Sidebar のファイル行に添える作成日時（ADR-019 §4）。
 *
 * 書式は `yyyy-mm-dd hh:mm` の固定。Workspace 履歴の相対時刻（`relativeOpenedAt`）と違い、
 * 並び順の根拠を確かめるための表示なので絶対時刻を出す。
 */

const pad2 = (n: number) => String(n).padStart(2, "0");

/** epoch ms をローカル時刻の `yyyy-mm-dd hh:mm`（24 時間制）にする。 */
export function formatCreatedAt(ms: number): string {
  const d = new Date(ms);
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` +
    ` ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  );
}
