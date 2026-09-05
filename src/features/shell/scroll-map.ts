/**
 * Split の scroll 同期で使う行 ↔ 縦位置の対応（ADR-012）。
 *
 * 割合（scrollTop / scrollHeight）で合わせると、コードブロック・表・画像のように
 * 「1 行が高い」要素があるだけでずれる。Preview 側の要素が持つ `data-source-line`
 * を対応点として持ち、その間を線形補間する。
 *
 * ここは DOM に触らない純粋な計算だけを置く。DOM の採寸は `use-sync-scroll.ts`。
 */

/** ある行が、あるペインの scroll 内容の何 px 目から始まるか。 */
export interface Anchor {
  /** 本文（Front Matter を除く）の行番号。1 始まり。 */
  line: number;
  /** scroll 内容の先頭からの距離（px）。 */
  top: number;
}

/**
 * 対応表を整える。
 *
 * - line 昇順に並べる
 * - 同じ行の対応点は最初の 1 つだけ残す
 * - top が前より小さい点は捨てる（補間が後戻りしないように）
 *
 * 呼び出し側の採寸順や、`position: sticky` 等で top が前後した要素を
 * ここで吸収する。
 */
export function normalizeAnchors(anchors: Anchor[]): Anchor[] {
  const sorted = [...anchors].sort((a, b) => a.line - b.line || a.top - b.top);
  const out: Anchor[] = [];
  for (const anchor of sorted) {
    const last = out[out.length - 1];
    if (last && last.line === anchor.line) continue;
    if (last && anchor.top < last.top) continue;
    out.push(anchor);
  }
  return out;
}

/**
 * 行（小数可）→ 縦位置。
 *
 * 対応点の間は線形補間する。両端の外側は、いちばん近い対応点にそのまま寄せる
 * （外挿しない。端で行き過ぎるより、止まって見える方がまし）。
 */
export function topForLine(anchors: Anchor[], line: number): number {
  if (anchors.length === 0) return 0;
  if (anchors.length === 1) return anchors[0]!.top;
  if (line <= anchors[0]!.line) return anchors[0]!.top;

  const last = anchors[anchors.length - 1]!;
  if (line >= last.line) return last.top;

  const index = upperBound(anchors, line);
  const before = anchors[index - 1]!;
  const after = anchors[index]!;
  const span = after.line - before.line;
  if (span <= 0) return before.top;

  const t = (line - before.line) / span;
  return before.top + t * (after.top - before.top);
}

/**
 * 縦位置 → 行（小数可）。`topForLine` の逆。
 *
 * 高さが 0 の区間（対応点が同じ top を持つ）は、手前の行を返す。
 */
export function lineForTop(anchors: Anchor[], top: number): number {
  if (anchors.length === 0) return 1;
  if (anchors.length === 1) return anchors[0]!.line;
  if (top <= anchors[0]!.top) return anchors[0]!.line;

  const last = anchors[anchors.length - 1]!;
  if (top >= last.top) return last.line;

  // top が並んでいる（同じ値が続く）ときは、その中の**最初**の点で区切る。
  // 後ろの点を選ぶと、同じ縦位置なのに行が先へ飛ぶ。
  const index = Math.max(1, lowerBoundByTop(anchors, top));
  const before = anchors[index - 1]!;
  const after = anchors[index]!;
  const span = after.top - before.top;
  if (span <= 0) return before.line;

  const t = (top - before.top) / span;
  return before.line + t * (after.line - before.line);
}

/** `line` より大きい最初の対応点の位置。 */
function upperBound(anchors: Anchor[], line: number): number {
  let low = 0;
  let high = anchors.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (anchors[mid]!.line <= line) low = mid + 1;
    else high = mid;
  }
  return low;
}

/** `top` 以上の top を持つ最初の対応点の位置。 */
function lowerBoundByTop(anchors: Anchor[], top: number): number {
  let low = 0;
  let high = anchors.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (anchors[mid]!.top < top) low = mid + 1;
    else high = mid;
  }
  return low;
}
