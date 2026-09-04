# Open Decisions

> ユーザー判断が必要な事項を一か所に集約する。

## Decision table

| ID | 論点 | 推奨案 | 重要度 |
|---|---|---|---|
| U-001 | Workspaceモデル | フォルダWorkspace中心 + 単体`.md`もOpen可 | High |
| U-002 | Desktop stack | Tauri 2 + React + TypeScript + Rust | High |
| U-003 | Production editor engine | CodeMirror 6 | High |
| U-004 | Markdown parser | unified / remark系 | Medium |
| U-005 | Archiveの意味 | App metadataによる論理Archive。ファイルは移動しない | High |
| U-006 | Titleの正本 | Front Matter `title` がある場合はそれ。filenameとは非同期 | High |
| U-007 | Window title bar | Phase 1はNative decoration、将来Customを検討 | Medium |
| U-008 | Autosave delay | 最終入力から700ms | Medium |
| U-009 | 初期対応OS | Windows first、macOS next | High |
| U-010 | External change | File watcherを既定ON | High |
| U-011 | 複数文書 | Tabsなし。New Windowで対応 | Medium |
| U-012 | App固有Workspace metadata | `.quiet/` 配下のJSONを許可 | High |
| U-013 | Search All | MVP後半またはP1。Quick OpenはMVP | Medium |
| U-014 | Local history | MVPではCrash recoveryのみ。履歴UIはLater | Medium |

---

# U-001 Workspaceモデル

[USER DECISION REQUIRED: U-001]

## 推奨案

**フォルダベースWorkspaceを中心にする。任意の`.md`単体ファイルOpenも可能。**

例:

```text
MyNotes/
├─ idea.md
├─ project.md
└─ docs/
   └─ design.md
```

アプリはフォルダを所有しない。既存の通常フォルダをWorkspaceとして開く。

## 理由

- Markdownの可搬性を維持
- Git / VS Code / Obsidian等と共存しやすい
- AIエージェントからも同じファイルを扱える
- デスクトップアプリのFile Watcherと相性がよい

## 代替案

A. アプリ専用Notesフォルダだけを管理  
B. 全ファイルをアプリDBへImport

Bは推奨しない。

---

# U-002 Desktop stack

[USER DECISION REQUIRED: U-002]

## 推奨案

```text
Tauri 2
├─ React
├─ TypeScript
└─ Rust
```

## 理由

- 現在のHTML/CSS UI資産を移植しやすい
- WebViewでUIを作りつつ、Filesystem等をRust側へ閉じ込められる
- Electronより配布サイズ・メモリを抑えやすい
- デスクトップFile API / watcher / native dialogを実装可能

## 代替案

- Electron
- native Swift / WinUI
- Flutter Desktop

---

# U-003 Production editor engine

[USER DECISION REQUIRED: U-003]

## 推奨案

**CodeMirror 6**

Prototypeの`textarea + highlight overlay`はProductionへそのまま持ち込まない。

## 理由

- IME
- Selection
- Syntax highlighting
- Large document
- Undo history
- Keymap
- Accessibility
- Decorations

を自前実装しなくてよい。

---

# U-004 Markdown parser

[USER DECISION REQUIRED: U-004]

## 推奨案

**unified / remark系**

必要要件:

- CommonMark
- GFM
- Tables
- AST
- Heading抽出
- Front Matterとの境界処理

## 理由

TOC、Preview、将来の文書解析を同じASTへ寄せやすい。

---

# U-005 Archive semantics

[USER DECISION REQUIRED: U-005]

## 推奨案

**論理Archive。実ファイルは移動しない。**

Workspace-level metadataに、

```json
{
  "archived": [
    "old-note.md"
  ]
}
```

のような状態を保持。

## 理由

物理移動は次を壊す可能性がある。

- 相対リンク
- Git history上の見え方
- 外部ツールのpath reference
- AIやScriptの参照

## 代替案

`Archive/` フォルダへ物理移動。

こちらの方がアプリ外から見て分かりやすい利点はある。

---

# U-006 Title canonical source

[USER DECISION REQUIRED: U-006]

## 推奨案

1. Front Matterに`title`があれば、それを大きなTitle UIへ表示
2. Title UI編集は`frontmatter.title`へ反映
3. filenameは変更しない
4. Front Matterがないファイルではfilename stemをPlaceholder表示
5. Titleを明示編集した時点でのみ`title`を追加

## 理由

ファイルを開いただけで内容を書き換えないため。

---

# U-007 Window title bar

[USER DECISION REQUIRED: U-007]

## 推奨案

**Phase 1ではOS Native Title Bar。**

現在のUIはアプリContent Areaの先頭から開始する。

## 理由

- Windows / macOSのWindow control差異
- Drag region
- Snap
- Double click maximize
- Accessibility

を最初からCustom実装すると、本質ではない不具合を抱えやすい。

## 代替案

最初からCustom title bar。

UIの一体感は高い。

---

# U-008 Autosave delay

[USER DECISION REQUIRED: U-008]

## 推奨案

**700ms idle debounce**

さらに、

- Window blur時
- File switch時
- `Ctrl/Cmd+S`
- App close前

は即時save。

---

# U-009 Initial OS

[USER DECISION REQUIRED: U-009]

## 推奨案

Windows first。

macOS固有処理をinterfaceで分離しておく。

---

# U-010 External file changes

[USER DECISION REQUIRED: U-010]

## 推奨案

File watcherは既定ON。

- LocalがClean → 自動Reload
- LocalがDirty → Conflict UI

---

# U-011 Multi-document behavior

[USER DECISION REQUIRED: U-011]

## 推奨案

[ADOPTED寄り]

Tabsは使わない。

複数文書を同時比較したい場合は `Open in New Window`。

---

# U-012 App metadata

[USER DECISION REQUIRED: U-012]

## 推奨案

Workspace内に、

```text
.quiet/
└─ workspace.json
```

を作ることを許可。

用途:

- Archive状態
- Workspace固有UI設定
- 最終選択ファイル

ユーザー文書本体はここへ移さない。

`.quiet/` を作りたくない場合はOS App Dataへ保存する代替も可能。

---

# U-013 Search All

[USER DECISION REQUIRED: U-013]

## 推奨案

- Quick Open: MVP
- Current Document Find: MVP
- Search All: P1

---

# U-014 Local history

[USER DECISION REQUIRED: U-014]

## 推奨案

MVPでは、

- Atomic write
- Crash recovery

まで。

過去版を閲覧するLocal History UIはLater。
