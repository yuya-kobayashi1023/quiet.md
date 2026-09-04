# Open Decisions

> ユーザー判断が必要な事項を一か所に集約する。
>
> **ステータス: 30 / 30 回答済み（2026-09-05）**
> 各項目の `## 決定` が正。`## 推奨案` 以下は決定に至るまでの検討記録として残している。

## Decision table

決定済み。実装はこの表と各節の `## 決定` に従うこと。

| ID | 論点 | 決定 |
|---|---|---|
| U-001 | Workspaceモデル | フォルダWorkspace中心 + 単体`.md`もOpen可 |
| U-002 | Desktop stack | Tauri 2 + React + TypeScript + Rust |
| U-003 | Production editor engine | CodeMirror 6 |
| U-004 | Markdown parser | unified / remark系 |
| U-005 | Archiveの意味 | 論理Archive。ファイルは移動しない（名前は解放されない） |
| U-006 | Titleの正本 | **Title = ファイル名の拡張子抜き**。`frontmatter.title` とは非連動 |
| U-007 | Window title bar | Phase 1はNative decoration |
| U-008 | Autosave delay | 700ms idle debounce。**カーソル位置を保持すること** |
| U-009 | 初期対応OS | Windows first（exe）、macOS next |
| U-010 | External change | File watcher既定ON |
| U-011 | 複数文書 | Tabsなし。New Windowで対応 |
| U-012 | App固有Workspace metadata | `.quiet/workspace.json` を許可 |
| U-013 | Search All | Quick Open / FindはMVP、Search AllはP1 |
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
| U-027 | Split時のscroll同期 | MVPでは同期しない |
| U-028 | 保存競合検知にcontent hashを使うか | mtime + size + content hash |
| U-029 | ショートカット表記とView切替shortcut | OS別表記 + `Ctrl/Cmd+1/2/3` |
| U-030 | 日本語のword count | 既定は文字数。クリックで語数 |

---

# U-001 Workspaceモデル

[DECIDED: U-001]

## 決定

フォルダWorkspace中心。単体 `.md` のOpenも可能。

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

[DECIDED: U-002]

## 決定

Tauri 2 + React + TypeScript + Rust。

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

[DECIDED: U-003]

## 決定

CodeMirror 6。

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

[DECIDED: U-004]

## 決定

unified / remark系。

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

[DECIDED: U-005]

## 決定

論理Archive。実ファイルは移動しない。

Archiveしてもファイル名は解放されない（同一フォルダに同名は作れない）。
これはOSとObsidianと同じ制約として受け入れる。
UUID等の機械的ファイル名は採用しない（U-006の「Title = ファイル名」と両立しないため）。
新規作成時の名前衝突はU-015の連番規則で回避する。

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

[DECIDED: U-006]

## 決定

推奨案を採用しない。**Title UIは常にファイル名から拡張子を除いた文字列**とする（Obsidian方式）。

- `frontmatter.title` はTitle UIの表示に使わない
- Title UIの編集はファイルのRenameとして扱う（U-020参照）
- 既存文書に `title` キーがあってもMetadata Fieldsに表示・保存するだけで、Titleの正本にはしない

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

[DECIDED: U-007]

## 決定

Phase 1はOS Native Title Bar。将来的にCustom title barへ移行する。

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

[DECIDED: U-008]

## 決定

700ms idle debounce + Window blur / Document切替 / `Ctrl+S` / App close前の即時save。

**Autosaveの前後でカーソル位置・選択範囲・スクロール位置を変えないこと。**
保存処理からEditorのstateへ書き戻さない。watcherの自己イベントはU-028のcontent hashで抑制する。

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

[DECIDED: U-009]

## 決定

Windows first（exe配布）。macOS next。

## 推奨案

Windows first。

macOS固有処理をinterfaceで分離しておく。

---

# U-010 External file changes

[DECIDED: U-010]

## 決定

File watcherは既定ON。Cleanは自動Reload、DirtyはConflict。

## 推奨案

