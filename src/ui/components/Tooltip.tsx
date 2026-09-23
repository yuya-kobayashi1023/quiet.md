/**
 * Tooltip。
 *
 * ui-spec.md §2 / interactions.md §11:
 * - ファイル名は実際に省略されている場合だけ出す
 * - アイコンだけのボタンは常に名前を出す（`TooltipButton`）
 * - Browser native `title` に依存しない
 * - Keyboard focus でも出す
 * - Tooltip に操作を置かない
 *
 * Screen reader からも参照できるよう aria-describedby で結ぶ。
 */

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type Ref,
} from "react";
import { createPortal } from "react-dom";
import "./tooltip.css";

const DELAY = 350;

export function Tooltip({
  id,
  text,
  anchor,
  shortcut,
}: {
  id?: string;
  text: string;
  anchor: DOMRect;
  /** 渡すとボタンの名前として出す（UI の字）。渡さなければファイル名・パス用（等幅）。 */
  shortcut?: string | null;
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
    <div
      ref={ref}
      id={id}
      role="tooltip"
      className={shortcut === undefined ? "tooltip" : "tooltip tooltip--label"}
      style={style}
    >
      {text}
      {shortcut ? <span className="tooltip-key">{shortcut}</span> : null}
    </div>,
    document.body,
  );
}

/**
 * ラベルが省略されているときだけ Tooltip を出すフック。
 *
 * 返り値の `ref` をラベル要素へ、`handlers` を行へ付ける。
 * `always` を渡すと省略されていなくても出す。Recent のように、行の文字列
 * （ファイル名）だけでは足りず、常に全体（パス）を見せたい場合に使う。
 */
export function useTruncationTooltip(text: string, options?: { always?: boolean }) {
  const id = useId();
  const ref = useRef<HTMLElement>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const always = options?.always ?? false;
  const show = useCallback((event: { currentTarget: HTMLElement }) => {
    const label = ref.current;
    if (!label) return;
    if (!always && label.scrollWidth <= label.clientWidth) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAnchor(rect), DELAY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [always]);

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

/**
 * アイコンだけのボタン。名前（と shortcut）を Tooltip で出す。
 *
 * 名前は aria-label で読み上げるので、Tooltip は aria-describedby で結ばない。
 * マウスで押したときの focus では出さない。押した直後に吹き出しが残るため。
 */
export function TooltipButton({
  label,
  shortcut,
  ref,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  onPointerDown,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  /** 表示用の書き方（例: `Ctrl+B`）。 */
  shortcut?: string;
  ref?: Ref<HTMLButtonElement>;
}) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = (target: HTMLElement) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAnchor(target.getBoundingClientRect()), DELAY);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setAnchor(null);
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <button
      type="button"
      {...props}
      ref={ref}
      aria-label={label}
      aria-keyshortcuts={shortcut?.replace("Ctrl", "Control")}
      onMouseEnter={(e) => {
        show(e.currentTarget);
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        hide();
        onMouseLeave?.(e);
      }}
      onFocus={(e) => {
        if (e.currentTarget.matches(":focus-visible")) show(e.currentTarget);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        hide();
        onBlur?.(e);
      }}
      onPointerDown={(e) => {
        hide();
        onPointerDown?.(e);
      }}
    >
      {props.children}
      {anchor ? <Tooltip text={label} shortcut={shortcut ?? null} anchor={anchor} /> : null}
    </button>
  );
}
