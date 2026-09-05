/**
 * Window controls（ADR-010）。
 *
 * Top bar の右端に、最小化 / 最大化・元に戻す / 閉じる を置く。
 * OS Native decoration は使わない（U-007 を Custom title bar へ変更）。
 *
 * - Tauri の外では何も描かない。ブラウザで UI を確認するときに邪魔になるだけなので
 * - 最大化状態はここで持たない。Aero Snap や Win+↑ でも変わるため、window から購読する
 * - Close だけ hover 色を変える。誤爆の代償が他の 2 つと違う
 */

import { useEffect, useState } from "react";
import * as native from "@/services/native-bridge";
import { CloseIcon, MaximizeIcon, MinimizeIcon, RestoreIcon } from "@/ui/components/icons";

export function WindowControls() {
  const [maximized, setMaximized] = useState(false);
  const native_ = native.isNative();

  useEffect(() => {
    if (!native_) return;
    let dispose: (() => void) | undefined;
    let disposed = false;
    void native.onWindowMaximizeChange(setMaximized).then((fn) => {
      // 購読が張られる前に unmount された場合は、その場で解除する。
      if (disposed) fn();
      else dispose = fn;
    });
    return () => {
      disposed = true;
      dispose?.();
    };
  }, [native_]);

  if (!native_) return null;

  return (
    <div className="window-controls">
      <button
        type="button"
        className="window-btn"
        aria-label="最小化"
        title="最小化"
        onClick={() => void native.minimizeWindow()}
      >
        <MinimizeIcon />
      </button>
      <button
        type="button"
        className="window-btn"
        aria-label={maximized ? "元のサイズに戻す" : "最大化"}
        title={maximized ? "元のサイズに戻す" : "最大化"}
        onClick={() => void native.toggleMaximizeWindow()}
      >
        {maximized ? <RestoreIcon /> : <MaximizeIcon />}
      </button>
      <button
        type="button"
        className="window-btn window-btn--close"
        aria-label="閉じる"
        title="閉じる"
        onClick={() => void native.closeWindow()}
      >
        <CloseIcon />
      </button>
    </div>
  );
}