File watcherは既定ON。

- LocalがClean → 自動Reload
- LocalがDirty → Conflict UI

---

# U-011 Multi-document behavior

[DECIDED: U-011]

## 決定

Tabsなし。複数文書はNew Window。

## 推奨案

[ADOPTED寄り]

Tabsは使わない。

複数文書を同時比較したい場合は `Open in New Window`。

---

# U-012 App metadata

[DECIDED: U-012]

## 決定

Workspace内 `.quiet/workspace.json` を許可する。

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

[DECIDED: U-013]

## 決定

Quick OpenとCurrent Document FindはMVP。Search AllはP1。

## 推奨案

- Quick Open: MVP
- Current Document Find: MVP
- Search All: P1

---

# U-014 Local history

[DECIDED: U-014]

## 決定

MVPはAtomic write + Crash recoveryまで。履歴UIはLater。

## 推奨案

MVPでは、

- Atomic write
- Crash recovery

まで。

過去版を閲覧するLocal History UIはLater。

---

# U-015 New Noteの初期ファイル名

[DECIDED: U-015]

## 決定

`Untitled.md` を作成して即Rename。衝突時は `Untitled 2.md`。

詳細は `ui/interactions.md` §4。

## 推奨案

`Untitled.md` を一時名として作成し、即Rename UIへ入る。衝突時は `Untitled 2.md`。

## 代替案

`YYYY-MM-DD-HHmm.md`。日付運用のノートでは便利だが、Renameを促す力が弱い。

## 決めない場合の影響

`domain/file-lifecycle.md` §2 の新規作成フローが実装できない。

---

# U-016 新規ファイルの改行コード

[DECIDED: U-016]

## 決定

既存ファイルはLF / CRLFを保持。新規はOSに関係なくLF。

詳細は `domain/document-model.md` §12。

## 推奨案

既存ファイルはLF / CRLFを保持する。新規ファイルはOSに関係なくLF。

## 代替案

Windowsでは新規もCRLF。

## 決めない場合の影響

`architecture/interfaces.md` の `saveDocument` が受け取る `lineEnding` の既定値が決まらない。

---

# U-017 Invalid YAML時の保存可否

[DECIDED: U-017]

## 決定

Invalid YAMLでも保存可。Fields syncのみ停止し、Raw viewに明示Warningを出す。

詳細は `domain/frontmatter.md` §8。

## 推奨案

Invalid YAMLでもMarkdownファイル自体は保存可能にする。Fields syncだけ停止し、Raw viewに明示Warningを出す。

## 理由

Text editorがユーザー入力を拒否しない方が、途中状態のまま離席してもデータを失わない。

## 代替案

Invalid中はAutosaveを止める。データは守られるが、ユーザーは保存されていないことに気づきにくい。

## 決めない場合の影響

Autosave coordinatorがFront Matterのparse結果に依存するかどうかが決まらない。

---

# U-018 Front Matterがない文書のMetadata UI

[DECIDED: U-018]

## 決定

Front Matterがなければ `Metadata` summaryを表示しない。More menuの `Add metadata` で挿入する。

詳細は `domain/frontmatter.md` §11。

## 推奨案

Front Matterがない場合、`Metadata` summary自体を表示しない。More menuの `Add metadata` で初めて挿入する。

## 決めない場合の影響

「開いただけで書き換えない」原則（`product/principles.md` §5）を守れるかどうかが実装者判断になる。

---

# U-019 Light themeのコントラスト

[DECIDED: U-019]

## 決定

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

## 論点

`quality/non-functional-requirements.md` §7 と `quality/acceptance-criteria.md` M はWCAG相当のContrastを要求しているが、
現在のLight tokenは満たしていない。実測値（WCAG 2.x contrast ratio、背景は `--canvas` #f7f7f4）:

