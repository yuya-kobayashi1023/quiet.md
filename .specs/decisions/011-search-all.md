# ADR-011 — Search All（Workspace全文検索）

Status: **Accepted**（2026-09-05）

Supersedes: U-013 の「Search AllはP1」

Related: U-005, U-013, U-024, U-025, ADR-002

## Context

U-013 は Quick Open と Current Document Find を MVP、Search All を P1 としていた。

実際に使うと、Quick Open（ファイル名）と Find（現在の文書）だけでは、
「どこかに書いたはずの一文」へ辿り着けない。
Workspace が数十文書を超えた時点で、ファイル名を思い出せることが前提の導線は成り立たなくなる。

## Decision

**Search All を実装する。`Ctrl+Shift+F` で開く。**

3つの検索の役割は次のとおり分ける。

| 入口 | 対象 | Shortcut |
|---|---|---|
| Command palette / Quick Open | コマンドとファイル名 | `Ctrl+K` / `Ctrl+P` |
| Find in document | 現在の文書の本文 | `Ctrl+F` |
| Search All | Workspace 全文書の本文 | `Ctrl+Shift+F` |

### UI

開いている間だけ存在する overlay とする（AGENTS.md §4）。常設パネルは作らない。
Command palette と同じ作法だが、1件が preview を伴うため縦に長い。

結果は文書ごとにまとめ、ヒット数の多い文書から並べる。

### Archive の扱い

**既定で Archive も検索する。** チェックボックスで外せる。

Archive は論理的な整理であって削除ではない（U-005）。
「昔書いたものを探す」のは Search All の主目的の一つなので、既定で外すのは逆。

この選択は設定として保存する（`searchIncludeArchived`）。
Settings 画面には出さない。Search All の中でしか意味を持たないため。

### 実装

検索は Rust で行う（`filesystem/search.rs`）。ignore 規則を二重に持たないよう、
走査は `scan.rs` の結果を再利用する。

- 正規表現は受け付けない。打った文字列をそのまま探す
- 大文字小文字は既定で無視。`Aa` で切り替え
- 4 MiB を超えるファイルは飛ばす
- 1文書50件 / 全体2,000件 / 300文書で打ち切り、`truncated` を返す
- **column は UTF-16 code unit で数える。** 受け取る側が JS の文字列だから

### 行き先への移動

検索結果の行番号はファイル先頭からの通し番号（Front Matter を含む）。
Editor が持つのは本文だけなので（ADR-002）、Front Matter の行数を引いて Editor の行へ直す。

Read モードで結果を開いたときは Split へ切り替える。
Editor が隠れたまま行へ飛んでも、ユーザーには何も起きていないように見えるため。

## Consequences

- Workspace が大きいほど検索が遅くなる。debounce 220ms と 2 文字以上の下限で回数を抑える
- 検索対象は `.md` / `.markdown` のみ。`scan.rs` の対象と同じ
- Replace は含まない。破壊的操作は別の決定として扱う

## Alternatives

### インデックスを持つ

高速だが、外部ツールでの編集（U-010）と整合を取り続ける必要がある。
Workspace 規模が数千文書に達するまでは、都度走査で足りる。

### ripgrep を同梱する

速度は最良。バイナリ同梱と配布サイズの代償に見合わない。
