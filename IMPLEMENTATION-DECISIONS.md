# 実装中に私（AI）が独断で決めたこと

> ユーザー確認を取らずに進めた判断の記録。あとでまとめて確認してもらうためのもの。
> 仕様書（`.specs/`）で決まっていたことは、ここには書かない。ここにあるのは**仕様に書かれていなかった判断**だけ。
>
> - `[AUTO-xxx]` … 私が決めたもの。要確認。
> - **High** … あとで変えると作り直しが発生するもの。先に見てほしい。

## 一覧

| ID | 判断 | 重要度 |
|---|---|---|
| AUTO-001 | アプリをリポジトリのルート直下に置く | Low |
| AUTO-002 | Vite + React 19 + TypeScript を手書きで scaffold | Low |
| AUTO-003 | 状態管理ライブラリを入れず React 標準で始める | Medium |
| AUTO-004 | パッケージ名・アプリ識別子を `quiet-md` / `com.quiet-md.app` に | **High** |
| AUTO-005 | `workspace-service` を追加（architecture のモジュール一覧にない） | Low |
| AUTO-006 | Tauri の外で動かすためのフォールバックを用意した | Medium |
| AUTO-007 | ignore 対象に `target` `dist` `build` を追加 | Medium |
| AUTO-008 | Workspace 走査の上限を 20,000 ファイル / 深さ 16 に | Medium |
| AUTO-009 | content hash に blake3 を採用 | Low |
| AUTO-010 | crash recovery の snapshot 間隔を 4 秒に | Low |
| AUTO-011 | Editor は本文だけを扱い、Front Matter は Metadata UI が持つ | **High** |
| AUTO-012 | 文字数の定義を「空白と改行を除いた文字数」に | Low |
| AUTO-013 | Duplicate のファイル名を `name copy.md` に | Low |
| AUTO-014 | Undo 付き Toast は Archive だけに使う | Low |
| AUTO-015 | Quick Open と Command Palette を 1 つの入口に統合 | Medium |
| AUTO-016 | 見出し id の prefix を sanitize の既定のままにした | Low |
| AUTO-017 | ESLint を入れていない | Medium |
| AUTO-018 | UI 文言を日本語にした | **High** |
| AUTO-019 | Window の初期サイズを 1200×820 に | Low |
| AUTO-020 | Windows インストーラを NSIS / ユーザー単位に | Medium |
| AUTO-021 | Rename 失敗時は元の名前へ戻し、inline error を出す | Low |
| AUTO-022 | 箇条書きで番号付きリストの番号を進め、task list は未チェックで継ぐ | Low |
| AUTO-023 | リストの depth をインデント幅ではなく実際の構造から数える | Medium |
| AUTO-024 | 範囲選択中と IME 変換中はリスト編集に介入しない | Medium |
| AUTO-025〜031 | 2026-09-05 の改修分。末尾の「追加分」を参照 | — |

**まだ実装していないもの**は末尾の「未実装リスト」を参照。

---

## AUTO-001 リポジトリ構成

`.specs/` と同じリポジトリのルート直下にアプリを置く。

```text
quiet.md/
├─ .specs/          仕様書
├─ src/             Frontend
├─ src-tauri/       Rust
└─ package.json
```

単一アプリのリポジトリで `apps/` のような階層を先に作る理由がないため（YAGNI）。
`architecture/architecture.md` §3 のモジュール構成はそのまま `src/` 配下へ適用した。

## AUTO-002 scaffold 方法

`npm create vite` は対話プロンプトが出て非対話実行が不安定なため、
`package.json` / `vite.config.ts` / `tsconfig.json` / `index.html` を直接書いた。
生成物は create-vite の react-ts テンプレートと同等。

React は執筆時点の最新（19系）。仕様書はバージョンを指定していない。

## AUTO-003 状態管理

`architecture/architecture.md` §7 の「Global state library を最初から大きく入れすぎない」に従い、
Redux / Zustand / Jotai を入れず、`useSyncExternalStore` と小さな Store クラスだけで始めた。

