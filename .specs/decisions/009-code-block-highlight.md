# ADR-009 — コードブロックのシンタックスハイライト

Status: **Accepted**（2026-09-05）

Related: U-003, U-023, `ui/ui-spec.md` §8

## Context

`ui/ui-spec.md` §8 は「Markdown本文の意味を持つ記号だけを控えめに色付けする」と定め、
Fenced code delimiter（``` ）自体は色付け対象に挙げている。

しかしFenceの**中身**をどう扱うかは書かれていなかった。
実装は `codeLanguages: []` で、EditorでもPreviewでもコードは本文色のまま出ていた。

技術メモを書く用途ではコードブロックが読みにくく、
Markdownエディタとしての基本的な期待を満たしていない。

## Decision

**Fenced code blockの中身を、言語が明示されているときだけハイライトする。**

- Editor: `@codemirror/lang-markdown` の `codeLanguages` に `@codemirror/language-data` を渡す
- Preview: `rehype-highlight`（lowlight / highlight.js）を `rehype-sanitize` の**後**に走らせる
- 色の役は5つに固定する。`--code-keyword` / `--code-string` / `--code-number` /
  `--code-comment` / `--code-entity`
- Editorとpreviewは同じ5役に畳んで割り当てる。両者で見た目が変わらないこと

### 言語指定のないFenceは推定しない

`detect: false`。擬似コード・ログ・散文をFenceに入れる用途があり、
推定を効かせると本文が意図せず多色になる。`text` / `plain` / `txt` も素のまま出す。

### 未登録言語は素のまま

例外にしない。ハイライトが効かないだけで、コードは表示される。

## Why 5 roles

`ui-spec.md` §8 の「本文自体を多色にしすぎない」を、コード内にも適用する。
highlight.jsは40以上のscopeを出すが、そのまま色を割り当てるとIDEの見た目になる。
CSSで割り当てるのは5役だけで、それ以外は本文色のまま残す。これは抜けではなく既定である。

## Security

`rehype-highlight` は sanitize の**後**に置く。

- highlightが読むのはsanitize済みのtextノードだけ
- 生成されるのは `<span class="hljs-*">` だけで、属性は増えない
- Fence内の `<script>` はescape済みのまま。span で包まれるだけで実行される形にはならない

順序を逆にするとhighlightの出力をsanitizeが削り、色が消える。
U-023のポリシーは変えない。

## Consequences

- `@codemirror/language-data` は各言語をdynamic importする。起動時のバンドルには載らない
- `rehype-highlight` は既定で `common`（約37言語）をバンドルする。これは同期的に載る
- コードブロックを含む文書のPreview描画がわずかに遅くなる

## Alternatives

### Shiki

VS Code同等のテーマ品質。ただしWASM/JSON grammarが重く、
本アプリの独自Tokenへ色を寄せるには結局テーマを書き換えることになる。

### ハイライトしない（現状維持）

静けさは最大だが、コードを含む文書での実用性が低い。
