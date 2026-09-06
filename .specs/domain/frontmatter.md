# YAML Front Matter Specification

## 1. Purpose

Front MatterはMarkdown本文の前に置かれる文書メタデータ。

例:

```yaml
---
title: Designing quieter software
tags:
  - design
  - editor
status: draft
created: 2026-09-04
---
```

---

## 2. Detection

[DRAFT]

ファイル1行目が厳密に`---`の場合のみFront Matter開始として扱う。

終了:

- `---`
- `...`

を許可候補。

Commonな実装互換性を優先。

---

## 3. UI

[ADOPTED]

Collapsed:

```text
Metadata · 4 fields
```

Expanded:

- Fields
- Raw

通常時は本文を邪魔しない。

---

## 4. Fields view

初期Known field:

| Key | UI |
|---|---|
| title | text |
| tags | tag/list input |
| status | text / 将来select |
| created | date-like text |

[DRAFT]

Unknown fieldはFields viewに自動フォーム化しない。

Raw側では必ず保持・編集可能。

将来、Schema定義がある場合のみKnown field UIを拡張する。

---

## 5. Raw view

Raw YAMLを編集可能。

Rawは**source of truth**に近い扱い。

Fields viewによる変更はRawへ反映する。

---

## 6. Lossless requirement

重要。

Fields viewを触っただけで次を失わない。

- Unknown keys
- Key order
- YAML comments
- Quoting styleを可能な限り
- Nested structure
- Arrays

悪い例:

```yaml
custom:
  # important
  value: "001"
```

を保存後に、

```yaml
custom:
  value: 1
```

へ変えない。

---

## 7. Implementation recommendation

[DRAFT]

YAML parserは単純な`JSON.parse`的Object変換だけでなく、**Document/CSTを保持できるライブラリ**を推奨。

Fields update時は文書全体を再serializeせず、対象nodeだけ更新する。

---

## 8. Invalid YAML

Raw編集中にInvalidになることは正常な途中状態。

```text
Raw YAML invalid
```

だからといって、

- 入力を戻さない
- YAMLを消さない
- Fields値で上書きしない

UI:

- Raw viewに小さなError
- Fields viewは最後にvalidだった値を表示
- Saveを許可するかは判断事項

[DECIDED: U-017] Invalid YAMLでも保存可。Fields syncのみ停止する。

**推奨:** Invalid YAMLでもMarkdownファイル自体は保存可能。ただしMetadata Fields syncを停止し、明示Warning。

理由: Text editorとしてユーザー入力を勝手に拒否しない。

---

## 9. Title sync

[DECIDED: U-006] Title UIはファイル名から拡張子を除いた文字列。`frontmatter.title` とは連動しない。

Title UIとFront Matterの間に同期はない。

```text
Large title UI  ⇄  filename
frontmatter.title  →  Metadata Fields の1項目にすぎない
```

`title` キーを持つ既存文書を開いても、Title UIの表示は変わらない。
`title` の値は保存時にそのまま保持する（`domain/frontmatter.md` §6 のlossless要件）。

---

## 10. Preview metadata

Raw YAMLは表示しない。

例:

```text
design · editor      draft      2026-09-04
```

Unknown metadataを全部Previewへ出さない。

---

## 11. No Front Matter

Front Matterが存在しない場合:

**推奨:** `Metadata` summary自体を非表示。

ユーザーがMetadata追加操作を行った場合に初めて挿入。

[DECIDED: U-018] Front Matterがなければ `Metadata` summaryを表示しない。More menuから挿入する。

現在PrototypeではMetadataが常にあるサンプルのため、Productionの「Front Matterなし」UIは未確定。

推奨追加導線:

More menu:

```text
Add metadata
```

常時ボタンは増やさない。

---

## 12. Security

Preview生成時、YAML valueをHTMLとして直接差し込まない。

必ずescape / sanitize。