必要になれば差し替えられる。変更コストは中程度。

## AUTO-004 名前と識別子 — **要確認**

- npm package name: `quiet-md`
- Rust crate: `quiet-md`
- Tauri identifier: `com.quiet-md.app`
- productName / Window title: `Quiet`

仕様書にプロダクト名の正式表記がなかったため、リポジトリ名から機械的に決めた。
**identifier は配布後に変えるとアップデート経路が切れる**ので、リリース前に確定してほしい。

## AUTO-005 workspace-service の追加

`architecture/architecture.md` §3 の services は
`document-service` / `settings-service` / `native-bridge` の 3 つだが、
ファイル一覧・フォルダツリー・Archive 状態の置き場が無かったため `workspace-service` を足した。

document-service に混ぜると、1 文書の責任と Workspace 全体の責任が混ざるため。

## AUTO-006 ブラウザ用フォールバック

`src/services/native-bridge/browser-fallback.ts`。

Tauri の外（ブラウザ / テスト）では、メモリ上の偽 Workspace へ落ちる。
用途は「UI を目視確認する」と「Document service のテストを回す」の 2 つだけで、
本番では `isNative()` が true になるため使われない。

これがないと、UI の確認に毎回デスクトップアプリのビルドが必要になる。

## AUTO-007 ignore 対象

U-024 で決まったのは dotfolder / `.quiet/` / `node_modules/` の 3 つ。
実装では `target` `dist` `build` `.git` も足した。
Rust / フロントエンドのリポジトリを Workspace として開いたときに、
ビルド生成物の Markdown を拾わないため。

## AUTO-008 走査の上限

- 最大 20,000 ファイル
- 最大深さ 16

U-024 の NFR は「5000 ファイル程度で固まらないこと」なので、
その 4 倍を打ち切り点にした。超えた場合は `truncated: true` を返す（UI は未対応）。

## AUTO-009 content hash に blake3

U-028 は hash を必須にしたがアルゴリズムを指定していない。
SHA-256 より速く、5MB の文書でも保存のたびに計算しても体感に響かないため blake3 にした。
暗号学的な用途ではなく変更検知なので、この選択で問題ない。

## AUTO-010 recovery snapshot の間隔

4 秒。U-014 は「短周期 Snapshot」としか書いていない。
Autosave が 700ms なので、通常はそちらが先に走る。
snapshot が要るのは「保存できていない状態が続いているとき」なので、頻度は低くてよいと判断した。

## AUTO-011 Editor は本文だけを扱う — **要確認**

Editor（CodeMirror）に渡すのは Front Matter を除いた本文だけで、
Front Matter は Metadata UI が持つ。保存時に結合して 1 つのファイルへ戻す。

理由: 両方に生の YAML を出すと、ADR-002 の「Metadata として折りたたむ」意味がなくなるため。
プロトタイプも同じ構造だった。

ただし副作用がある。**Editor の Ctrl+F は本文だけを検索し、Front Matter は対象外**になる。
Metadata を開いて Raw で編集する必要がある。

## AUTO-012 文字数の定義

U-030 で「既定は文字数」と決まったが、何を数えるかは未定だった。
**空白と改行を除いた文字数**にした。日本語の原稿量の目安として実用的なため。
語数モードは英数字の連続と CJK 1 文字を 1 語として数える。

## AUTO-013 Duplicate のファイル名

`note.md` → `note copy.md` → `note copy 2.md`。
仕様書に規則がなかった。Explorer の「- コピー」ではなく、
U-015 の `Untitled 2.md` と同じ「スペース + 連番」に揃えた。

## AUTO-014 Toast の使いどころ

U-026 で Toast は 1 種類だけ許可された。実際に使っているのは次だけ。

- Archive（Undo 付き、6 秒）
- Duplicate / Copy Path / 各種操作の失敗（Action なし、3 秒）

保存失敗・競合・外部削除は Toast ではなく Inline banner（U-022）。

