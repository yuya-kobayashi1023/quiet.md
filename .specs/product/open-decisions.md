# Decisions (U-001〜U-030)

> ユーザー判断が必要だった事項の確定一覧。**30 / 30 回答済み（2026-09-05）**。
> ここに書いてある内容が実装の正。判断に至った検討記録（理由 / 代替案 / 不採用案）は
> [`../history/open-decisions-rationale.md`](../history/open-decisions-rationale.md) にある。
> 決定を覆すか、なぜそう決めたかを確認したいときだけそちらを開くこと。
> ADR で上書きされた項目は `decisions/` の該当 ADR が優先する。

## Decision table

| ID | 論点 | 決定 |
|---|---|---|
| U-001 | Workspaceモデル | フォルダWorkspace中心 + 単体`.md`もOpen可 |
| U-002 | Desktop stack | Tauri 2 + React + TypeScript + Rust |
| U-003 | Production editor engine | CodeMirror 6 |
| U-004 | Markdown parser | unified / remark系 |
| U-005 | Archiveの意味 | 論理Archive。ファイルは移動しない（名前は解放されない） |
| U-006 | Titleの正本 | **Title = ファイル名の拡張子抜き**。`frontmatter.title` とは非連動 |
| U-007 | Window title bar | ~~Phase 1はNative decoration~~ → Custom title bar（ADR-010） |
| U-008 | Autosave delay | 700ms idle debounce。**カーソル位置を保持すること** |
| U-009 | 初期対応OS | Windows first（exe）、macOS next |
| U-010 | External change | File watcher既定ON |
| U-011 | 複数文書 | Tabsなし。New Windowで対応 |
| U-012 | App固有Workspace metadata | `.quiet/workspace.json` を許可 |
| U-013 | Search All | ~~Search AllはP1~~ → `Ctrl+Shift+F` で実装済み（ADR-011） |
| U-014 | Local history | Atomic write + Crash recoveryまで |
| U-015 | New Noteの初期ファイル名 | `Untitled.md` + 即Rename |
| U-016 | 新規ファイルの改行コード | 既存は保持、新規はLF |
| U-017 | Invalid YAML時の保存可否 | 保存は許可。Fields syncのみ停止 |
| U-018 | Front Matterがない文書のMetadata UI | Front Matterなしならsummary非表示 |
| U-019 | Light themeのコントラスト | Lightの小さい文字のroleだけ暗くする |
| U-020 | Title / `frontmatter.title` / 本文H1の関係 | 本文の `#` はH1のまま。Titleは画面のchrome |
| U-021 | Multi-window時の同一ファイル・同一Workspace | 同一ファイルは1Windowのみ。既存をfocus |
| U-022 | Conflict / Save error / External deleteのUI | Editor上部のInline banner |
| U-023 | Previewのlink / image / raw HTML | 推奨のlink / image / raw HTMLポリシーを採用 |
| U-024 | Workspaceのフォルダツリーとignore規則 | 推奨のtree / ignore / sortルールを採用 |
| U-025 | Find in documentのUI | Editor右上のInline find bar |
| U-026 | Toastの採否と定義 | Status bar上にToast 1種類 |
| U-027 | Split時のscroll同期 | ~~MVPでは同期しない~~ → 行の対応表で同期（ADR-012） |
| U-028 | 保存競合検知にcontent hashを使うか | mtime + size + content hash |
| U-029 | ショートカット表記とView切替shortcut | OS別表記 + `Ctrl/Cmd+1/2/3` |
| U-030 | 日本語のword count | 既定は文字数。クリックで語数 |

---

## U-001 Workspaceモデル

[DECIDED: U-001]

フォルダWorkspace中心。単体 `.md` のOpenも可能。

## U-002 Desktop stack

[DECIDED: U-002]

Tauri 2 + React + TypeScript + Rust。

## U-003 Production editor engine

[DECIDED: U-003]

CodeMirror 6。

## U-004 Markdown parser

[DECIDED: U-004]

unified / remark系。

## U-005 Archive semantics

[DECIDED: U-005]

論理Archive。実ファイルは移動しない。