| Token | 実測 | 主な用途 | 判定 (4.5:1) |
|---|---:|---|---|
| `--text-subtle` #a1a19f | 2.41 | Status bar、Metadata summary、placeholder（9.8–12px） | 不合格 |
| `--accent` #f54e00 | 3.28 | Preview内のlink | 不合格 |
| `--text-secondary` #84847e | 3.33 | Sidebarのファイル名（12px） | 不合格 |
| `--text-muted` #7a7974 | 4.06 | Section label、setting hint | 不合格 |
| `--syntax-marker` #a36a43 | 4.16 | Markdown記号 | 不合格 |
| `--text-editor` #34332d | 11.80 | Markdown本文 | 合格 |

Darkは同じ役割がすべて3.89–12.26で、概ね基準を満たしている。問題はLightに偏っている。

## 推奨案

Lightの小さい文字に使うroleだけ暗くする。色相を維持したまま輝度を落とした候補:

```css
--text-subtle:    #71716f;  /* 4.56:1 */
--text-secondary: #72726d;  /* 4.50:1 */
--text-muted:     #72716c;  /* 4.56:1 */
--syntax-marker:  #9b6540;  /* 4.52:1 */
--accent-text:    #cb4100;  /* 4.55:1 — link等の文字用。dot等の非文字は #f54e00 のまま */
```

ただしこの案では subtle / secondary / muted が #71–#72 帯へ収束し、Lightの3段テキスト階層が事実上1段になる。

## 代替案

A. 4.5:1を満たさないroleは「読めなくても操作に支障がない装飾テキスト」に限定し、
   Status barやSidebarのファイル名など意味のあるテキストには使わないと決める。

B. 目標をAA Large相当へ緩め、代わりに該当箇所のfont sizeを上げる
   （`--text-subtle` を 9.8–10.5px で使うのをやめる）。

C. 現状の見た目を優先し、NFR §7 と AC-M からWCAG要求を明示的に下げる。

## 決めない場合の影響

`quality/acceptance-criteria.md` M が実装完了時点で必ず失敗する。
Tokenを後から暗くすると、Prototypeで確認した「静けさ」の印象が実装後に変わる。

---

# U-020 Title / `frontmatter.title` / 本文H1の関係

[DECIDED: U-020]

## 決定

**Title UIはファイル名から拡張子を除いた文字列**。`frontmatter.title` とは連動しない。

- 本文の `#` は **H1のまま**。Previewでも書き出しHTMLでも降格しない
- 大きなタイトルは画面のchromeであり、文書の見出しではない。書き出しHTMLの見出し構造には含めない
- Title UIの編集はファイルのRenameとして扱う
- Breadcrumbは現状維持（末尾がタイトルと重複してよい）
- Prototypeの「`#` を `h2` へ降格」実装は廃止する

## 論点

タイトルの候補が3つあるのに、優先順位と見出しレベルが定義されていない。

- Editor上部の大きなTitle UI
- `frontmatter.title`
- 本文先頭の `# Heading`

`domain/document-model.md` §1 の `titleSource` には `"heading"` があるが、U-006はfrontmatter / filenameしか扱っていない。

現Prototypeは次の実装になっており、これは仕様として合意されていない。

- Previewは常に `<h1>{Title UIの値}</h1>` を描画する
- 本文の `# X` を `<h2>` へ降格する（`ui/ui-mockup.html` の `renderMarkdown`）
- TOCも同じ降格を前提にレベルを+1している

## 推奨案

Title UIを「文書のH1」と定義し、本文の `#` をH1として扱わないことを明示的に決める。
そのうえで、本文に `# X` が既にある文書を開いたときの挙動を決める。

1. `frontmatter.title` があればTitle UIに出す
2. なければ本文先頭のH1をTitle UIに出し、`titleSource = "heading"` とする
3. その状態でTitle UIを編集したら、本文のH1行を書き換える（Front Matterは追加しない）
4. どちらもなければfilename stemをplaceholder表示する（U-006の通り）

## 代替案

Title UIは常に `frontmatter.title` 専用とし、本文H1には触れない。
この場合、H1を持つ既存文書ではPreviewに見出しが2つ並ぶことを許容する。

