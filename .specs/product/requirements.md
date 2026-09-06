# Product Requirements

> ステータス: Draft  
> 現在のUI打合せと、デスクトップアプリ化を想定した機能要求。

## 1. Product definition

ローカルMarkdownファイルを、静かで高速なUIから編集・閲覧するデスクトップアプリ。

主目的は「Markdown記法そのものを隠すWYSIWYG」ではなく、**Markdownを素材として扱いつつ、読むときは美しくレンダリングすること**。

---

## 2. Primary use cases

1. Markdownノートを素早く開いて編集する
2. MarkdownとPreviewを左右で確認する
3. YAML Front Matterを生のYAMLまたは構造化UIから編集する
4. 長い文書の目次から見出しへ移動する
5. ローカルファイルをAutosaveする
6. Light / Darkを切り替える
7. サイドバーを畳んで本文へ集中する
8. キーボード中心でファイルやコマンドへアクセスする

---

## 3. MVP機能

### 3.1 Workspace / Files

- Workspace内Markdown一覧
- Notes区分
- Archive区分
- New Note
- ファイル選択
- 長いファイル名のトランケート
- Styled Tooltipでフルファイル名表示
- Rename
- Autosave
- Dirty state
- Save error
- 外部ファイル変更検知

[DECIDED: U-005] `Archive` は論理Archive。実ファイルは移動しない。

Archiveしてもファイル名は解放されないため、同一フォルダに同名ファイルは作れない。
これはOSとObsidianと同じ制約として受け入れる。

---

### 3.2 Editor

- Markdown source editing
- Markdown記号のSyntax Highlight
- 行折り返し
- IME入力
- Undo / Redo
- Find in document（UIは `U-025`）
- Editor font size
- Tab width
- Spell check option
- Keyboard selection / clipboard

[DECIDED: U-003] CodeMirror 6。

**推奨案:** ProductionではCodeMirror 6を利用する。  
理由は `decisions/007-production-editor-engine.md` を参照。

---

### 3.3 Preview

- CommonMark相当
- GFM Table
- List
- Blockquote
- Inline code
- Fenced code
- Link
- Horizontal rule
- Heading
- Front Matterの表示用メタデータ
- Read mode
- Split mode

[DRAFT]

GFMのTask List / StrikethroughもProductionでは有効にすることを推奨。

[DECIDED: U-023] Preview の外部リソース方針。

- Image: 相対パスはWorkspace内に限り表示する
- 外部link（http / https）: OS既定browserで開く。WebView内では遷移させない
- 相対 `.md` link: アプリ内でそのノートを開く
- Raw HTML: sanitizeして描画する（script と `on*` 属性を除去）
- `file://` と外部画像URL: 読み込まない

---

### 3.4 YAML Front Matter

- 文書先頭のFront Matterを検出
- 通常は `Metadata · N fields`
- Expand / Collapse
- Fields view
- Raw view
- `title`
- `tags`
- `status`
- `created`
- 未知キーを保持
- Raw YAMLの編集
- YAML parse error feedback
- PreviewではYAML構文そのものを表示しない

詳細は `domain/frontmatter.md`。

---

### 3.5 Navigation

- Breadcrumb
- Tabsは使用しない
- Table of Contents Popover
- Heading clickで移動
- Sidebar collapse
- Collapsed rail
- Command Palette
- Quick Open

現PrototypeのCommand Paletteは見た目サンプル。Productionでは実際の検索・コマンド実行を接続する。

---

### 3.6 View modes

- Write
- Split
- Read

Splitでは、

- Editor pane: スクロール1本
- Preview pane: スクロール1本
- Editor内部にネストした縦スクロールを作らない

---

### 3.7 Settings

General:

- Autosave
- Open last note on launch
- Default location
- Command Palette shortcut表示

Editor:

- Font size
- Line wrap
- Spell check
- Tab width

Appearance:

- System / Light / Dark
- Preview typeface
- Compact sidebar

---

### 3.8 Theme

- Light
- Dark
- System

DarkはLightの反転ではなく独立トークン。

---

## 4. Desktop機能 — MVP候補

[DRAFT]

以下はHTMLモックでまだ十分に詰めていないが、デスクトップアプリとして優先度が高い。

### P0候補

- Atomic save
- External file watcher
- Save failure handling
- OS File Dialog
- Window close safety
- Drag & Drop `.md`
- `Ctrl/Cmd + S`
- `Ctrl/Cmd + F`
- `Ctrl/Cmd + P`
- `Ctrl/Cmd + K`
- `Ctrl/Cmd + B`
- `Ctrl/Cmd + ,`

### P1候補

- Search All
- Context Menu
- Reveal in Explorer / Finder
- Copy Path
- Duplicate
- Open in New Window
- File association `.md`
- Recent workspaces

### P2候補

- Local history
- Export HTML / PDF
- Custom keyboard shortcut editor
- Plugin / extension mechanism
- AI integration

---

## 5. Non-goals for first release

[DRAFT]

- リアルタイム共同編集
- クラウド同期サービスの内製
- WYSIWYGエディタ
- NotionのようなBlock editor
- Browser版との完全共通化
- Git client機能
- タブUI
- 独自Markdown方言の大量追加
- AI機能を前提としたデータモデル

---

## 6. User Decision

### [DECIDED: U-001] フォルダWorkspace中心。単体 `.md` のOpenも可能。 Workspaceの基本モデル

**推奨:** フォルダベースWorkspaceを主軸にしつつ、任意`.md`単体Openもサポート。

### [DECIDED: U-009] Windows first（exe配布）。macOS next。 初期対応OS

**推奨:** Windows first。macOSを第2ターゲットとして、初期設計から差異だけ吸収できるようにする。

### [DECIDED: U-013] Quick OpenとFindはMVP。Search AllはP1。 MVPにSearch Allを含めるか

**推奨:** Quick OpenはMVP、本文横断検索はP1でもよい。

理由: Quick Openは日常操作へ直結する一方、全文検索はIndex戦略・Ignore規則・巨大Workspace性能を決める必要がある。
