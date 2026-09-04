# ADR-007 — Production Editor Engine

Status: **Proposed / User Decision Required**

Related: U-003

## Context

Prototypeでは`textarea`とHighlight layerを重ねることで、Markdown記号だけを色付けしている。

UI確認には適しているが、Production editorでは次の問題が大きい。

- IME
- Composition
- Undo
- Selection
- Accessibility
- Large document
- Search
- Decorations
- Cursor geometry
- Resize

## Proposed decision

**CodeMirror 6を採用する。**

UI上はPrototypeと同じ静かな表示にカスタマイズする。

## Why not keep textarea overlay

一見単純だが、Editorの基礎機能を自前で再実装する範囲が急速に広がる。

特に日本語IMEのComposition中にHighlight mirrorと値を同期する処理は不具合源になりやすい。

## Alternatives

### Monaco

高機能だがVisual / bundle / IDE感が強め。

### contenteditable custom

自由度は高いが編集エンジン自作に近づく。

## Recommendation

CodeMirror 6。

ただしUI themeは本アプリ独自Tokenで完全に上書きする。