## 決めない場合の影響

- Previewの見出しレベルが本文と食い違い、Export HTMLとScreen readerの見出し構造が壊れる
- TOCの階層が文書の実構造と一致しない
- 既存Markdown資産を開いたときに、意図しないH1の重複が起きる

---

# U-021 Multi-window時の同一ファイル・同一Workspace

[DECIDED: U-021]

## 決定

同一ファイルは同時に1Windowのみ。既に開いていればそのWindowをfocusする。

## 論点

U-011はTabsを採用しない代わりに `Open in New Window` を前提にしており、
`ui/desktop-ux.md` §7 は「各Windowは同じWorkspaceを共有可能」とだけ書いている。次が未定義。

- 同じファイルを2つのWindowで開けるか
- 開けるなら、片方のsaveをもう片方はExternal changeとして扱うのか（自分自身との競合）
- `.quiet/workspace.json` を2つのWindowが同時に書いたときの調停
- Archive操作が他Windowのサイドバーへ反映されるか

## 推奨案

- 同一ファイルは同時に1Windowだけとし、既に開いていればそのWindowをfocusする
- `.quiet/workspace.json` の書込みは単一プロセス内で直列化する
- Workspace stateの変更は他Windowへ通知する

## 代替案

同一ファイルの複数Window表示を許可し、内部的にDocumentを共有する（Buffer共有）。
実装コストは上がるが、比較用途では自然。

## 決めない場合の影響

Tabsを持たない本アプリで、複数文書を扱う唯一の導線の挙動が決まらない。
watcherのself-save suppression（`architecture/architecture.md` §10）をWindow単位とProcess単位のどちらにするかも決められない。

---

# U-022 Conflict / Save error / External deleteのUI

[DECIDED: U-022]

## 決定

Editor上部のInline bannerで表示する。ModalにもToastにもしない。
`saveState` に `missing` を追加し、conflictからの復帰遷移を定義する。

## 論点

`quality/acceptance-criteria.md` K と `domain/file-lifecycle.md` §6・§11・§12 はこれらのUIを必須にしているが、
`ui/ui-spec.md` §15 は「通常状態より強い表示を許可する」としか書いておらず、置き場所も形も決まっていない。
本アプリで最もデータ損失に近い経路が、唯一UIデザインされていない。

あわせて `domain/document-model.md` §1 の `saveState` には、
外部削除された状態（`missing`）と、conflictからの復帰遷移が存在しない。

## 推奨案

Editor surfaceの最上部（Metadata summaryの上）に、Inline bannerを1本だけ許可する。

```text
⚠ このファイルはエディタの外で変更されました
   差分を見る    自分の変更を残す    ディスクから再読込
```

- Modalにしない（入力を止めない）
- Toastにしない（消えてはいけない）
- `saveState` に `missing` を追加し、conflict → clean / dirty の復帰遷移を明記する

## 代替案

Modalで強制的に選ばせる。確実だが、`product/principles.md` §8（Reversible over confirm-everything）と衝突する。

## 決めない場合の影響

AC-Kが検証不能。実装者ごとにModal / Toast / Status barへ散らばる。

---

# U-023 Previewのlink / image / raw HTML

[DECIDED: U-023]

## 決定

推奨ポリシーを一式採用する。外部linkはOS既定browser、相対 `.md` linkはアプリ内、相対画像はWorkspace内に限り表示、raw HTMLはsanitize、`file://` と外部画像URLは読み込まない。

## 論点

`product/requirements.md` §3.3 のPreview対応要素に画像がない。
また、link clickとraw HTMLの扱いが決まっていない。
`quality/non-functional-requirements.md` §6 は「Unsafe HTML preview」「`file://` link handling」を挙げるだけで仕様がない。

Tauri実装では次が直接効いてくる。

- WebView内で外部linkを開くとアプリ画面自体が遷移して壊れる
- 相対パス画像は `convertFileSrc` 相当の変換とCSP設定が必要
- 相対パスの `.md` linkをアプリ内で開くかどうかでNavigation設計が変わる

