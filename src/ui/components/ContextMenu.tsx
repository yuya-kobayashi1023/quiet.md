/**
 * Context menu の共有部品（interactions.md §13）。
 *
 * 画面の右端・下端からはみ出さない位置へ寄せ、Escape と外側クリックで閉じる。
 * 中身は呼び出し側が並べる。項目は `ContextMenuItem`。
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import "./context-menu.css";

export interface MenuPosition {
  x: number;
  y: number;
}

/** 位置合わせと閉じ方だけを受け持つ。箱を自前で描きたいときに使う。 */
export function useMenuPosition(position: MenuPosition, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const [adjusted, setAdjusted] = useState(position);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setAdjusted({
      x: Math.min(position.x, window.innerWidth - rect.width - 8),
      y: Math.min(position.y, window.innerHeight - rect.height - 8),
    });
  }, [position]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = () => onClose();
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  return { ref, style: { left: adjusted.x, top: adjusted.y } };
}

export function ContextMenu({
  position,
  onClose,
  children,
}: {
  position: MenuPosition;
  onClose: () => void;
  children: ReactNode;
}) {
  const { ref, style } = useMenuPosition(position, onClose);

  return (
    <div
      ref={ref}
      className="context-menu"
      role="menu"
      style={style}
      // 自分の上の mousedown で閉じない。閉じるのは外側だけ。
      onMouseDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

/** メニューの 1 項目。`disabled` は押せない行の見た目も兼ねる。 */
export function ContextMenuItem({
  disabled = false,
  onClick,
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" role="menuitem" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