## AUTO-015 Quick Open と Command Palette の統合

`interactions.md` §10 に「将来的に統合してよい」とあったので、最初から統合した。

- `Ctrl+K` と `Ctrl+P` は同じパレットを開く
- 入力なし → コマンドを先に表示
- 入力あり → ファイルを先に表示
- `>` で始めるとコマンドだけに絞る

**別々の UI にしたい場合は分離が必要。**

## AUTO-016 見出し id の prefix

`rehype-sanitize` の既定で見出し id に `user-content-` が付く（DOM clobbering 対策）。
これを外さず、TOC 側が prefix を付けて参照するようにした。
`HEADING_ID_PREFIX` として 1 か所に定義してある。

## AUTO-017 ESLint を入れていない — **要確認**

`npm run check` は typecheck（TypeScript strict）と vitest だけ。
TypeScript の strict 設定（`noUncheckedIndexedAccess` 等）でかなり拾えるため、
初期段階では ESLint の設定に時間を使わない判断をした。

**入れるなら早い方が良い。**あとから入れると既存コード全体に警告が出る。

## AUTO-018 UI 文言を日本語にした — **要確認**

プロトタイプの UI 文言は英語だったが、実装では日本語にした
（「新規ノート」「設定」「この文書内を検索」など）。

理由: 使うのが日本語話者であるため。
ただし次は英語のまま残している。

- `Notes` / `Archive` のセクション見出し
- `Write` / `Split` / `Read`
- `Metadata` / `Fields` / `Raw`
- `Settings` の見出しと `Done`

プロトタイプの見た目を保つため、画面の骨格に当たる短い語は英語のままにした。
**全部英語に戻す / 全部日本語にする、どちらでも変更可能。**

## AUTO-019 Window の初期サイズ

1200×820。最小は desktop-ux.md §13 の通り 760×520。
初期サイズの指定が仕様書になかった。

## AUTO-020 Windows インストーラ

NSIS、`currentUser` インストール（管理者権限を求めない）。
`architecture.md` §14 は「MSI / NSIS 等」としか書いていない。

## AUTO-021 Rename 失敗時の挙動

Title を編集して確定 → 失敗（同名衝突・禁止文字・権限）した場合、
**表示を元のファイル名へ戻し、タイトルの下に inline error を出す。**

`file-lifecycle.md` §7 は「Inline error」とだけ書いていて、
入力を残すか戻すかが未定だった。戻す方を選んだのは、
画面のタイトルとディスク上のファイル名が食い違う状態を作らないため（U-006 の前提）。

## AUTO-022 箇条書きの付随挙動

仕様として指示されたのは Enter / Tab / Shift+Tab の 5 遷移だけ。
「一般的な Markdown エディタと同様」に含まれると判断して、次も実装した。

- 番号付きリスト（`1.` `3)`）は Enter で番号を 1 つ進める
- task list（`- [x] `）は Enter で **未チェック**の項目を作る
- marker の種類（`-` `*` `+`）を引き継ぐ

番号の振り直し（途中に挿入したときに後続を再採番する）は**していない**。
既存の行を書き換える範囲が広く、Undo の粒度も荒くなるため。

## AUTO-023 depth の数え方

「インデント幅 ÷ 2」のような固定計算にせず、
**直前の連続したリスト行を遡って、自分より浅いインデントが何種類あるか**で depth を数える。

2 スペースでも 4 スペースでも、タブでも同じように動く。
Obsidian や VS Code で書かれた既存のノートを開いたときに崩れないため。

副作用として、親のない `  - item`（いきなり 2 スペースで始まるリスト）は depth 0 と判定される。
このとき空項目で Enter を押すと、outdent ではなくリスト終了になる。

## AUTO-024 介入しない条件

次の 2 つでは Enter / Tab を横取りせず、CodeMirror の既定動作へ譲る。

- **IME 変換中**（`view.composing`）。Enter は変換確定に使われるため
- **範囲選択中**。複数行のインデントは既定の `indentMore` に任せる

