# AGENTS.md — AI実装ルール

> 仕様書そのものではなく、AIエージェントが `.specs/` をどう扱うかを規定する入口。
> **コードを変更する前に読むのはこのファイルだけでよい。** 個別の仕様書は §1 の表で必要な分だけ開く。

## プロジェクト

Quiet — 静かな Markdown エディタ（Tauri 2 + React 19 + TypeScript / CodeMirror 6 / unified・remark）。
ファイル IO は全て Rust 側 command に閉じ、フロントエンドは直接ファイルを触らない。
Windows first、macOS は後追い。UI 文言は日本語。

```bash
npm run check         # 型チェック + vitest（変更後は必須）
npm run dev           # ブラウザで UI だけ確認（IO はメモリ上のフォールバック）
npm run tauri:dev     # デスクトップアプリとして起動
cargo test            # src-tauri/ で実行
```

```text
src/domain/      純粋ロジック（frontmatter / markdown / list-editing / code-fence / recents / workspaces）+ 同居する *.test.ts
src/features/    画面単位（editor / preview / sidebar / shell / search / frontmatter / settings / toc / command-palette）
src/services/    store・native-bridge・document/workspace/settings service
src/ui/          tokens・共通コンポーネント・global.css
src-tauri/src/   commands / filesystem / watcher / settings / launch / shell_integration
.specs/          仕様書（正本）。history/ は履歴で、通常は読まない
```

---

## 1. 実装前に読むもの

全部を読まない。**変更対象に対応する行だけ**を開く。迷ったら `product/principles.md` に戻る。

| 変更対象 | 読む |
|---|---|
| 画面・見た目・状態表現 | `ui/ui-spec.md` の該当節、`ui/design-system.md`（色・字・motion）、`ui/interactions.md` |
| 保存 / Rename / Archive / 外部変更 | `domain/file-lifecycle.md`、`domain/document-model.md` |
| Front Matter | `domain/frontmatter.md` |
| Rust 側・IPC・エラー契約 | `architecture/interfaces.md`、`architecture/architecture.md` §2 / §4 |
| ショートカット・OS 統合・多重窓 | `ui/desktop-ux.md` |
| 機能を足す / 削るの是非 | `product/principles.md`、`product/requirements.md`（§5 は Non-goals） |
| 過去の決定の確認 | `product/open-decisions.md`（表と決定のみ）、`decisions/` の該当 ADR |
| 完了判定 | `quality/acceptance-criteria.md` の該当節、`quality/test-strategy.md` |
| 性能・データ保全・a11y の数値 | `quality/non-functional-requirements.md` |

ADR（`decisions/`）は仕様書本文より新しい。矛盾したら ADR が優先する。
検討の経緯が要るときだけ `.specs/history/` を開く。

---

## 2. 未決定事項を推測して実装しない

`[USER DECISION REQUIRED: U-xxx]` が未解決で、その判断が実装結果を変える場合は止まること。

禁止例:

- Archiveの意味が未決定なのに勝手にファイルを移動する
- `title` 変更時に勝手にファイル名を変更する
- 複数ファイル需要を見て勝手にタブを追加する
- UIにない保存ボタンを「分かりやすさのため」に追加する
- 独自の設定項目を追加する

---

## 3. PrototypeとProductionを混同しない

`ui/ui-mockup.html` 等の HTML プロトタイプは、レイアウト・密度・色・状態表現・
マイクロインタラクション・情報の出し方を確認するための **UI参照実装**である。

プロトタイプの `textarea + overlay` 等をそのまま Production へ写すことは要求しない。
Production では、仕様を保ったまま保守性・IME・アクセシビリティ・性能に適した実装を選ぶ。

---

## 4. UI変更の原則

機能追加時に、既存画面へ常設UIを追加する前に次を検討する。

1. 既存の場所で表現できないか
2. Context Menuに置けないか
3. Command Paletteに置けないか
4. Tooltipに置けないか
5. 一時的なPopover / Toastで足りないか
6. Settingsへ逃がせないか

常設UI追加は最後の選択肢とする。設定項目も同じ理由で安易に増やさない。

---

## 5. 操作FB

操作結果は可能な限り操作箇所の近くで返す。

- 編集 → ファイル名右のDirty dot
- 新規作成 → サイドバーに新しい行
- Copy → Copyアイコンを一時的にCheckへ
- Settings変更 → Settings内に一時的なSaved feedback
- Archive → 対象行が移動 + Undo可能なToast

保存失敗・競合・データ消失リスクは静かにしすぎない。

---

## 6. 実装変更の粒度

1つのタスクでは、要求された機能に直接必要な変更へ限定する。
「ついでのリファクタリング」を行う場合は、変更理由が明確・Acceptance Criteriaを変えない・
既存UIを変えない・Diffがレビュー可能な大きさ、を満たすこと。

仕様に書かれていない判断を自分で決めたら、`IMPLEMENTATION-DECISIONS.md` の表に1行足す。
仕様を変える判断をしたら `decisions/` に ADR を足し、影響する仕様書本文も直す。

---

## 7. テスト

完了報告前に `npm run check` を通す。Rust を触ったら `cargo test` も。
対象機能の Acceptance Criteria に対応するテストがあることを確認する。

バグ修正は、1. 失敗を再現するテスト → 2. 修正 → 3. 回帰確認 の順。

純粋ロジックは `src/domain/` に置き、CodeMirror / React への接続と分けてテストする
（`list-editing` と `list-keymap`、`code-fence` と `fence-input` が既存の分け方）。

---

## 8. 禁止事項

- 仕様にないクラウド同期の追加
- 仕様にないTelemetry
- ユーザー確認なしの破壊的ファイル移動
- YAML Front Matterの未知キー消失
- ファイル保存時の無条件な全体再整形
- Line endingの無断変換
- タブUIの追加
- Pure black / pure whiteを基調としたテーマへの変更
- Accent colorの大面積利用
- 全画面を派手にフェードさせる遷移
