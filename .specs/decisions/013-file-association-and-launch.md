# ADR-013 — 関連付け起動と Recent

Status: **Accepted**（2026-09-06）

Supersedes: `ui/desktop-ux.md` §8 File association の [DRAFT]

Related: U-001, U-009, U-011, U-021, `architecture/architecture.md` §12, `ui/ui-spec.md` §2

## Context

`.md` を Quiet に関連付けてダブルクリックしても、ファイルが開かなかった。

原因は 1 つではなく、起動経路まわりに 3 つの穴が空いていた。

1. Windows は関連付け起動でファイルパスを `argv[1]` に渡すが、Native 側が argv を読んでいなかった
2. `open_in_new_window` は `index.html?path=` で Window を作るのに、Frontend が `location.search` を読んでいなかった。
   つまり `Open in New Window` も同じ理由で文書を開けていなかった
3. Workspace 外の単体ファイルを扱う部品（`allow_single_file` / `chooseMarkdownFile`）はあったが、
   どこからも呼ばれておらず、U-001 の「単体 `.md` も Open 可能」が UI として存在しなかった

加えて、二重起動の対策がなかった。2 つ目の `.md` を開くと 2 つ目のプロセスが立ち、
同じ `.quiet/workspace.json` を 2 プロセスが書く状態になる。これは U-021 の
「書込みは単一プロセス内で直列化する」と正面から矛盾する。

## Decision

### 1. 起動経路を `OpenTarget` へ一本化する

入口ごとに処理を足すと、経路が 4 本に分かれて挙動が揃わなくなる。
Native 側で 1 つの型へ正規化し、Frontend は入口の違いを知らない。

```text
起動時 argv                ┐
二重起動の argv            ├→ OpenTarget          →  Frontend の openPath / open workspace
macOS RunEvent::Opened     │   ・Workspace(dir)
Window URL の ?path=       ┘   ・File(md file)
```

対象にするのは実在するパスだけ。ファイルは Workspace 走査と同じ拡張子規則
（`md` / `markdown`、`filesystem::scan::is_markdown_path`）で判定する。

### 2. 起動時は pull、実行中は event

起動直後の Window はまだ listen していないため、event だけでは取りこぼす。

- 起動時に渡された対象は `AppState.pending_open` へ置き、Frontend が初期化時に
  `take_launch_target` で 1 度だけ引き取る
- 実行中に届いた対象は `quiet://open-target` を宛先 Window へ emit する。
  `listen` は宛先違いも受け取りうるので、payload に Window label を入れて Frontend 側で捨てる

### 3. 二重起動はプロセスを増やさない

`tauri-plugin-single-instance` を最初のプラグインとして登録し、2 つ目以降の起動は
argv だけを既存プロセスへ渡す。配り先は次の順で決める。

1. 同じファイルを開いている Window があれば、それを前へ出す（U-021）
2. 文書を開いていない Window があれば、そこへ渡す（main を優先）
3. どちらでもなければ新しい Window を作る（U-011: Tabs の代わりに New Window）

### 4. 同一ファイル判定は label ではなくレジストリで行う

以前の `open_in_new_window` は Window label に path のハッシュを使って重複を避けていたが、
その Window が別の文書へ移ると label が実態と合わなくなる。また main window が既に
開いているファイルは検出できなかった。

`AppState.document_windows`（label → path）を持ち、Frontend が文書を開く / 閉じるたびに
`register_document_window` で更新する。Window の破棄時は `RunEvent::WindowEvent::Destroyed` で消す。

### 5. Workspace 外のファイルは Workspace を閉じずに開く

単体ファイルモードへ切り替えて Sidebar を無効化する案も考えたが、状態が 1 つ増える。
Workspace はそのままにし、Sidebar に **Recent** セクションを足して、そこへ並べる。

- 保存先は App settings（`recentFiles`、上限 30、新しい順）。
  Workspace に属さない情報であり、そもそも Workspace 未設定では `.quiet/workspace.json` を書けない
- 表示するのは「表示時点で現在の Workspace の外にあるもの」だけ。中にあるものは Notes 側に出ている
- 表示件数は設定で変えられる（`recentVisibleCount`、既定 8）。画面の高さで妥当な数が変わるため
- 同一ファイル判定は正規化したパス。Windows の大小文字差と区切りの違いを吸収する
- 履歴に載っていること自体は読み書きの許可ではない。行をクリックした時点で
  `allow_single_file` を呼ぶ（`architecture.md` §12「ユーザーが明示的に開いたものだけ」）
- 開けなくなっていたら、その場で履歴から外してトーストで知らせる。
  起動時に一括で消さないのは、クラウド同期・ネットワークドライブ・外付けが
  「一時的に見えないだけ」の場合があるため

### 6. 関連付けはインストーラで登録する

`bundle.fileAssociations` に `md` / `markdown` を宣言する。NSIS は currentUser インストールなので
HKCU へ登録される。ただし Windows の既定アプリ（UserChoice）はインストーラから書き換えられないため、
ユーザーが 1 度「既定のアプリ」で選ぶ必要がある。

## Consequences

- Frontend の文書を開く経路が `openPath(path)` に集約された。
  Workspace の内外はこの関数の中だけで分岐する
- Workspace 外の文書を開けるようになったため、Breadcrumb は Workspace 名ではなく
  実際の親フォルダ名を出す（所属を偽らない）
- Recent の実体は App settings なので、複数 Window が同時に書くと後勝ちになる。
  Workspace state の Window 間同期（U-021）と同じ課題で、ここでは解いていない
- Workspace 外のファイルは watcher の監視対象外。外部変更を検知できない。
  親ディレクトリの非再帰監視で埋められるが、本 ADR の範囲外とする

## Alternatives

### 親フォルダを暗黙に Workspace として開く

ダブルクリックしたファイルの親を Workspace にする案。Sidebar も検索もそのまま使える。
採らない理由は 2 つ。`.quiet/workspace.json` を、ユーザーが Workspace と思っていない
フォルダ（他人のリポジトリなど）に作ってしまうこと。`Downloads` や巨大リポジトリを開いた
瞬間に再帰スキャンと recursive watcher が走ること。

Workspace 化はユーザーが明示的に選んだときだけにする。Recent の Context menu に
「このフォルダを Workspace として開く」を置いて、その導線だけ残す。

### 単体ファイルモード（Workspace を閉じる）

Workspace を閉じて 1 ファイルだけの状態にする案。Sidebar の選択状態と編集中のファイルが
食い違わない利点があるが、Recent セクションを設けると同じ利点が得られ、かつ状態が増えない。
Workspace 未設定のときは、結果的に Recent だけが並ぶ画面になる。