## 実装中に見つけた不具合（修正済み）

`@codemirror/lang-markdown` は Enter に独自のリスト継続処理を持っている。
そちらが先に走ると、空のネストされた項目で Enter を押したときに
**空行が残り、階層も浅くならなかった**（仕様が禁じている状態そのもの）。

キーマップの優先順位を `Prec.highest` にし、`markdown()` より前へ置いて解決した。
順序を戻すと再発するため、`src/features/editor/list-keymap.test.ts` で
実際の EditorView を作って優先順位ごと固定している。

---

## 未実装リスト

MVP に含まれるが、まだ手を付けていないもの。

| 項目 | 仕様 | 状態 |
|---|---|---|
| Drag & Drop で `.md` を開く | desktop-ux.md §3 | 未実装 |
| ウィンドウを閉じるときの保存確認 | file-lifecycle.md §13 | 未実装（Autosave のみ） |
| Crash recovery の復元 UI | U-014 | snapshot の書き込みだけ実装。起動時に提示していない |
| 単体 `.md` ファイルを開く導線 | U-001 | **実装済み**（`Ctrl+O` / Recent） |
| `Open in New Window` の受け側 | U-021 | **実装済み**（ADR-013） |
| File association | ~~requirements §4 P1~~ ADR-013 | **実装済み**（インストール後の動作は未検証） |
| TOC の active heading 追従 | ui-spec.md §10 | 一覧と移動は動く。スクロール追従は未実装 |
| Settings の Default location | requirements §3.7 | UI 未実装 |
| Search All | ~~U-013（P1）~~ ADR-011 | **実装済み**（`Ctrl+Shift+F`） |
| macOS 対応 | U-009 | 仕様通り後回し。Rust 側は分岐済み |

## 検証状況

- `cargo test`: 15 passed（改行コード・BOM 保持、atomic save、Windows のファイル名検証、ignore 規則）
- `npm run check`（typecheck + vitest）: 97 passed（Front Matter の lossless、Markdown、save state machine、フォルダツリー、箇条書きの階層編集）
- ブラウザでの目視: Light / Dark、Write / Split、Metadata、Find bar、Command Palette、箇条書きの 5 遷移
- **デスクトップアプリとしての起動は未確認。**`npm run tauri:dev` はまだ実行していない
- IME での日本語入力は未確認（test-strategy.md §5 は手動確認必須としている）

---

## 追加分（2026-09-05・6項目の改修）

このセッションで入れた判断。仕様側の変更は ADR-009〜012 に書いたので、ここには
**仕様に書かれていなかった細かい判断**だけを残す。

| ID | 判断 | 重要度 |
|---|---|---|
| AUTO-025 | コードの色は5役に固定し、割り当てのない token は本文色のまま残す | Medium |
| AUTO-026 | `rehype-highlight` の `common`（約37言語）をそのまま同梱する | Medium |
| AUTO-027 | Window controls の Close だけ hover 色を変える | Low |
| AUTO-028 | Search All の下限を2文字、debounce を220msに | Low |
| AUTO-029 | Search All の結果からReadモードで飛ぶとSplitへ切り替える | Medium |
| AUTO-030 | 同期スクロールの基準を画面上端ではなく72px下に | Low |
| AUTO-031 | `searchKeymap` を丸ごと入れるのをやめた（既存不具合の修正） | Medium |

## AUTO-025 コードの色は5役

highlight.js は40以上の scope を、CodeMirror の lezer はさらに多くの tag を出す。
全部に色を割り当てるとIDEの見た目になり、`ui-spec.md` §8 の
「本文自体を多色にしすぎない」と衝突する。

keyword / string / number / comment / entity の5役だけを塗り、
それ以外は本文色のまま残す。**これは抜けではなく既定**。
Editor（`extensions.ts`）と Preview（`preview.css`）で同じ役割分けを使う。

## AUTO-026 highlight.js の同梱範囲

