# Quiet Markdown Editor — 仕様ドラフト一式

> 文書ステータス: **Draft 0.1**  
> 基準UI: `ui/ui-mockup.html`（2026-09-04 時点の v27 Front Matter プロトタイプ）  
> 目的: AI実装時に「見た目は合っているが仕様が違う」「便利そうな機能をAIが独自追加する」といったズレを減らす。

このリポジトリの `.specs/` は、現在合意しているUIと、実際にデスクトップアプリとして開発する際に必要になる仕様を、実装に渡せる粒度へ分解したたたき台です。

まだ確定していない事項は、**AIに勝手に決めさせない**ために明示的に未決定として残しています。

---

## 1. 文書の読み方

本文中の判断状態は次の記法で統一します。

### `[ADOPTED]`

現在の打合せで、採用する方向がかなり明確なものです。

### `[USER DECISION REQUIRED: U-xxx]`

ユーザー判断が必要なものです。

直後に以下を記載します。

- **推奨案**
- **推奨理由**
- **代替案**
- **決めない場合に実装へ与える影響**

判断対象だけを一覧で確認したい場合は、最初に [`product/open-decisions.md`](product/open-decisions.md) を見てください。

### `[DRAFT]`

ユーザー判断を必ずしも要求しないものの、実装前に内容を確認しておきたい提案です。

---

## 2. 文書構成

```text
.specs/
│
├─ README.md
├─ AGENTS.md
│
├─ product/
│  ├─ principles.md
│  ├─ requirements.md
│  └─ open-decisions.md
│
├─ ui/
│  ├─ ui-spec.md
│  ├─ design-system.md
│  ├─ interactions.md
│  ├─ desktop-ux.md
│  └─ ui-mockup.html
│
├─ domain/
│  ├─ document-model.md
│  ├─ frontmatter.md
│  └─ file-lifecycle.md
│
├─ architecture/
│  ├─ architecture.md
│  └─ interfaces.md
│
├─ quality/
│  ├─ acceptance-criteria.md
│  ├─ non-functional-requirements.md
│  └─ test-strategy.md
│
└─ decisions/
   ├─ 001-no-tabs.md
   ├─ 002-frontmatter-metadata-ui.md
   ├─ 003-autosave-dirty-indicator.md
   ├─ 004-theme-system.md
   ├─ 005-toc-popover.md
   ├─ 006-collapsible-sidebar.md
   └─ 007-production-editor-engine.md
```

---

## 3. まず確認してほしい文書

全部目を通す前提でも、最初は次の順が確認しやすいです。

1. `product/principles.md`
2. `product/open-decisions.md`
3. `product/requirements.md`
4. `ui/ui-spec.md`
5. `domain/document-model.md`
6. `domain/file-lifecycle.md`
7. `architecture/architecture.md`
8. `quality/acceptance-criteria.md`

この順番なら、「何を作るか」→「まだ決めていないこと」→「どう動くか」→「どう実装を分割するか」までつながります。

---

## 4. 現在のUIで採用済みとして扱っているもの

- フルハイトの左サイドバー
- サイドバーは展開時 226px、折りたたみ時 56px の細いアイコンレール
- サイドバー最下部に Settings
- `FILES` などの不要な見出しは置かない
- `Notes` 見出し右側に新規作成 `+`
- `Archive` 区分
- 長いファイル名はトランケートし、独自Tooltipでフルネーム表示
- 未保存は対象ファイル名右側の小さな色付き `●` のみ
- 下部ステータスバーに `Saved` 表示は出さない
- 上部はパンくず。タブUIは採用しない
- Write / Split / Read
- Split時は各ペインにつきスクロール1本。Editor内部の二重スクロールは禁止
- 目次は常時表示せず、アイコンから静かなPopoverとして開く
- Markdown記号だけを控えめにシンタックスハイライト
- PreviewはGFM相当のテーブルを表示
- YAML Front Matterは `Metadata · N fields` として折りたたみ
- Metadataは `Fields / Raw` を切り替え可能
- PreviewではYAML記法ではなく意味を圧縮して表示
- Light / Darkは独立したカラースキーマ
- Settingsはモーダル型
- 操作FBは「操作した場所の近く」を優先
- UIの装飾目的だけのアニメーションは避ける

---

## 5. 編集して返送するとき

自由に編集してください。

特に、以下はそのまま書き換えて問題ありません。

- `[USER DECISION REQUIRED]` の推奨案
- 数値
- MVP / Later の優先順位
- キーボードショートカット
- 保存タイミング
- アーキテクチャ案
- 採用ライブラリ
- ファイルモデル
- Archiveの意味

判断が決まった項目は、たとえば次のように変更してもらえるとDiff確認しやすいです。

```md
[DECIDED: U-003]
Production Editor Engine: CodeMirror 6
```

ただし、必須ではありません。普通に文章を書き換えてもDiffできます。

---

## 6. 再返送後の確認方針

編集版を返送されたら、次の観点で差分を確認します。

1. ファイル単位の追加・削除・変更
2. 行単位のDiff
3. ユーザー判断項目の確定 / 変更
4. 文書間の仕様矛盾
5. UI仕様と機能仕様の矛盾
6. 状態遷移とAcceptance Criteriaの不足
7. アーキテクチャに波及する変更
8. 実装順序への影響

単純なDiff表示だけでなく、**「この変更を採用すると別資料のここも変える必要がある」**まで確認する前提です。
