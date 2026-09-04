# Product Principles

> ステータス: Draft / 一部採用済み  
> この文書は「仕様に書かれていない小さな判断」を行うときの優先順位を固定する。

## 1. Quiet by default

[ADOPTED]

通常時の画面には、現在の作業に必要なものだけを置く。

機能数を減らすのではなく、**必要になるまで機能を見せない**。

具体例:

- 目次は常設サイドペインにせずPopover
- 高度な操作はCommand Palette / Context Menu
- YAML Front MatterはMetadataとして折りたたむ
- 保存済み状態は文字で常時表示しない
- Settingsはサイドバー最下部に静かに置く

---

## 2. Content first

[ADOPTED]

Markdown本文とPreviewが視覚上の主役である。

UIが本文より強く見える状態を避ける。

- 見出しを過度な太字で押さない
- 大きなアクセント面を作らない
- 常時表示するカードを増やさない
- 装飾目的のアニメーションを増やさない

---

## 3. Progressive disclosure

[ADOPTED]

**Progressive disclosure（段階的開示）**とは、情報や機能を一度にすべて見せず、必要になった段階で詳細を開示する設計。

本アプリでは次の順を優先する。

```text
通常表示
  ↓
Hover / Tooltip
  ↓
Popover
  ↓
Context Menu / Command Palette
  ↓
Modal / Settings
```

---

## 4. Feedback should be local

[ADOPTED]

結果は、可能な限り操作した場所の近くに返す。

- Dirty → ファイル名右側
- New Note → ファイルリスト
- Settings変更 → Settings内
- Copy → Copyボタン
- View切替 → View selector + ペイン構造

ただし、保存失敗・外部競合・データ消失の危険はローカル表示だけに閉じず、明確に通知する。

---

## 5. No surprising file mutations

[DRAFT]

Markdownはアプリの内部データではなく、ユーザーが所有する通常ファイルとして扱う。

原則:

- タイトル変更でファイル名を勝手に変えない
- ファイルを開いただけで内容を書き換えない
- PreviewしただけでFront Matterを追加しない
- 保存時に未知のYAML項目を捨てない
- 改行コードを理由なく変換しない

---

## 6. Local-first

[DRAFT]

基本機能はネットワークなしで成立させる。

- 読み書き
- Preview
- 検索
- Front Matter
- 目次
- Settings
- Theme

をローカルで完結可能にする。

将来的にAI機能や同期を追加する場合も、既存のローカルファイルモデルを破壊しない。

---

## 7. Desktop-native where it matters

[DRAFT]

見た目をOS標準へ寄せるという意味ではない。

次のような、デスクトップで期待される操作を尊重する。

- Drag & Drop
- OSのFile Dialog
- Context Menu
- Finder / Explorerで表示
- Clipboard
- Keyboard shortcut
- File association
- External file change detection
- Multi-window
- Window close時の安全な処理

---

## 8. Reversible over confirm-everything

[DRAFT]

安全な操作は、毎回Confirm Modalを出すよりUndo可能にする。

例:

```text
Archive
→ 即時反映
→ "Archived xxx.md    Undo"
```

ただし以下は確認を許可する。

- 保存不能な未保存内容を破棄
- Workspace外への大量ファイル操作
- 復元不能な削除

---

## 9. Accessibility is not optional

[DRAFT]

静かなUIは「薄くて見えないUI」ではない。

- Focus stateは明確にする
- Keyboardだけで主要操作可能にする
- reduced motionを尊重する
- Tooltipにしか重要情報を置かない
- 色だけで重大状態を伝えない

Dirtyの `●` は補助状態であり、保存失敗は色だけにしない。

---

## 10. Prefer boring data formats

[DRAFT]

アプリ固有情報を保存する場合は、可能な限り人間が読める形式を使う。

推奨:

- Markdown
- YAML
- JSON

避ける:

- ユーザーの文書本体を独自DBへ閉じ込める
- 独自バイナリ形式のみで管理する
