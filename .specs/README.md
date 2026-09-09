# Quiet Markdown Editor — 仕様

> 実装の正本。UI の見た目の基準は `ui/ui-mockup.html`（v27 Front Matter プロトタイプ）。
> AI が実装するときの読み方・ルールは、リポジトリ直下の [`AGENTS.md`](../AGENTS.md) を見ること。

## 正本の優先順位

1. `decisions/` の ADR — 一番新しい。仕様書本文と矛盾したらこちらが勝つ
2. 各仕様書本文（`ui/` `domain/` `architecture/` `quality/` `product/`）
3. `product/open-decisions.md` の決定表 — U-001〜U-030 の確定内容
4. `history/` — 検討の経緯。**通常は読まない**。決定を覆すときだけ開く

仕様を変える判断をしたら、ADR を足したうえで影響する本文も直す。片方だけ直さない。

## 記法

| 記法 | 意味 |
|---|---|
| `[ADOPTED]` | 採用が明確なもの |
| `[DECIDED: U-xxx]` | ユーザー判断済み。直後の記述が実装の正 |
| `[USER DECISION REQUIRED: U-xxx]` | 未決定。推測で実装しない（現在は残っていない） |
| `[DRAFT]` | 判断は要らないが、実装前に確認したい提案 |

## 構成

```text
.specs/
├─ README.md              この文書
├─ product/               principles / requirements / open-decisions / glossary
├─ ui/                    ui-spec / design-system / interactions / desktop-ux / ui-mockup.html
├─ domain/                document-model / frontmatter / file-lifecycle
├─ architecture/          architecture / interfaces
├─ quality/               acceptance-criteria / non-functional-requirements / test-strategy
├─ decisions/             ADR-001〜（新しい決定はここへ足す）
└─ history/               決定に至るまでの検討記録。参照は任意
```

実装側で独断した細かい判断は、リポジトリ直下の `IMPLEMENTATION-DECISIONS.md` に残している。