## 推奨案

- 外部link（http / https）: OS既定browserで開く。WebView内では遷移させない
- 相対 `.md` link: アプリ内でそのノートを開く
- 相対画像: Workspace内に限り表示する
- raw HTML: MVPではsanitizeして描画する（scriptと `on*` 属性を除去）
- `file://` と外部画像URL: MVPでは読み込まない

## 決めない場合の影響

Markdownエディタとして画像が表示されないまま実装が進む。
リンククリックでアプリが壊れる不具合が、実装後に見つかる。

---

# U-024 Workspaceのフォルダツリーとignore規則

[DECIDED: U-024]

## 決定

推奨のfolder tree / ignore / sortルールを採用する。

## 論点

U-001は `docs/design.md` のような入れ子フォルダを持つWorkspaceを推奨しているが、
`ui/ui-spec.md` §2 のSidebarは `Notes` / `Archive` のフラット2区分しか定義していない。
Prototypeの `Archive` 配下には `2026` というフォルダ行があり、U-005（論理Archive）とも食い違っている。

未定義:

- 入れ子フォルダをツリー表示するか、フラット表示するか
- フォルダの展開状態を保持するか
- ignore規則（`.git/`、`node_modules/`、dotfolder、`.quiet/` 自体）
- 並び順（名前順 / 更新順）
- 大きなWorkspace（1000ファイル超）での性能。
  `quality/non-functional-requirements.md` は大きなファイルしか扱っていない

## 推奨案

- 入れ子フォルダをツリー表示する。フォルダ行はDisclosureのみで、常設ボタンを増やさない
- dotfolderと `.quiet/` は既定で非表示。`node_modules/` はignoreする
- 既定の並びは名前順
- 5000ファイル程度までUIが固まらないことをNFRへ追加する
- `Archive` はU-005の論理Archiveなので、フォルダではなくファイル行だけを並べる
  （Prototypeの `2026` 行は誤り）

## 決めない場合の影響

既存のノートフォルダやリポジトリを開いた瞬間に、Sidebarが破綻するか、サブフォルダのファイルが見えない。

---

# U-025 Find in documentのUI

[DECIDED: U-025]

## 決定

Editor右上に一時表示するInline find bar。ReplaceはMVP外だが、後続で追加する前提で設計する。

## 論点

`Ctrl/Cmd+F` は `product/requirements.md` §4 のP0だが、
UI仕様・インタラクション仕様がなく、ACも `C. Editor` の「Find」1行だけ。
常設UIを増やさない原則と最も衝突しやすい機能である。

## 推奨案

Editor paneの右上に、開いている間だけ存在するInline find barを出す。

```text
[ query            ]  3/12   ↑ ↓   Aa  .*   ✕
```

- Escで閉じる
- ReplaceはMVP外
- Command Paletteとは別物として扱う（`Ctrl/Cmd+K` はコマンド、`Ctrl/Cmd+F` は現在文書）

## 決めない場合の影響

CodeMirror 6の標準search panelがそのまま出て、Design systemから浮いたUIになる。

---

# U-026 Toastの採否と定義

[DECIDED: U-026]

## 決定

Status bar上にToastを1種類だけ許可する。

## 論点

`ui/interactions.md` §12（Archive Undo）と §14（Updated from disk）はToastを前提にしているが、
`ui/ui-spec.md` にも `ui/design-system.md` にもToastコンポーネントの定義がない。
位置・表示時間・同時表示数・reduced motion時の扱いが未定義。

## 推奨案

Toastを1種類だけ定義して許可する。

- 位置: Status barのすぐ上、左寄せ
- 同時表示: 1件のみ（新しいものが置き換える）
- 表示時間: Actionを持つ場合6秒、持たない場合3秒
- Actionは最大1つ（`Undo` など）
- データ損失に関わる通知はToastにしない（U-022のInline banner）

## 代替案

