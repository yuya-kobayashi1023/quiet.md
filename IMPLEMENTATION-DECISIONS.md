| AUTO-044 | PDF の既定ファイル名を `<タイトル>.pdf` とし、完了 Toast の操作を「フォルダを開く」とする（ファイル選択状態で開く Reveal は Workspace scope の判定に掛かるため使用しない） | Low |
# 実装中に AI が独断で決めたこと

> 仕様書（`.specs/`）に書かれていなかった判断の記録。
> 判断の理由・経緯は [`.specs/history/auto-decisions-log.md`](.specs/history/auto-decisions-log.md) に当時のまま残してある。
> ここは**要確認のものと一覧**だけを置く。新しく独断したら、下の表に1行足す。

## 要確認（未解決）

### AUTO-004 名前と識別子 — **High**

`quiet-md`（npm / crate）、`com.quiet-md.app`（Tauri identifier）、`Quiet`（productName / Window title）。
リポジトリ名から機械的に決めた。**identifier は配布後に変えるとアップデート経路が切れる**ので、リリース前に確定してほしい。

### AUTO-011 Editor は本文だけを扱う — **High**

CodeMirror へ渡すのは Front Matter を除いた本文。Front Matter は Metadata UI が持ち、保存時に結合する。
副作用として **Editor の `Ctrl+F` は Front Matter を検索しない**。Metadata の Raw で編集する必要がある。

### AUTO-017 ESLint を入れていない — Medium

`npm run check` は TypeScript strict + vitest のみ。**入れるなら早い方が良い**（あとからだと既存コード全体に警告が出る）。

### ADR-017 CJK の改行を詰める設定を作っていない — Medium

段落内の改行が CJK 同士に挟まれているとき、Preview では空白を残さずに詰める（ADR-017）。
ファイルは変えないが、**同じ文書を GitHub 等で開くと従来どおり空白が入る**ため、
表示が Quiet だけ違う。off にする設定を持つかどうかは決めていない。
他ツールへ貼る場面が出たら判断してほしい。

### AUTO-018 UI 文言を日本語にした — **High**

「新規ノート」「設定」など本文は日本語。ただし画面の骨格に当たる短い語（`Notes` / `Archive` / `Write` / `Split` / `Read` /
`Metadata` / `Fields` / `Raw` / `Settings` / `Done`）はプロトタイプの見た目を保つため英語のまま。どちらにも寄せられる。

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
| AUTO-025 | コードの色は5役に固定し、割り当てのない token は本文色のまま残す | Medium |
| AUTO-026 | `rehype-highlight` の `common`（約37言語）をそのまま同梱する | Medium |
| AUTO-027 | Window controls の Close だけ hover 色を変える | Low |
| AUTO-028 | Search All の下限を2文字、debounce を 220ms に | Low |
| AUTO-029 | Search All の結果から Read モードで飛ぶと Split へ切り替える | Medium |
| AUTO-030 | 同期スクロールの基準を画面上端ではなく 72px 下に | Low |
| AUTO-031 | `searchKeymap` を丸ごと入れるのをやめた（既存不具合の修正） | Medium |
| AUTO-032 | `Ctrl+O` を「ファイルを開く」に割り当てた | Low |
| AUTO-033 | Recent の表示件数の選択肢を 3 / 5 / 8 / 12 / 20 / 30、既定 8 にした | Low |
| AUTO-034 | Workspace を指定して起動したときは「前回のノート」を開かない | Medium |
| AUTO-035 | `useTruncationTooltip` に `always` オプションを足した | Low |
| AUTO-036 | ブラウザのフォールバックに Workspace 外のサンプルと初期 Recent を入れた | Low |
| AUTO-037 | ``` を打つと閉じの ``` を補完する（介入条件は履歴側に記載） | Medium |
| AUTO-038 | リリースは手動起動の GitHub Actions で行い、バージョンは 5 ファイル一括で上げる | Medium |
| AUTO-039 | React の入力欄でも IME 変換中は Enter / Escape を横取りしない（AUTO-024 の適用先を広げた） | Medium |
| AUTO-040 | 全角で打たれた Markdown 記号を、入力時と変換確定後の 2 経路で半角へ直す | Medium |
| AUTO-041 | `--font-mono` の末尾に日本語等幅フォントを足した | Low |
| AUTO-042 | 新規ノート作成と Rename の直後はタイトル欄へフォーカスし、全文を選択した状態にする（打ち始めれば `Untitled` が置き換わる） | Low |
| AUTO-043 | ピン止めは Archive と同様に相対パスで保持するため、Rename するとピンは外れる。Notes と Archive の両方で有効であり、Recent には表示しない | Low |
| AUTO-046 | Preview のタスクリストのチェックボックスをクリックして `[ ]` ↔ `[x]` を切り替える（Preview で編集可能な操作はこれのみ）。書き換えはエディタの view へ dispatch し、変更される 1 文字のみを差し替える（行全体を差し替えると、その行のカーソルが行頭へ移動するため）。行の対応は `data-source-line` とは別に `data-task-line` で保持し、scroll 同期の対応表には含めない。 | Medium |
| AUTO-045 | ノートごとのカーソル位置を Recent と同様に App settings で保持（Workspace 外ファイルにも適用、ユーザーフォルダへは書き込まない）。上限 200 件（古い順に破棄）、行と桁で保持し復元時に文書範囲へ丸める。設定項目としては非公開 | Low |

