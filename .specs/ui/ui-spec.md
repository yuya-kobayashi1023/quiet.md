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

### Folder tree

[DECIDED: U-024]

- 入れ子フォルダはツリー表示する。フォルダ行はDisclosureのみで、常設ボタンを増やさない
- フォルダの展開状態は `.quiet/workspace.json` に保持する
- dotfolderと `.quiet/` は既定で非表示。`node_modules/` はignore
- 並び順は名前順
- `Archive` は論理Archiveなので、フォルダではなくファイル行だけを並べる

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

[DECIDED: U-027] MVPではscrollを同期しない。

TOCからの移動だけが両ペインを動かす。将来、行対応の精度を上げたうえで同期Splitを検討する。

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

### Document title

[DECIDED: U-006 / U-020]

- 表示するのはファイル名から拡張子を除いた文字列
- 編集するとファイルがRenameされる。確定はblurまたはEnter
- 不正なファイル名・同名衝突はinline errorで示し、Renameしない（`file-lifecycle.md` §7）
- 長いタイトルは折り返す。固定高で切り取らない
- **これは文書の見出しではない。**Preview / 書き出しHTMLのH1にしない

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

- H1 / H2 / H3等を階層表示（本文の見出しレベルのまま。Title UIはTOCに含めない）
- Active headingは薄い背景 + 1px程度の線
- 長い見出しはトランケート
- Clickで該当位置へ移動
- SplitではEditor / Previewの対応位置を扱う

---

## 11. Preview

Preview上部に`PREVIEW`ラベルは置かない。

文書タイトル（＝ファイル名）から開始する。ただしこれは画面のchromeであり、文書の見出しではない。

[DECIDED: U-020]

- 本文の `#` は **H1のまま**描画する。降格しない
- Previewの先頭に置くタイトルは、書き出しHTMLの見出し構造に含めない
- TOCの階層は本文の見出しレベルをそのまま反映する

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

[DECIDED: U-030] 既定は文字数。クリックで語数へ切り替える。切替状態は保持する。

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

[DECIDED: U-022] Editor surfaceの最上部（Metadata summaryの上）にInline bannerを1本だけ出す。

```text
⚠ このファイルはエディタの外で変更されました
   差分を見る    自分の変更を残す    ディスクから再読込
```

- Modalにしない（入力を止めない）
- Toastにしない（消えてはいけない）
- Save error / External delete も同じ場所を使う

---

## 16. Find in document

[DECIDED: U-025] Editor paneの右上に、開いている間だけ存在するInline find barを出す。

```text
[ query            ]  3/12   ↑ ↓   Aa  .*   ✕
```

- Escで閉じる
- ReplaceはMVP外。ただし後続で追加する前提でレイアウトを確保しておく
- Command Paletteとは別物（`Ctrl/Cmd+K` はコマンド、`Ctrl/Cmd+F` は現在文書）

---

## 17. Toast

[DECIDED: U-026] Toastは1種類だけ許可する。

- 位置: Status barのすぐ上、左寄せ
- 同時表示: 1件のみ（新しいものが置き換える）
- 表示時間: Actionを持つ場合6秒、持たない場合3秒
- Actionは最大1つ（`Undo` など）
- データ損失に関わる通知はToastにしない（§15のInline banner）
