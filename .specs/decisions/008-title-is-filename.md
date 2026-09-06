# ADR-008 — Titleはファイル名

Status: **Accepted**（2026-09-05）

Related: U-006, U-020

## Context

初期案では、Titleの正本をYAML Front Matterの `title` に置き、
`title` がない場合だけfilename stemをplaceholderとして表示する設計だった。

この案には次の問題があった。

- Titleを設定するためだけに、全ての文書へ `title:` が増えていく
- 画面のTitle・`frontmatter.title`・本文の `# Heading` の3つが競合し、
  Previewの見出しレベルが定義できない
- Prototypeは本文の `#` を `h2` へ降格する実装になっており、
  書き出しHTMLと読み上げ順が本文の構造とずれていた

## Decision

**Title UIは、ファイル名から拡張子を除いた文字列とする。**

Obsidianのinline titleと同じ考え方を採る。

1. `displayTitle = filename の拡張子を除いた文字列`
2. ファイル名を整形しない（ハイフンをスペースへ置換する等の加工をしない）
3. Title UIの編集はファイルのRenameとして扱う
4. `frontmatter.title` はMetadata Fieldsの1項目にすぎず、Title UIには影響しない
5. 本文の `#` は **H1のまま**。Previewでも書き出しHTMLでも降格しない
6. Title UIは文書の見出しではなく画面のchromeであり、書き出しHTMLの見出し構造に含めない
7. Breadcrumbは変更しない。末尾がTitleと重複してよい

## Consequences

利点:

- Titleのために文書へメタデータが増えない
- 文書の見出し構造がMarkdownの記述そのままになる
- 画面に見えているタイトルとファイルシステム上の名前が常に一致する
- ファイルを開いただけで書き換えない、という原則を崩さずに済む

欠点・引き受けるもの:

- ファイル名に使えない文字（`/` `:` `?` 等）はTitleにも使えない
- 同一フォルダ内で同名のTitleを持てない。
  Archiveしてもファイル名は解放されない（U-005）
- Title編集がファイルシステム操作になるため、
  Rename失敗（権限・ロック・衝突）をTitle UI上で扱う必要がある

## Guardrail

AI実装時に、Titleの表示元を `frontmatter.title` へ戻さない。
Titleを表示するためにFront Matterを自動挿入しない。
Previewで本文の `#` を降格しない。
