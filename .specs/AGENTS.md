# AGENTS.md — AI実装ルール

> これは仕様書そのものではなく、AIエージェントが仕様書をどう扱うかを規定する入口です。

## 1. 実装前の必須読込順

変更対象に応じて、最低限次を読むこと。

1. `product/principles.md`
2. `product/requirements.md`
3. `product/open-decisions.md`
4. 対象機能のUI / Domain仕様
5. `quality/acceptance-criteria.md`
6. `decisions/` の関連ADR

アーキテクチャ変更を伴う場合は追加で、

- `architecture/architecture.md`
- `architecture/interfaces.md`

を読むこと。

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

HTMLプロトタイプは、次を確認するための**UI参照実装**である。

- レイアウト
- 密度
- 色
- 状態表現
- マイクロインタラクション
- 情報の出し方

プロトタイプの `textarea + overlay` 等を、そのままProduction実装へコピーすることは要求しない。

Productionでは、仕様を保ったまま保守性・IME・アクセシビリティ・性能に適した実装を選ぶ。

---

## 4. UI変更の原則

機能追加時に、既存画面へ常設UIを追加する前に次を検討する。

1. 既存の場所で表現できないか
2. Context Menuに置けないか
3. Command Paletteに置けないか
4. Tooltipに置けないか
5. 一時的なPopover / Toastで足りないか
6. Settingsへ逃がせないか

常設UI追加は最後の選択肢とする。

---

## 5. 操作FB

操作結果は可能な限り操作箇所の近くで返す。

例:

- 編集 → ファイル名右のDirty dot
- 新規作成 → サイドバーに新しい行
- Copy → Copyアイコンを一時的にCheckへ
- Settings変更 → Settings内に一時的なSaved feedback
- Archive → 対象行が移動 + Undo可能なToast

保存失敗・競合・データ消失リスクは静かにしすぎない。

---

## 6. 実装変更の粒度

1つのタスクでは、要求された機能に直接必要な変更へ限定する。

「ついでのリファクタリング」を行う場合は、次を満たすこと。

- 変更理由が明確
- Acceptance Criteriaを変えない
- 既存UIを変えない
- Diffがレビュー可能な大きさ

---

## 7. テスト

完了報告前に、対象機能のAcceptance Criteriaに対応するテストを確認する。

バグ修正では可能な限り、

1. 失敗を再現するテスト
2. 修正
3. 回帰確認

の順に行う。

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
