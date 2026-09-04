/**
 * Tooltip。
 *
 * ui-spec.md §2 / interactions.md §11:
 * - 実際に省略されている場合だけ出す
 * - Browser native `title` に依存しない
 * - Keyboard focus でも出す
 * - Tooltip に操作を置かない
 *
 * Screen reader からも参照できるよう aria-describedby で結ぶ。
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./tooltip.css";

const DELAY = 350;

export function Tooltip({
  id,
  text,
  anchor,
}: {
  id: string;
  text: string;
  anchor: DOMRect;
}) {
  const [style, setStyle] = useState<React.CSSProperties>({
    left: anchor.right + 9,
    top: anchor.top + anchor.height / 2,
    visibility: "hidden",
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const wouldOverflow = anchor.right + 9 + rect.width > window.innerWidth - 12;
    setStyle({
      left: wouldOverflow ? Math.max(12, anchor.left - rect.width - 9) : anchor.right + 9,
      top: Math.min(
        Math.max(12, anchor.top + anchor.height / 2),
        window.innerHeight - rect.height - 12,
      ),
      visibility: "visible",
    });
  }, [anchor]);

  return createPortal(
    <div ref={ref} id={id} role="tooltip" className="tooltip" style={style}>
      {text}
    </div>,
    document.body,
  );
}

/**
 * ラベルが省略されているときだけ Tooltip を出すフック。
 *
 * 返り値の `ref` をラベル要素へ、`handlers` を行へ付ける。
 */
export function useTruncationTooltip(text: string) {
  const id = useId();
  const ref = useRef<HTMLElement>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((event: { currentTarget: HTMLElement }) => {
    const label = ref.current;
    if (!label || label.scrollWidth <= label.clientWidth) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAnchor(rect), DELAY);
  }, []);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setAnchor(null);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return {
    ref,
    tooltip: anchor ? <Tooltip id={id} text={text} anchor={anchor} /> : null,
    handlers: {
      onMouseEnter: show,
      onMouseLeave: hide,
      onFocus: show,
      onBlur: hide,
      "aria-describedby": anchor ? id : undefined,
    },
  };
}
