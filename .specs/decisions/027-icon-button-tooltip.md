# ADR-027 — アイコンのみのボタンに名前の Tooltip を表示する

Status: **Accepted**（2026-09-23）

Related: ADR-006, ADR-016, ADR-023, `ui/ui-spec.md` §3, `ui/interactions.md` §11, `quality/acceptance-criteria.md` §B

## Context

Sidebar を折りたたんだ Rail にはアイコンのみが並ぶ。配置されている 6 個のアイコンのうち、ノート・新規ノート・アーカイブの 3 個には名前の表示がなく、ホバー時にも何も表示されない。残りの 3 個と、開いた Sidebar のアイコン（閉じる、Workspace の切り替え、新規ノートの `+`）は、Browser native の `title` に依存していた。

`interactions.md` §11 では、native の `title` に依存せず独自の Style で Tooltip を表示すると定めているが、対象はファイル名が省略された場合のみであった。

## Decision

### 1. アイコンのみのボタンは、常に名前を Tooltip で表示する

ファイル名の Tooltip と共通の仕組みで表示する。表示までの遅延、Keyboard focus 時の表示、Tooltip 内に操作を配置しない仕様も共通とする。

- フォントにはファイル名用の等幅フォントではなく、UI フォントを使用する。
- ショートカットがある操作は、名前の右側に薄い色で併記する（例: `サイドバーを開く  Ctrl+B`）。
- マウスクリック時は非表示とし、クリック直後の focus でも表示しない（クリック後に吹き出しが残るのを防ぐため）。
- 名前は `aria-label` で読み上げるため、Tooltip は `aria-describedby` で関連付けない。ショートカットは `aria-keyshortcuts` で伝える。

### 2. 対象は Sidebar のアイコンから開始する

Rail のすべてのアイコンと、開いた Sidebar のアイコン（閉じる、Workspace の切り替え、新規ノートの `+`）を対象とする。Top bar や Find bar のアイコンは、本実装方式を確定させた後の別変更で揃える。

## Consequences

- Sidebar のアイコンから native の `title` がなくなる。
- Top bar と Find bar のアイコンには、当面 native の `title` が残る。
