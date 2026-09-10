import { describe, expect, it, vi } from "vitest";
import { isComposingEvent, whenNotComposing } from "./ime";

/** React の KeyboardEvent のうち、判定に使う部分だけを模した形。 */
function keyEvent(key: string, native: { isComposing?: boolean; keyCode?: number }) {
  return { key, nativeEvent: native };
}

describe("isComposingEvent", () => {
  it("isComposing が立っていれば変換中と見なす", () => {
    expect(isComposingEvent({ isComposing: true })).toBe(true);
  });

  it("keyCode 229 だけでも変換中と見なす", () => {
    // Chromium は変換中の keydown を keyCode 229 で出す。
    // isComposing が付かない経路があるため、両方を見る必要がある。
    expect(isComposingEvent({ isComposing: false, keyCode: 229 })).toBe(true);
  });

  it("確定後のキーは変換中ではない", () => {
    expect(isComposingEvent({ isComposing: false, keyCode: 13 })).toBe(false);
  });

  it("判定材料が無いときは変換中ではない", () => {
    expect(isComposingEvent(undefined)).toBe(false);
    expect(isComposingEvent({})).toBe(false);
  });
});

describe("whenNotComposing", () => {
  it("変換確定の Enter ではハンドラを呼ばない", () => {
    const handler = vi.fn();
    whenNotComposing(handler)(keyEvent("Enter", { isComposing: true }));
    expect(handler).not.toHaveBeenCalled();
  });

  it("確定後にもう一度打った Enter では呼ぶ", () => {
    const handler = vi.fn();
    const guarded = whenNotComposing(handler);

    // 1 回目は変換確定に使われる。
    guarded(keyEvent("Enter", { isComposing: true }));
    // 2 回目が本来の実行。
    guarded(keyEvent("Enter", { isComposing: false }));

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("変換中の Escape も横取りしない（変換の取り消しに使われる）", () => {
    const handler = vi.fn();
    whenNotComposing(handler)(keyEvent("Escape", { keyCode: 229 }));
    expect(handler).not.toHaveBeenCalled();
  });

  it("英語入力では素通しする", () => {
    const handler = vi.fn();
    const guarded = whenNotComposing(handler);
    guarded(keyEvent("Enter", {}));
    guarded(keyEvent("Escape", {}));
    expect(handler).toHaveBeenCalledTimes(2);
  });
});
