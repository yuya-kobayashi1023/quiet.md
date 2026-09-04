# Desktop UX

## 1. Desktop appとして追加で考えること

Webモックでは見えないが、Productionでは次をUI仕様の一部として扱う。

- Window chrome
- Native file dialog
- Drag & Drop
- File association
- Context menu
- Global shortcutsではなくApp shortcut
- External file change
- Finder / Explorer連携
- Multi-window
- Close behavior

---

## 2. Title bar

[USER DECISION REQUIRED: U-007]

### 推奨

初期はNative decoration。

理由:

- Windows Snap
- Maximize
- OS accessibility
- macOS Traffic Light
- Drag region
- Multi monitor

が安定する。

Custom title barはUI完成後に検討。

---

## 3. Drag & Drop

[DRAFT]

### `.md` / `.markdown`

現在Windowで開く。

Dirty documentがある場合は先にAutosave。

### Folder

```text
Open "FolderName" as workspace?
```

で確認。

### Unsupported

カーソル付近に軽いFeedback。

---

## 4. File Dialog

Open:

OS Native Open Dialog。

Workspace:

Folder picker。

Save As:

OS Native Save Dialog。

---

## 5. Keyboard shortcuts

推奨初期値:

| Action | Windows/Linux | macOS |
|---|---|---|
| New Note | Ctrl+N | Cmd+N |
| Save now | Ctrl+S | Cmd+S |
| Find | Ctrl+F | Cmd+F |
| Quick Open | Ctrl+P | Cmd+P |
| Command Palette | Ctrl+K | Cmd+K |
| Toggle Sidebar | Ctrl+B | Cmd+B |
| Settings | Ctrl+, | Cmd+, |
| Close Window | Ctrl+W | Cmd+W |
| New Window | Ctrl+Shift+N | Cmd+Shift+N |

`Ctrl+Shift+P` をCommand Paletteに使うIDE文化もあるため、Shortcutは最終確認対象。

View切替のshortcutとOS別の表記ルールは未決定。`U-029` を参照。

---

## 6. Context menu

OSの見た目へ完全一致させる必要はないが、Desktopで期待される右クリック操作を用意する。

File row:

- Rename
- Duplicate
- Copy Path
- Reveal
- Archive / Restore
- Open in New Window

Editor:

- Undo
- Redo
- Cut
- Copy
- Paste
- Select All

独自実装がOS標準Edit操作を壊さないこと。

---

## 7. Multi-window

[USER DECISION REQUIRED: U-011]

Tabsは採用しない。

推奨:

- Sidebar click → same window
- `Open in New Window` → another window
- OS Snapで比較

各Windowは同じWorkspaceを共有可能。

同一ファイルを複数Windowで開けるか、Workspace stateをどう調停するかは未決定。`U-021` を参照。

---

## 8. File association

[DRAFT]

`.md` の「Open with Quiet」をサポート。

Double click起動時:

1. App起動
2. 指定ファイルを開く
3. Workspace外でも単体documentとして扱う

---

## 9. External editor coexistence

本アプリだけがファイルを編集する前提にしない。

VS Code、AI agent、Git、Script等から変更される。

File watcherは重要機能。

---

## 10. OS sleep / shutdown

[DRAFT]

Sleep前を完全に捕捉できる前提にしない。

Autosave + atomic writeで通常時から安全にする。

---

## 11. Native notifications

通常操作でOS Notificationは使わない。

保存失敗等もApp内で見えているならApp内UIを優先。

---

## 12. Accessibility

- System font scalingで破綻しない
- Keyboard navigation
- Screen reader label
- Focus trapping in modal
- Esc closes modal/popover
- reduced motion
- Contrast

---

## 13. Window minimum size

[DRAFT]

推奨:

```text
min-width: 760px
min-height: 520px
```

Split modeを維持できない幅では、

- Splitを一時的にWriteへ戻す
- またはPreviewをOverlayへ切替

などを検討。

Prototypeの「900px未満でSplit previewを隠す」はProductionで再検討対象。
