# UI Specification

> 基準: 現在のv27 Front Matter Prototype  
> 目的: Production UIが別物へ変質しないための画面構造定義。

## 1. Window layout

DesktopのContent Areaは次を基本とする。

```text
┌──────────────────┬──────────────────────────────────────────────┐
│ Sidebar          │ Top bar                                      │
│                  ├──────────────────────────────────────────────┤
│                  │                                              │
│                  │ Editor / Split / Preview                     │
│                  │                                              │
│                  ├──────────────────────────────────────────────┤
│ Settings         │ Status bar                                   │
└──────────────────┴──────────────────────────────────────────────┘
```

### Dimensions

| Element | Default |
|---|---:|
| Sidebar expanded | 226px |
| Sidebar collapsed | 56px |
| Top bar | 52px |
| Status bar | 28px |
| Main editor column | max 760px |
| Preview column | max 700px |

数値変更は許可するが、Productionで大きく変える場合はDesign review対象。

---

## 2. Sidebar

[ADOPTED]

SidebarはContent Areaの上端から下端まで貫通する。

Expanded:

```text
[collapse]

NOTES                         +
document.md                 ●
long-document-name-that-...

ARCHIVE
old.md


Settings
```

禁止:

- `FILES` 見出し
- Logo placeholder
- `3 notes / local` のFooter表示
- Settings上の強いdivider
- Saved文字列

### Settings

- Sidebar最下部
- Slider controls系アイコン
- 通常時は背景になじませる
- Hover時のみ軽く濃くする

### Long filename

- 1行
- `text-overflow: ellipsis`
- Tooltipは独自Style
- Tooltipはフルファイル名
- TooltipはキーボードFocusでも表示

---

## 3. Collapsed sidebar

[ADOPTED]

56pxのRailを残す。

表示するアイコン候補:

- Expand
- Notes
- New note
- Archive
- Settings

Settingsは最下部。

DirtyなActive documentがある場合、Notesアイコンに小さなdotを表示してよい。

---

## 4. Top bar

[ADOPTED]

Tabsは禁止。

左:

```text
notes / designing-quieter-software.md
```

中央寄り:

```text
Write  Split  Read
```

右:

- Table of Contents
- Command Palette / Search
- More

---

## 5. Breadcrumb

Breadcrumbは「現在位置」を示す。

複数ファイルを並列管理するTabとしては使わない。

長すぎるBreadcrumbはトランケート可能。

---

## 6. View selector

### Write

Editorのみ。

### Split

```text
Editor | Preview
```

それぞれ独立スクロール。

**Nested vertical scrollは禁止。**

### Read

Previewのみ。

View selectorの背景・文字色は120–150ms程度で遷移してよい。

本文全体を派手にFadeしない。

---

## 7. Editor surface

上から:

1. Metadata summary
2. Document title
3. Markdown source

`MARKDOWN · AUTOSAVE` のような常設ラベルは表示しない。

Document titleはdescenderが欠けないLine boxを確保する。

---

## 8. Markdown syntax highlight

[ADOPTED]

Markdown本文の意味を持つ記号だけを控えめに色付けする。

例:

- `#`
- `>`
- `-`
- `*`
- `_`
- Backticks
- `[]()`
- `|`
- Horizontal rule
- Fenced code delimiter

本文自体を多色にしすぎない。

Production editor engine側のTokenizationを使う。

---

## 9. Metadata / YAML Front Matter

通常:

```text
Metadata · 4 fields                         ˅
```

Expanded:

```text
Metadata · 4 fields                         ˄

                         Fields   Raw

title     Designing quieter software
tags      design, editor
status    draft
created   2026-09-04
```

- 独立Card化しない
- 強い背景面を作らない
- Fields / Rawは小さな切替
- 使っていない時は本文の存在感を奪わない

---

## 10. Table of Contents

[ADOPTED]

常設ペインではなくTop bar iconからPopover。

- H1 / H2 / H3等を階層表示
- Active headingは薄い背景 + 1px程度の線
- 長い見出しはトランケート
- Clickで該当位置へ移動
- SplitではEditor / Previewの対応位置を扱う

---

## 11. Preview

Preview上部に`PREVIEW`ラベルは置かない。

文書タイトルから開始。

Front MatterはRaw YAMLではなく、

```text
design · editor      draft      2026-09-04
```

のように意味を圧縮。

### Table

- 横幅を超える場合だけtable wrapper内を横スクロール
- 縦方向のNested scrollは作らない
- Headerだけ少し面差をつける
- Heavy gridは避ける

---

## 12. Status bar

左:

- Ln
- Col
- Word count

右:

- UTF-8
- Markdown
- Spaces: 2

保存済み状態は表示しない。

---

## 13. Settings

Modal。

左Navigation:

- General
- Editor
- Appearance

右Content。

設定変更時はSettings内に一時的な`Saved` feedbackを出してよい。

これは文書保存状態のSavedとは別。

---

## 14. Empty states

[DRAFT]

### No document selected

中央に大きなIllustrationを置かない。

```text
Open a note
⌘P
```

程度の静かなガイドを推奨。

### Empty workspace

```text
No notes yet

Create note    Open folder
```

### Empty TOC

```text
Headings will appear here as you write.
```

---

## 15. Error states

保存失敗・YAML parse error・External conflictは、通常状態より強い表示を許可する。

静けさよりデータ保全を優先。
