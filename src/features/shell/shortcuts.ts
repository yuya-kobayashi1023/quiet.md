/**
 * アプリ全体のショートカット（U-029、`ui/desktop-ux.md`）。
 *
 * キー入力から操作への対応だけを持ち、実行は App が行う。
 */

export type Shortcut =
  | "save"
  | "toggle-sidebar"
  | "palette"
  | "find"
  | "search-all"
  | "new-note"
  | "open-file"
  | "settings"
  | "view-write"
  | "view-split"
  | "view-read";

export type ShortcutKey = Pick<
  KeyboardEvent,
  "key" | "ctrlKey" | "metaKey" | "shiftKey" | "repeat" | "isComposing"
>;

export interface ResolvedShortcut {
  shortcut: Shortcut;
  /**
   * false のときは実行しない。キーリピートと IME の変換中が該当する。
   * 押しっぱなしで Ctrl+N が新規ノートを量産しないよう、最初の 1 回だけを拾う。
   * 実行しない場合も、ブラウザ既定の動作（Ctrl+N の新規ウィンドウなど）へは流さない。
   */
  run: boolean;
}

export function resolveShortcut(e: ShortcutKey): ResolvedShortcut | null {
  const shortcut = shortcutFor(e);
  if (!shortcut) return null;
  return { shortcut, run: !e.repeat && !e.isComposing };
}

function shortcutFor(e: ShortcutKey): Shortcut | null {
  if (!(e.ctrlKey || e.metaKey)) return null;

  switch (e.key.toLowerCase()) {
    case "s":
      return "save";
    case "b":
      return "toggle-sidebar";
    case "k":
      return "palette";
    case "p":
      return e.shiftKey ? null : "palette";
    case "f":
      // Shift 付きは Workspace 全体（ADR-011）、無しは現在の文書（U-025）。
      return e.shiftKey ? "search-all" : "find";
    case "n":
      return "new-note";
    case "o":
      return "open-file";
    case ",":
      return "settings";
    case "1":
      return "view-write";
    case "2":
      return "view-split";
    case "3":
      return "view-read";
    default:
      return null;
  }
}