Toastを持たず、Archive UndoはCommand Paletteの `Undo archive` に寄せる。
UIは増えないが、Undoの存在に気づけない。

## 決めない場合の影響

`product/principles.md` §8（Reversible over confirm-everything）を支える唯一の導線が実装されない。

---

# U-027 Split時のscroll同期

[DECIDED: U-027]

## 決定

MVPではSplit scrollを同期しない。将来、行対応の精度を上げたうえで同期Splitを導入したい。

## 論点

`ui/ui-spec.md` §6 は「それぞれ独立スクロール」と書いているが、
これが「同期しない」という決定なのか、単にスクロールコンテナの数の話なのかが読み取れない。
Split viewの体験を最も左右する項目である。

## 推奨案

MVPでは同期しない。行対応の推定が外れたときに勝手にスクロールする方が邪魔になるため。
TOCからの移動だけが両ペインを動かす（`ui/interactions.md` §7 の通り）。

## 代替案

Editor → Preview片方向の同期をSettingsで任意ONにする。

## 決めない場合の影響

実装者が善意で同期を入れる可能性が高く、後から外すと使用感が変わる。

---

# U-028 保存競合検知にcontent hashを使うか

[DECIDED: U-028]

## 決定

mtime + size + content hashで競合判定する。

hashは最後に読み書きした内容のものをメモリに保持し、ディスク側はwatcherイベント時にだけ再計算する
（Box Drive等のオンデマンド同期で、保存のたびに全体ダウンロードが走るのを避けるため）。

## 論点

`architecture/interfaces.md` §3 の `saveDocument` は `expectedRevision = { modifiedAt, size }` で競合を判定する。
しかしこの2つだけでは次を取りこぼす。

- 同じバイト数の外部編集（1文字置換など）
- ファイルシステムのmtime粒度（環境によっては1〜2秒）内に起きた変更
- クラウド同期フォルダ（OneDrive等）がmtimeを書き換えるケース

`domain/document-model.md` §10 は content hash を optional と書いているだけ。

## 推奨案

`expectedRevision` に content hash を加え、hashが一致する限り競合としない。
Windows firstかつOneDrive配下の利用を想定するなら、必須に近い。

## 決めない場合の影響

「Dirtyな内容で外部変更を黙って上書きしない」（`domain/file-lifecycle.md` §11）が、条件次第で破れる。

---

# U-029 ショートカット表記とView切替shortcut

[DECIDED: U-029]

## 決定

OS別のshortcut表記を実行時に生成する。View切替は `Ctrl/Cmd+1` / `2` / `3`。

## 論点

- U-009はWindows firstだが、PrototypeのSettingsとCommand Paletteは `⌘ K` `⌘ B` などmacOS表記のまま
- `product/requirements.md` §4 のP0一覧に `Ctrl+N` と `Ctrl+W` がなく、`ui/desktop-ux.md` §5 の表とずれている
- Write / Split / Read の切替shortcutがどこにも定義されていない
  （Prototypeのpaletteには `⌘⇧P` と書かれている）

## 推奨案

- shortcut表記はプラットフォームから生成する（Windowsでは `Ctrl+K`）。UIへハードコードしない
- `ui/desktop-ux.md` §5 の表を唯一の正とし、requirementsからは参照だけにする
- View切替は `Ctrl/Cmd+1` / `2` / `3`

## 決めない場合の影響

Windows版に `⌘` が表示される。ショートカット表が2か所でずれたまま実装される。

---

# U-030 日本語のword count

[DECIDED: U-030]

## 決定

既定は文字数。クリックで語数へ切り替える。

## 論点

`ui/ui-spec.md` §12 はStatus barに Word count を出すと決めているが、日本語では語数がほぼ意味を持たない。
Prototypeは連続するCJKを1語として数えるため、日本語文書では実質的に無意味な数字になる。

## 推奨案

既定を文字数にし、クリックで語数へ切り替える（Status barの既存の場所で完結させる）。

## 決めない場合の影響

日本語ノートで常に誤った数字が出続ける。
