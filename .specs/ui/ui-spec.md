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

WORKSPACE                     ⌄
notes

NOTES                         +
document.md                 ●
long-document-name-that-...
                              ← ここまでがスクロール領域
─────────────────────────
ARCHIVE                       ⌄   ← 既定は閉じている。開くと上へ伸びる
old.md                            （開いたときだけ出る）
─────────────────────────
RECENT                        ⌄   ← 既定は閉じている
outside-the-workspace.md          （開いたときだけ出る）
More (3)

Settings
```

### Archive

[DECIDED: ADR-023]

- 見出しごと disclosure とし、既定は閉じた状態（見出し行のみ表示）とする。アーカイブが増えても Notes のスクロール領域を圧迫しないようにするため。
- 開閉状態は保存しない。Window ごと・起動ごとに閉じた状態から開始する。
- 開いているノートが Archive 側にあるときは自動で開く。閉じた状態では Active 表示が見えないため。自動で開いた後はユーザーが閉じられる。
- 件数は表示しない。Recent と同様に、見出し行を情報の置き場としないため。
- 1 件もない場合はセクションごと表示しない。
- Notes は折りたたまない。常に作業対象であり、畳みたいときは Sidebar ごと畳む導線があるため（ADR-006）。
- 位置は Sidebar の下端（Recent の直上）に固定し、Notes と一緒にスクロールさせない。開いた一覧は上方向へ伸ばし、高さは 10 行分を上限とする。未アーカイブのノートをできるだけ多く表示するためである（ADR-023 §7）。

### Multi select

[DECIDED: ADR-024]

- 選択対象は Notes と Archive のファイル行のみとし、フォルダ行・Recent 行・Workspace 行は対象外とする。
- Ctrl+クリックで選択を追加・解除し、Shift+クリックで起点からの範囲を選択する（macOS の Meta は Ctrl と同様に扱う）。
- 選択範囲は現在表示されている行の並びに基づく。Notes と Archive は連続した 1 つの並びとして扱い、折りたたまれたフォルダ内の行は含めない。
- 修飾キーなしのクリックでは、従来どおりノートを開き、選択を解除する。
- 選択中の行は左端の accent 罫線と淡い背景で表示する。Active 行とは異なる表現とし、両方に該当する行には重ねて適用する。
- 選択は、Escape、修飾キーなしのクリック、一括操作の完了、Workspace の切り替えで解除する。
- 選択件数は一括メニュー先頭の見出しで示し、行や Footer には表示しない。
- 選択状態は保存せず、Workspace metadata にも保持しない。
- 選択範囲内を右クリックすると一括メニューを表示する（interactions.md §13）。

### Recent

[DECIDED: ADR-013]

- Workspace 外で開いたファイルのうち、いずれの既知 Workspace にも属さないファイルのみを
  開いた新しい順に並べる。Workspace 履歴のいずれかに属するファイルは、その Workspace へ
  切り替えて開くためここには表示されない（ADR-018）
- 位置は Sidebar の下端に固定する。Notes と一緒にスクロールさせない。
  Notes が増減しても Recent の位置が動かないようにするため
- 見出しの上に薄い区切り線を置く。スクロールする Notes と、下端に固定した区分（Archive / Recent）の境目を示すためである。禁止事項の「Settings上の強いdivider」とは異なり、行と同じ左右インセットとし、border 色を落とした 1px に留める。
- Settings との間には余白を取る。線は引かない
- 現在の Workspace の中にあるファイルは出さない（Notes 側に出ている）
- 見出しごと disclosure にする。既定は閉じた状態で、見出しの行だけを出す。
  「たまに戻る」ためのものを常に視界へ入れない
- 履歴は 30 件保持する。開いたとき出すのは 10 件。残りは `More` を押したときだけ出す。
  表示件数は Settings に項目を作らない（Sidebar の高さは Recent より Notes に使う）
- リストの高さは 10 行ぶんが上限。`More` で開いたぶんはこの中でスクロールする
- ツリーにしない。フォルダが違うファイルが混ざるため、常にフラットな1階層
- Tooltip は常にフルパス。同名のファイルが並びうる
- 1件もなければセクションごと出さない
- Context menu は Workspace 内のファイルと別（Archive / 名前変更 / 複製は出さない）

禁止:

- `FILES` 見出し
- Logo placeholder
- `3 notes / local` のFooter表示
- Settings上の強いdivider
- Saved文字列

### Workspace

[DECIDED: ADR-016]

- 位置は Sidebar 最上部（Notes の上）。Notes / Archive の中身を決めるものなので、結果より上に置く
- 常設するのは今開いている Workspace の 1 行だけ。Notes の選択行と同じハイライトを付ける
- 未選択のときは `Workspace を選択` と出し、ハイライトしない
- 見出しの右に `⌄`。押すと履歴のドロップダウンが開く。現在の行を押しても開く
- ドロップダウンの各行は フォルダ名 + 相対時刻（`たった今` / `2時間前` / `昨日` / `1週間前`）。
  並び順が「開いた新しい順」なので絶対時刻は出さない
- 表示名はフォルダ名。Tooltip は常にフルパス。同名フォルダが並びうる
- 今開いている Workspace も一覧に残し、アイコンを accent で塗って現在地を示す
- 一覧はスクロールする。その外側の固定行として `新しいワークスペースを開く…`（フォルダ選択）を置く
- 履歴が空でも固定行は出る。ここが Workspace を開く導線になるため
- 覚えるのは 10 件。表示件数も同じ 10 件で、Settings に項目を作らない
- アイコンは Folder と分ける（重ねた面）。ツリー上の 1 フォルダではないため
- Context menu は 開く / 新しいウィンドウで開く / パスをコピー / エクスプローラーで表示 / 履歴から削除
- 行をクリックしたとき、フォルダが無ければその場で履歴から外してToastで知らせる
- Keyboard: `↑` `↓` で候補移動（固定行も含む）、`Escape` と外側クリックで閉じる

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
- 並び順は、各階層でフォルダ行を名前順で先に配置し、ファイル行を作成日時の新しい順でその後に配置する（ADR-019）。
  作成日時が同じファイルは名前順とする
- ピン止めしたファイル行は、サブフォルダ配下にあっても区分の先頭に depth 0 で配置し、フォルダ側には表示しない（所属フォルダの行は残す、ADR-020）。
- ピン止めしたファイル同士は作成日時の新しい順に並べる。ピンのアイコンで表示し、切り替えは Context Menu のみで行う（Recent には適用しない）。
- `Archive` は論理Archiveなので、フォルダではなくファイル行だけを並べる

### Created at

[DECIDED: ADR-019]

作成日時は既定では表示せず、Settings の Appearance「作成日時を表示」を on にした場合のみ表示する。

- Notes / Archive のファイル行の右端に `yyyy-mm-dd hh:mm`（ローカル時刻）を表示し、Workspace 履歴の相対時刻と同じ字の大きさと色にする
- Recent の行には表示しない。Recent の並び順は「開いた順」であり、作成日時は並び順の説明にならない
- 作成日時は OS のファイル作成時刻であり、保存しても変わらない

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
- Workspace（切り替えドロップダウン。最上部、他と divider で分ける — ADR-016）
- Notes
- New note
- Archive
- Settings

Settingsは最下部。

各アイコンには名前を Tooltip で表示する（ADR-027）。

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

スクロールコンテナはペインごとに1本。

[DECIDED: ADR-012] scrollは同期する（設定 `syncScroll`、既定ON）。

割合合わせではなく、Preview側の `data-source-line` とEditorの行ジオメトリで
作った行の対応表を線形補間する。掴んだ側が駆動側になる。
設定でOFFにすると、それぞれ独立スクロールになる。

TOCからの移動は同期の有無にかかわらず両ペインを動かす。

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

### 入力の自動修正

[DECIDED: ADR-022]

IME で確定された全角の英数字・記号（`Ａ` `１２` `！` `（）` `“ ”`、全角空白）は、その確定で入力された範囲のみ半角へ変換する。Settings の Editor「全角の英数字と記号を半角にする」（既定 on）で切り替える。

- `： ； ， ． ～` は「区切り記号も半角にする」（既定 off）で個別に切り替える。`。` `、` `「」` `・` `ー` は変換しない。

### 右クリックメニュー

[DECIDED: ADR-025]

本文領域の右クリックでは、WebView の既定メニューではなく Quiet の Context menu を表示する（`interactions.md` §13）。対象は Write と Split の編集面のみとし、Preview・Metadata・Status bar・Find bar は変更しない。

既定メニューを抑止するため、スペルチェックの修正候補は表示されない。ただし、`spellCheck` 設定による赤波線は従来どおり表示する。

### 箇条書きの字下げ

[DECIDED: ADR-026]

- リスト項目を折り返す際は、2行目以降を marker の後ろの本文位置に揃える。task list は `[ ] ` の後ろに揃える。
- カーソルを含む箇条書き内のみ、子リストの左側かつ親 marker の真下に細い縦線を表示する。カーソルがリスト外へ出た場合は非表示にする。

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

### Fenced code blockの中身

[DECIDED: ADR-009]

Fenceに言語が書かれているときだけ、中身をハイライトする。

- 色の役は5つ。`--code-keyword` / `--code-string` / `--code-number` / `--code-comment` / `--code-entity`
- Editorとpreviewで同じ役割分けを使う
- 言語指定のないFenceは推定しない。本文色のまま出す

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