## 未実装リスト

MVP に含まれるが、まだ手を付けていないもの。

| 項目 | 仕様 | 状態 |
|---|---|---|
| Drag & Drop で `.md` を開く | `ui/desktop-ux.md` §3 | 未実装 |
| ウィンドウを閉じるときの保存確認 | `domain/file-lifecycle.md` §13 | 未実装（Autosave のみ） |
| Crash recovery の復元 UI | U-014 | snapshot の書き込みだけ。起動時に提示していない |
| TOC の active heading 追従 | `ui/ui-spec.md` §10 | 一覧と移動は動く。スクロール追従は未実装 |
| Settings の Default location | `product/requirements.md` §3.7 | UI 未実装 |
| macOS 対応 | U-009 | 仕様通り後回し。Rust 側は分岐済み |

## 検証状況

最新の実行結果だけを置く。過去の回は git 履歴を見る。

- 2026-09-17: `npm run check` 240 passed（16 files）、`cargo test` 45 passed（AUTO-043 / ADR-020 のピン止めを含む）
- **未検証**: デスクトップでの起動（`npm run tauri:dev` 未実行）、関連付けからのダブルクリック起動、
  二重起動時の argv 受け渡し、macOS の `RunEvent::Opened`
- 2026-09-10: `npm run dev`（ブラウザ）で確認 — 全角記号の置き換え（`＃`＋空白 / `ー`＋全角空白 /
  `｀｀｀` / `｜`）、CJK の改行が詰まること、Command Palette の Enter が従来どおり動くこと。
  `BIZ UDGothic` / `MS Gothic` の実在も確認（ただし ASCII と CJK の字幅比は 1:1.82。
  1:2 にはならない — design-system.md §3 に記載）
- 2026-09-10: **IME 実機で確認**（Windows 11 / WebView2 / MS-IME、`npm run tauri:dev`）
  - AUTO-039: Command Palette で変換確定の Enter が実行にならず、確定後の Enter は実行される。
    タイトル欄でも変換確定の Enter で Rename が走らない
  - AUTO-040: **入力ハンドラだけでは足りず、修正が要った。**
    MS-IME はひらがなモードの空白キーで全角空白を composition として入れるため、
    `view.composing` が立って `inputHandler` が介入できない。`compositionend` 後の見直しを足し、
    `ー` + 空白キー → `- ` になることを確認
  - AUTO-041: `BIZ UDGothic` / `MS Gothic` の実在を確認
- 2026-09-10（2 回目）: AUTO-040 を「空白キーを待たない」形へ広げて再確認
  - `-` キー → Enter（変換確定）だけで `- ` になる
  - 半角 `-` + 全角空白 → `- ` になる（`#　` も同じ経路）
  - `keydown` の `preventDefault()` では IME を止められないことを実測（`- ` と `ー` が両方入る）
- **未検証**: 日本語入力での文字欠落（AC-C）。
  AUTO-039 の Escape 側（変換中の Escape で編集が破棄されないこと）は、
  自動操作から Escape をアプリへ届けられず再現できなかった。手で確認したい

### この端末で分かったこと（AUTO-040 の効き方）

MS-IME はひらがなモードでも `#` `>` を**半角のまま**出す。全角になるのは
`-` → `ー`、`.` → `。`、空白 → `　` など。そのため直す形は 2 通りある。

- 記号が全角（`ー` `＃` `１。`）→ 半角記号 + 半角空白へ
- 記号は半角だが**うしろの空白だけ全角**（`#　` `-　`）→ 半角空白へ

どちらも変換確定のあとに直す。**打った瞬間には直せない。**
`keydown` を `preventDefault()` しても Windows の IME はキーを受け取るため、
実機では `- ` と `ー` が両方入る（2026-09-10 に確認）。確定（Enter）を待つのが、
IME を壊さずにできる最短。記号が半角で出る `#` は Enter すら要らず、空白キーだけで直る。
