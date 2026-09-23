import { describe, expect, it } from "vitest";
import { resolveShortcut, type ShortcutKey } from "./shortcuts";

function press(key: string, extra: Partial<ShortcutKey> = {}): ShortcutKey {
  return {
    key,
    ctrlKey: true,
    metaKey: false,
    shiftKey: false,
    repeat: false,
    isComposing: false,
    ...extra,
  };
}

describe("resolveShortcut", () => {
  it("Ctrl と組み合わせたキーを操作へ対応させる", () => {
    const cases: [ShortcutKey, string][] = [
      [press("n"), "new-note"],
      [press("s"), "save"],
      [press("b"), "toggle-sidebar"],
      [press("k"), "palette"],
      [press("p"), "palette"],
      [press("f"), "find"],
      [press("F", { shiftKey: true }), "search-all"],
      [press("o"), "open-file"],
      [press(","), "settings"],
      [press("1"), "view-write"],
      [press("2"), "view-split"],
      [press("3"), "view-read"],
    ];
    for (const [key, shortcut] of cases) {
      expect(resolveShortcut(key)).toEqual({ shortcut, run: true });
    }
  });

  it("macOS の Cmd も Ctrl と同じに扱う", () => {
    expect(resolveShortcut(press("n", { ctrlKey: false, metaKey: true }))).toEqual({
      shortcut: "new-note",
      run: true,
    });
  });

  it("修飾キーが無ければ対象外", () => {
    expect(resolveShortcut(press("n", { ctrlKey: false }))).toBeNull();
  });

  it("Ctrl+Shift+P はパレットにしない", () => {
    expect(resolveShortcut(press("P", { shiftKey: true }))).toBeNull();
  });

  it("押しっぱなしのキーリピートでは実行しない", () => {
    // Ctrl+N を押し続けると、新規ノートが連続して作られていた。
    expect(resolveShortcut(press("n", { repeat: true }))).toEqual({
      shortcut: "new-note",
      run: false,
    });
  });

  it("IME の変換中は実行しない", () => {
    expect(resolveShortcut(press("n", { isComposing: true }))).toEqual({
      shortcut: "new-note",
      run: false,
    });
  });
});
