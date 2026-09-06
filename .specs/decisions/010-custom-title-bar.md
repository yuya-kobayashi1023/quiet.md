# ADR-010 — Custom title bar

Status: **Accepted**（2026-09-05）

Supersedes: U-007 の Phase 1 決定（OS Native Title Bar）

Related: U-007, U-009, U-021, ADR-006

## Context

U-007 は「Phase 1 は OS Native Title Bar。将来的に Custom title bar へ移行する」と決めていた。
理由は、Window controls の OS 差異・Drag region・Snap・Double click maximize・
Accessibility を最初から自作すると本質でない不具合を抱えやすい、というものだった。

実装後に見ると、Native caption の上に Quiet の Top bar が乗る二段構成になり、
アプリの静けさが窓の縁で途切れている。
Phase 1 の懸念点は、Tauri 2 が既に用意しているものが大半だと分かった。

## Decision

**Custom title bar へ移行する。専用の行は増やさず、既存の Top bar が title bar を兼ねる。**

- `decorations: false`（`shadow: true` は維持）
- Top bar と Sidebar 上端の帯に `data-tauri-drag-region="deep"`
- Top bar 右端に最小化 / 最大化・元に戻す / 閉じる
- `open_in_new_window` で作る `doc-*` window も同じ設定にする

## Why 専用行を足さないか

Sidebar は Content Area の上端から下端まで貫通する（ADR-006）。
全幅の title bar 行を最上部へ足すと、この貫通が崩れ、縦の作業領域も 32px 前後減る。

Top bar は既に 52px あり、中身は Breadcrumb / View switch / アイコン 3 つで、
掴める余白が十分に残っている。行を増やす理由がない。

## Phase 1 の懸念点が解消している根拠

| 懸念 | 実際 |
|---|---|
| Drag region | Tauri が `data-tauri-drag-region` のハンドラを注入する。`button` / `input` 等は自動で除外される |
| Double click maximize | 同じハンドラが担当する（macOSはmouseup、Windows/Linuxはmousedown） |
| Snap / resize | tao は undecorated でも `WS_THICKFRAME` を残し、`WM_NCCALCSIZE` で caption だけ隠す。Aero Snap と端のリサイズは効く |
| Window controls の OS 差異 | 初期対応は Windows（U-009）。macOS 対応時に配置を左へ移す |
| Accessibility | 各ボタンに `aria-label`。最大化ボタンのラベルは状態で変える |

## Top bar 内の 3 つの層（2026-09-06 追記）

1 行に 3 つの層が同居している。

| 層 | 中身 |
|---|---|
| 文書 | Breadcrumb、View switch（Write / Split / Read）、目次、その他 |
| アプリ | コマンドパレット |
| 窓 | 最小化 / 最大化・元に戻す / 閉じる |

当初は 3 層が同じ大きさ・同じ色で 12px 間隔に並んでおり、アイコン 6 個が
1 つの群に見えていた。「その他」と「閉じる」が隣り合うため、
押し間違えの代償という点でも近すぎた。

**行を増やさずに、窓の 3 つだけを面として分ける。**

- 背景を Sidebar と同じトーン（`--sidebar`）にし、左に 1px の境界を引く
- Top bar の `border-bottom` をこの帯の幅だけ切る（帯を 1px はみ出させて隠す）
- アイコンを 15px → 13px、色を `--text-muted` → `--text-subtle` へ一段落とす
- アプリのアイコン群との間隔を 12px → 20px

「ここから先は窓の枠」という読み方になり、専用行（ADR-006 と両立しない）を作らずに
層の違いが見える。Windows Explorer や VS Code が 1 行に混在させても成立しているのは、
同じように面と余白で分けているため。

## Consequences

- Window の最大化状態を Frontend が知る必要がある。Aero Snap や `Win+↑` でも変わるので、
  ボタン側で状態を持たず `onResized` から購読する
- `capabilities/default.json` に `start-dragging` / `minimize` / `toggle-maximize` / `close` を追加する。
  `internal-toggle-maximize`（ダブルクリック用）は `core:window:default` に含まれている
- macOS 対応時に、Window controls の左配置と `titleBarStyle: "Overlay"` の検討が要る

## Alternatives

### Native decoration のまま（U-007 Phase 1）

不具合リスクは最小。ただし窓の縁でデザインが途切れる点は解決しない。

### 全幅の専用 title bar 行

一般的なアプリの見た目に最も近い。ADR-006 の貫通レイアウトと両立しないため採らない。
