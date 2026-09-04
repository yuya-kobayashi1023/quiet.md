/**
 * Inline banner と Toast。
 *
 * U-022: Conflict / Save error / External delete は Editor 上部の Inline banner。
 * Modal にしない（入力を止めない）。Toast にしない（消えてはいけない）。
 *
 * U-026: Toast は 1 種類だけ。Status bar のすぐ上、同時表示は 1 件。
 * データ損失に関わる通知は Toast にしない。
 */

import { useEffect, useRef } from "react";
import type { DocumentProblem } from "@/domain/document/types";
import { WarningIcon } from "@/ui/components/icons";
import "./banner.css";

export interface BannerAction {
  label: string;
  onClick: () => void;
}

export function ProblemBanner({
  problem,
  actions,
}: {
  problem: DocumentProblem;
  actions: BannerAction[];
}) {
  return (
    <div className="banner" role="alert">
      {/* 色だけで伝えない。icon と文言を必ず添える（principles §9）。 */}
      <WarningIcon className="banner-icon" />
      <div className="banner-body">
        <p className="banner-message">{problem.message}</p>
        <div className="banner-actions">
          {actions.map((action) => (
            <button key={action.label} type="button" onClick={action.onClick}>
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export interface ToastState {
  id: number;
  message: string;
  action?: BannerAction;
}

export function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastState | null;
  onDismiss: () => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!toast) return;
    if (timer.current) clearTimeout(timer.current);
    // Action を持つ場合 6 秒、持たない場合 3 秒（U-026）。
    timer.current = setTimeout(onDismiss, toast.action ? 6000 : 3000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div className="toast" role="status" aria-live="polite">
      <span className="toast-message">{toast.message}</span>
      {toast.action ? (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            toast.action?.onClick();
            onDismiss();
          }}
        >
          {toast.action.label}
        </button>
      ) : null}
    </div>
  );
}