Archiveしてもファイル名は解放されない（同一フォルダに同名は作れない）。
これはOSとObsidianと同じ制約として受け入れる。
UUID等の機械的ファイル名は採用しない（U-006の「Title = ファイル名」と両立しないため）。
新規作成時の名前衝突はU-015の連番規則で回避する。

## U-006 Title canonical source

[DECIDED: U-006]

推奨案を採用しない。**Title UIは常にファイル名から拡張子を除いた文字列**とする（Obsidian方式）。

- `frontmatter.title` はTitle UIの表示に使わない
- Title UIの編集はファイルのRenameとして扱う（U-020参照）
- 既存文書に `title` キーがあってもMetadata Fieldsに表示・保存するだけで、Titleの正本にはしない

<details><summary>採用した推奨案の内容</summary>

1. Front Matterに`title`があれば、それを大きなTitle UIへ表示
2. Title UI編集は`frontmatter.title`へ反映
3. filenameは変更しない
4. Front Matterがないファイルではfilename stemをPlaceholder表示
5. Titleを明示編集した時点でのみ`title`を追加

</details>

## U-007 Window title bar

[DECIDED: U-007] → **[SUPERSEDED by ADR-010]（2026-09-05）**

~~Phase 1はOS Native Title Bar。将来的にCustom title barへ移行する。~~

**Custom title barへ移行済み。** 専用行は足さず、既存のTop barがtitle barを兼ねる。
下の「理由」に挙げた懸念は、Tauri 2側で解決していることを確認した（ADR-010 参照）。

## U-008 Autosave delay

[DECIDED: U-008]

700ms idle debounce + Window blur / Document切替 / `Ctrl+S` / App close前の即時save。

**Autosaveの前後でカーソル位置・選択範囲・スクロール位置を変えないこと。**
保存処理からEditorのstateへ書き戻さない。watcherの自己イベントはU-028のcontent hashで抑制する。

## U-009 Initial OS

[DECIDED: U-009]

Windows first（exe配布）。macOS next。

## U-010 External file changes

[DECIDED: U-010]

File watcherは既定ON。Cleanは自動Reload、DirtyはConflict。

## U-011 Multi-document behavior

[DECIDED: U-011]

Tabsなし。複数文書はNew Window。

## U-012 App metadata

[DECIDED: U-012]

Workspace内 `.quiet/workspace.json` を許可する。

## U-013 Search All

[DECIDED: U-013] → **[SUPERSEDED by ADR-011]（2026-09-05）**

~~Quick OpenとCurrent Document FindはMVP。Search AllはP1。~~

**Search Allも実装済み**（`Ctrl+Shift+F`）。Archiveは既定で検索対象に含める。
3つの検索の役割分担はADR-011を参照。

## U-014 Local history

[DECIDED: U-014]

MVPはAtomic write + Crash recoveryまで。履歴UIはLater。

## U-015 New Noteの初期ファイル名

[DECIDED: U-015]

`Untitled.md` を作成して即Rename。衝突時は `Untitled 2.md`。

詳細は `ui/interactions.md` §4。

## U-016 新規ファイルの改行コード

[DECIDED: U-016]

既存ファイルはLF / CRLFを保持。新規はOSに関係なくLF。

詳細は `domain/document-model.md` §12。

## U-017 Invalid YAML時の保存可否

[DECIDED: U-017]

Invalid YAMLでも保存可。Fields syncのみ停止し、Raw viewに明示Warningを出す。

詳細は `domain/frontmatter.md` §8。

## U-018 Front Matterがない文書のMetadata UI

[DECIDED: U-018]

Front Matterがなければ `Metadata` summaryを表示しない。More menuの `Add metadata` で挿入する。

詳細は `domain/frontmatter.md` §11。

## U-019 Light themeのコントラスト

[DECIDED: U-019]

Lightの小さい文字に使うroleだけ暗くする。Darkは変更しない。

最終値は次の通り。`--canvas` と `--sidebar` の両方で 4.5:1 以上を満たし、3段階の階層も維持している。

```css
--text-subtle:    #6e6e6d;  /* sidebar 4.52 / canvas 4.76 */
--text-muted:     #656460;  /* sidebar 5.24 / canvas 5.52 */
--text-secondary: #5b5b57;  /* sidebar 6.03 / canvas 6.35 */
--syntax-marker:  #96623e;  /* sidebar 4.52 / canvas 4.76 */
--accent-text:    #c63f00;  /* 文字用。dot等の非文字は --accent #f54e00 のまま */
```

