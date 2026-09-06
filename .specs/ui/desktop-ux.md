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

[DECIDED: U-007] Phase 1はOS Native Title Bar。

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

[DECIDED: U-029] shortcutの表記は実行時にプラットフォームから生成する。UIへハードコードしない。

View切替を追加する。

| Action | Windows/Linux | macOS |
|---|---|---|
| Write | Ctrl+1 | Cmd+1 |
| Split | Ctrl+2 | Cmd+2 |
| Read | Ctrl+3 | Cmd+3 |

この表を唯一の正とし、`product/requirements.md` からは参照だけにする。

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

[DECIDED: U-011] Tabsなし。複数文書はNew Window。同一ファイルは1Windowのみ（U-021）。

Tabsは採用しない。

推奨:

- Sidebar click → same window
- `Open in New Window` → another window
- OS Snapで比較

各Windowは同じWorkspaceを共有可能。

[DECIDED: U-021] 同一ファイルは同時に1Windowのみ。

- 既に開いていれば、そのWindowをfocusする
- `.quiet/workspace.json` の書込みは単一プロセス内で直列化する
- Workspace stateの変更は他Windowへ通知する
- watcherのself-save suppressionはProcess単位で行う

---

## 8. File association

[DECIDED: ADR-013]

`.md` / `.markdown` の「Open with Quiet」をサポートする。
インストーラで拡張子を登録する（`bundle.fileAssociations`）。
Windows の既定アプリ（UserChoice）はインストーラから変更できないため、
ユーザーが 1 度「既定のアプリ」で選ぶ必要がある。

起動経路（argv / 二重起動 / macOS Open with / Window URL の `?path=`）は
Native 側で `OpenTarget` へ正規化してから Frontend へ渡す。

アプリが起動していないとき:

1. App起動
2. 前回の Workspace を復元する
3. 指定ファイルを開く。Workspace 外でも単体documentとして扱う（U-001）

既に起動しているとき（single instance。プロセスは増やさない）:

1. 同じファイルを開いているWindowがあれば、そのWindowをfocus（U-021）
2. 文書を開いていないWindowがあれば、そこで開く
3. どちらでもなければ新しいWindowで開く（U-011）

Workspace 外で開いたファイルは Sidebar の `Recent` に残る（`ui-spec.md` §2）。

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