`rehype-highlight` の既定（`common`、約37言語）をそのまま使う。
Editor 側（`@codemirror/language-data`）は dynamic import なので起動時のバンドルに
載らないが、Preview 側は同期的に載る。ビルド後の main chunk は 933 kB（gzip 305 kB）。

ローカルから読むデスクトップアプリなので、この増分は受け入れる。
気になるなら `languages` オプションで絞れる。

## AUTO-027 Close ボタンだけ hover 色を変える

最小化・最大化は押し間違えても戻せるが、Close は戻せない。
Windows の慣習に合わせ、Close の hover を `#c42b1c` にする。
これは design token に入れていない。**OS の慣習であってアプリの配色ではない**ため。

## AUTO-028 Search All の下限と debounce

1文字での検索は Workspace 全体を舐めるだけで役に立たないので、2文字以上とした。
debounce は220ms。日本語入力の変換確定より短く、連続打鍵よりは長い。

どちらも計測して決めた値ではない。実測したら変える。

## AUTO-029 Read モードで検索結果を開いたとき

Read では Editor が `display: none` なので、行へ飛んでもユーザーには何も
起きていないように見える。Split へ切り替える。

View mode を勝手に変えるのは本来避けたいが、「何も起きない」よりはよいと判断した。
Write モードのときは変えない（Editor が見えているため）。

## AUTO-030 同期スクロールの基準位置

画面上端の行ではなく、72px 下の行を基準に合わせる。
上端ちょうどの行は視界に入りにくく、「今読んでいる行」と一致しないため。

## AUTO-031 `searchKeymap` を外した — **既存不具合の修正**

`searchKeymap` には `Mod-f` → `openSearchPanel` が含まれており、
`Ctrl+F` でも `Ctrl+Shift+F` でも CodeMirror 標準の search panel が開いていた。
`FindBar.tsx` の冒頭コメントは「標準 panel は使わない」と書いているのに、
実際には Find bar と標準 panel が同時に出ていた。

panel を開かない `Mod-d` / `Mod-Shift-l` だけを残した。

## 検証状況（2026-09-05 更新）

- `cargo test`: 25 passed（うち search が10件）
- `npm run check`（typecheck + vitest）: 122 passed
- ブラウザでの目視（`npm run dev`）で確認したもの:
  - タイトル Enter → Rename 後に本文へ focus が移る（`activeElement` が `cm-content`）
  - Dark / Light の選択色。Editor / Preview の両方
  - コードブロックのハイライト。Editor / Preview、ts / python / rust
  - Search All の検索・キーボード移動・行への移動（Front Matter の行数を引いた位置）
  - 同期スクロール（コードブロックと表をまたいで対応が保たれること）
  - Settings の「スクロールを同期」トグル
- **Custom title bar は Tauri でしか出ない部分（drag / window controls / undecorated
  window のリサイズと Aero Snap）を目視していない。** ブラウザでは `isNative()` が
  false になり Window controls を描かないため。`npm run tauri:dev` での確認が必要
- IME での日本語入力は引き続き未確認

---

## 追加分（2026-09-06・関連付け起動と Recent）

仕様側の判断は ADR-013 に書いた。ここには**仕様にも ADR にも書いていない細かい判断**だけを残す。

| ID | 判断 | 重要度 |
|---|---|---|
| AUTO-032 | `Ctrl+O` を「ファイルを開く」に割り当てた | Low |
| AUTO-033 | Recent の表示件数の選択肢を 3 / 5 / 8 / 12 / 20 / 30、既定 8 にした | Low |
| AUTO-034 | Workspace を指定して起動したときは「前回のノート」を開かない | Medium |
| AUTO-035 | `useTruncationTooltip` に `always` オプションを足した | Low |
| AUTO-036 | ブラウザのフォールバックに Workspace 外のサンプルと初期 Recent を入れた | Low |
| AUTO-037 | ``` を打つと閉じの ``` を補完する。介入条件は下記 | Medium |