当初の候補値は `--canvas` だけで検証していたため、
背景がより暗いSidebar上（ファイル名など）で不足していた。上記は両方で検証した値。

## U-020 Title / `frontmatter.title` / 本文H1の関係

[DECIDED: U-020]

**Title UIはファイル名から拡張子を除いた文字列**。`frontmatter.title` とは連動しない。

- 本文の `#` は **H1のまま**。Previewでも書き出しHTMLでも降格しない
- 大きなタイトルは画面のchromeであり、文書の見出しではない。書き出しHTMLの見出し構造には含めない
- Title UIの編集はファイルのRenameとして扱う
- Breadcrumbは現状維持（末尾がタイトルと重複してよい）
- Prototypeの「`#` を `h2` へ降格」実装は廃止する

## U-021 Multi-window時の同一ファイル・同一Workspace

[DECIDED: U-021]

同一ファイルは同時に1Windowのみ。既に開いていればそのWindowをfocusする。

## U-022 Conflict / Save error / External deleteのUI

[DECIDED: U-022]

Editor上部のInline bannerで表示する。ModalにもToastにもしない。
`saveState` に `missing` を追加し、conflictからの復帰遷移を定義する。

## U-023 Previewのlink / image / raw HTML

[DECIDED: U-023]

推奨ポリシーを一式採用する。外部linkはOS既定browser、相対 `.md` linkはアプリ内、相対画像はWorkspace内に限り表示、raw HTMLはsanitize、`file://` と外部画像URLは読み込まない。

<details><summary>採用した推奨案の内容</summary>

- 外部link（http / https）: OS既定browserで開く。WebView内では遷移させない
- 相対 `.md` link: アプリ内でそのノートを開く
- 相対画像: Workspace内に限り表示する
- raw HTML: MVPではsanitizeして描画する（scriptと `on*` 属性を除去）
- `file://` と外部画像URL: MVPでは読み込まない

</details>

## U-024 Workspaceのフォルダツリーとignore規則

[DECIDED: U-024]

推奨のfolder tree / ignore / sortルールを採用する。

<details><summary>採用した推奨案の内容</summary>

- 入れ子フォルダをツリー表示する。フォルダ行はDisclosureのみで、常設ボタンを増やさない
- dotfolderと `.quiet/` は既定で非表示。`node_modules/` はignoreする
- 既定の並びは名前順
- 5000ファイル程度までUIが固まらないことをNFRへ追加する
- `Archive` はU-005の論理Archiveなので、フォルダではなくファイル行だけを並べる
  （Prototypeの `2026` 行は誤り）

</details>

## U-025 Find in documentのUI

[DECIDED: U-025]

Editor右上に一時表示するInline find bar。ReplaceはMVP外だが、後続で追加する前提で設計する。

## U-026 Toastの採否と定義

[DECIDED: U-026]

Status bar上にToastを1種類だけ許可する。

## U-027 Split時のscroll同期

[DECIDED: U-027] → **[SUPERSEDED by ADR-012]（2026-09-05）**

~~MVPではSplit scrollを同期しない。将来、行対応の精度を上げたうえで同期Splitを導入したい。~~

**同期する**（設定 `syncScroll`、既定ON）。
下の懸念は「行対応が推定である」ことを前提にしていたが、Previewを自前のASTパイプラインで
組んでいるため、行対応は推定ではなく描画時に確定できる。詳細はADR-012。

## U-028 保存競合検知にcontent hashを使うか

[DECIDED: U-028]

mtime + size + content hashで競合判定する。

hashは最後に読み書きした内容のものをメモリに保持し、ディスク側はwatcherイベント時にだけ再計算する
（Box Drive等のオンデマンド同期で、保存のたびに全体ダウンロードが走るのを避けるため）。

## U-029 ショートカット表記とView切替shortcut

[DECIDED: U-029]

OS別のshortcut表記を実行時に生成する。View切替は `Ctrl/Cmd+1` / `2` / `3`。

## U-030 日本語のword count

[DECIDED: U-030]

既定は文字数。クリックで語数へ切り替える。
