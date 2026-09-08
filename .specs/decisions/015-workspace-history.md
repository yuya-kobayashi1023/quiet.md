# ADR-015 — Workspace 履歴

Status: **Accepted**（2026-09-09）

Related: U-001, U-005, U-009, U-011, ADR-013, `ui/ui-spec.md` §2, `architecture/interfaces.md` §8 / §11

## Context

Workspace は 1 度に 1 つしか開けず、切り替える手段は「フォルダを開く…」のダイアログだけだった。
複数のフォルダ（仕事のノート・個人のノート・リポジトリの docs）を行き来する使い方では、
毎回ネイティブダイアログでパスをたどることになる。

前回の Workspace は `lastWorkspace` として 1 件だけ覚えているが、これは起動時の復元専用で、
UI からは見えない。「前に開いていたあのフォルダ」へ戻る導線が無い。

## Decision

Sidebar に **WORKSPACE** セクションを足し、過去に開いた Workspace を新しい順に並べる。

### 1. 10 件を覚える。表示件数は設定にしない

Recent（ADR-013）は履歴 30 件・表示件数を設定で変える形にした。Workspace はそもそも数が少なく、
10 件を超えて古いものへ戻る需要は薄い。保持と表示を同じ 10 件にして、設定項目を増やさない
（`AGENTS.md` §4「常設UI追加は最後の選択肢」と同じ理由で、設定項目も増やさない）。

### 2. 保存先は App settings

Workspace そのものの履歴であり、特定の Workspace に属さない。`.quiet/workspace.json` には置けない。
`AppSettings.workspaces`（`{ path, name, openedAt }` の配列、新しい順）が持つ。

### 3. 今開いている Workspace も一覧に残す

Recent は「現在の Workspace の中にあるファイル」を除くが、これは Notes 側に同じ行が出るため。
Workspace セクションにその重複は無い。開いた瞬間に一覧から消えると「忘れられた」ように見えるので、
残したうえで Notes の選択行と同じハイライトを付ける。Sidebar だけで現在地が分かる利点もある。

### 4. Workspace を開く経路を 1 本にする

`openWorkspacePath(path)` に集約する。起動時の復元、フォルダ選択、New Window、
Recent の「このフォルダを Workspace として開く」、Workspace 履歴の行、すべてがここを通り、
`lastWorkspace` の更新と履歴への追加を必ず行う。

履歴へ積むのは Native が返した canonical な root path。呼び出し側の表記のままだと、
同じフォルダが表記違いで別の行として並ぶ。

### 5. 同一判定は Recent と同じ規則

正規化したパスで比べる（Windows の大小文字差、`\` と `/`、末尾の区切り）。
`domain/document/recents.ts` の `pathKey` を共有する。

### 6. 開けなければその場で履歴から外す

行をクリックしてフォルダが無ければ、履歴から外して Toast で知らせる。
起動時に一括で消さないのは Recent と同じ理由（外付け・ネットワークドライブ・クラウド同期）。

### 7. Context menu

開く / 新しいウィンドウで開く / パスをコピー / エクスプローラーで表示 / 履歴から削除。

- 対象がフォルダなので、ファイル向けの操作（名前変更・複製・Archive）は出さない
- New Window は文書用の `open_in_new_window` を使えない（`OpenTarget::File` を作るため）。
  `open_workspace_in_new_window` を足す。同一ファイル 1 Window（U-021）は文書の話で、
  同じフォルダを 2 つの Window で開くことは許す
- Reveal も文書用を使えない。`reveal_in_file_manager` は `ensure_allowed` を通すが、
  履歴に載っているだけのフォルダは現在の scope の外にある。中身に触れず OS のファイルマネージャへ
  渡すだけなので、`reveal_folder` は実在するディレクトリであることだけを確かめる

## Consequences

- Workspace の切り替えがダイアログ無しで 1 クリックになった
- 履歴の実体は App settings なので、複数 Window が同時に書くと後勝ちになる。
  ADR-013 の Recent と同じ既知の課題で、ここでも解いていない
- Sidebar のセクションが 4 つになった。Notes / Archive / Recent が空でも WORKSPACE だけは
  2 回目の起動以降ほぼ常に出る。最下部へ置き、既存セクションの見え方は変えない

## Alternatives

### Command Palette だけに置く

`AGENTS.md` §4 に従えば常設 UI より先に検討すべき選択肢で、実際 Palette へ
「フォルダを開く」は既にある。採らないのは、Recent（ファイル）が Sidebar にあるのに
Workspace だけ Palette という非対称が説明しづらいこと、切り替え先の一覧を
「見えている状態」で選びたい操作であること。Palette は名前を思い出せる場合の導線に留める。

### Top bar の Breadcrumb からドロップダウンで切り替える

現在地から切り替えるのは自然だが、Breadcrumb は文書の所属を示す表示であり、
そこへ操作を足すと Top bar の役割が増える。Sidebar は既に「どこにあるか」を並べる面なので、
そちらへ寄せる。