## AUTO-032 `Ctrl+O` を「ファイルを開く」に割り当てた

U-029 のショートカット表に `Ctrl+O` はない。OS 共通の慣習であり、
既存の割り当てと衝突しないのでそのまま採った。Command palette にも同じ項目を出している。

## AUTO-033 Recent の表示件数

上限 30 件を保持し、Sidebar に出す件数だけを設定にした（既定 8）。
0 件を選べるようにはしていない。0 にしたい場合は「Recent を使わない」という別の要望であり、
表示件数の選択肢に混ぜると意味が二重になる。

## AUTO-034 Workspace 指定起動では前回のノートを開かない

フォルダを Quiet で開いたときは、Workspace を開くところで止める。
「このフォルダを見たい」という意図に対して、前回どこかで編集していた別の文書を
勝手に開くのは応答としてずれている。ファイルを指定した場合はそのファイルを開く。

## AUTO-035 `useTruncationTooltip` の `always`

Recent の行は、ファイル名が省略されていなくてもフルパスを見せたい。
同名のファイルが別のフォルダから並びうるため。既存の呼び出しの挙動は変えていない。

## AUTO-036 フォールバックのサンプル

Workspace 外のファイル（`/downloads/meeting-notes.md`、`/repo/README.md`）と、
それを指す初期 `recentFiles` をフォールバックへ入れた。
ブラウザで Recent を目視確認するためのもの。`resetFallback()` は従来どおり空へ戻すので、
テストの前提は変わらない。

## 検証状況（2026-09-06 更新）

- `cargo test`: 29 passed（うち起動引数の解釈が4件）
- `npm run check`（typecheck + vitest）: 132 passed（うち Recent の履歴操作が10件）
- ブラウザでの目視（`npm run dev`）で確認したもの:
  - Sidebar の Recent セクション（Notes / Archive の下、フラット、active 表示、フルパス Tooltip）
  - Recent の行を開く → Breadcrumb が Workspace 名ではなく親フォルダ名になる
  - 消えたファイルの行を開く → トーストを出して履歴から消える
  - Recent の Context menu の項目
  - Settings の「Recent の表示件数」
  - `?path=` 付きで開くと、Workspace を復元したうえでそのファイルを開く
  - `?workspace=` 付きで開くと、その Workspace を開いて文書は開かない
- **未検証（デスクトップでしか確認できない）**:
  - 関連付けからのダブルクリック起動（インストーラでの拡張子登録を含む）
  - 二重起動時の argv 受け渡しと Window の選び方（single instance）
  - macOS の `RunEvent::Opened`

## AUTO-037 ``` の閉じ補完

3 つ目のバッククォートを打った時点で、次の行に閉じの ``` を置く。
カーソルは**開きの ``` の直後**に残す。言語名（`ts` / `python`）を続けて書き、
Enter で本文へ入る書き順をそのまま通すため。カーソルを block の中へ落とすと言語名が書けない。

閉じと開きの間に空行は入れない。開きの行で Enter を打った時点で本文の行ができるので、
先に入れておくと空行が 1 行余る。

介入しない条件（いずれかに当てはまれば通常の入力）:

- 行に文字が先にある（インラインコードの `` を壊さないため）
- カーソルの後ろに文字がある
- 既に開いている fenced block の中（そこでの ``` は閉じる操作）
- 4 つ目以降のバッククォート
- 範囲選択を置き換える入力
- IME 変換中

リスト項目の中では字下げを引き継ぐ。判断は `domain/document/code-fence` に置き、
CodeMirror への接続（`inputHandler`）と分けた。`list-editing` と同じ分け方。

## 検証状況（2026-09-06・``` 補完）

- `npm run check`: 149 passed（`code-fence` 12件、CodeMirror 上の挙動 5件を追加）
- ブラウザでの目視（`npm run dev`）: エディタへ実際に ``` を打ち、閉じが入りカーソルが
  開きの直後に残ること、続けて `ts` → 改行 → コードと書けること、ハイライトが効くこと
