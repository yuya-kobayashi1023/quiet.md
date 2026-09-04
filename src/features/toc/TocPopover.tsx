/**
 * Table of Contents（ADR-005 / U-020）。
 *
 * - 常設ペインにしない。Top bar の icon から Popover
 * - 階層は本文の見出しレベルそのまま。Title UI は含めない
 * - Esc / outside click で閉じる
 * - Desktop では選択後に閉じる（interactions.md §7）
 */

import { useEffect, useRef } from "react";
import type { Heading } from "@/domain/document/markdown";
import "./toc.css";

interface TocPopoverProps {
  headings: Heading[];
  activeIndex: number;
  onSelect: (heading: Heading, index: number) => void;
  onClose: () => void;
}

export function TocPopover({ headings, activeIndex, onSelect, onClose }: TocPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    // click ではなく mousedown。ボタン側の toggle と二重発火しないよう遅らせる。
    const timer = setTimeout(() => window.addEventListener("mousedown", onDown), 0);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>(".toc-item")?.focus();
  }, []);

  return (
    <div className="toc-popover" ref={ref} role="dialog" aria-label="目次">
      <div className="toc-label">Contents</div>
      {headings.length === 0 ? (
        <p className="toc-empty">Headings will appear here as you write.</p>
      ) : (
        <nav className="toc-list" aria-label="Document outline">
          {headings.map((heading, index) => (
            <button
              key={`${heading.id}-${index}`}
              type="button"
              className={`toc-item toc-item--${heading.level}${
                index === activeIndex ? " is-active" : ""
              }`}
              onClick={() => onSelect(heading, index)}
            >
              <span className="toc-item-text">{heading.text}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
