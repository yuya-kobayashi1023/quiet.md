/**
 * Sidebar のまとめて選択（ADR-024）。
 *
 * クリックの解釈だけをここに置き、React から切り離してテストする。
 * 選択は相対パスで持つので、外でファイルが増減しても行の並びから外れるだけで済む。
 */

export interface SidebarSelection {
  /** 選択中の相対パス。いま見えている行の並び順に保つ。 */
  readonly paths: readonly string[];
  /** Shift 範囲の起点。 */
  readonly anchor: string | null;
}

export type SelectionClick = "plain" | "toggle" | "range";

export const EMPTY_SELECTION: SidebarSelection = { paths: [], anchor: null };

/**
 * クリック 1 回ぶんの選択の移り変わり。
 *
 * `order` はいま見えているファイル行の相対パス（Notes → Archive の順）。
 * 折りたたまれたフォルダの中や、外で消えたファイルはここに無いので、
 * 選択からも範囲からも外れる（ADR-024 §3）。
 */
export function nextSelection(
  current: SidebarSelection,
  order: readonly string[],
  clicked: string,
  click: SelectionClick,
): SidebarSelection {
  if (click === "plain") return EMPTY_SELECTION;

  const visible = new Set(order);
  const kept = current.paths.filter((path) => visible.has(path));
  if (!visible.has(clicked)) return { paths: kept, anchor: current.anchor };

  if (click === "toggle") {
    const next = new Set(kept);
    if (next.has(clicked)) next.delete(clicked);
    else next.add(clicked);
    return { paths: order.filter((path) => next.has(path)), anchor: clicked };
  }

  const from = current.anchor == null ? -1 : order.indexOf(current.anchor);
  // 起点が無い、または起点が見えていないときは、その 1 件を選んで起点にする。
  if (from < 0) return { paths: [clicked], anchor: clicked };

  const to = order.indexOf(clicked);
  return {
    paths: order.slice(Math.min(from, to), Math.max(from, to) + 1),
    anchor: current.anchor,
  };
}
