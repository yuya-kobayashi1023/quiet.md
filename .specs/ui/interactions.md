# Interaction & State Specification

## 1. Document save state

Productionでは最低限次を持つ。

```text
clean
  ↓ edit

dirty
  ↓ autosave trigger

saving
  ├─ success → clean
  └─ failure → save_error
```

External change:

```text
clean + external change
→ reload
→ clean
```

```text
dirty + external change
→ conflict
```

---

## 2. Save state UI

| State | UI |
|---|---|
| clean | 表示なし |
| dirty | ファイル名右にaccent `●` |
| saving | `●`を維持 |
| save_error | Warning icon + 明示メッセージ |
| conflict | Conflict UI |

`Saved`文字列をStatus barに常時出さない。

---

## 3. Dirty dot animation

Appearance:

```text
opacity 0 → 1
scale .7 → 1
```

Save成功:

```text
scale 1 → .6
opacity 1 → 0
```

120ms前後。

---

## 4. New Note

```text
+ click
→ 新規Documentを作成
→ Sidebarに行出現
→ Active
→ filename rename state
→ dirty
```

Row appearance:

- height 0 → normal
- opacity 0 → 1
- 100–160ms

[DECIDED: U-015] `Untitled.md` を作成して即Rename。衝突時は `Untitled 2.md`。

New Noteの初期ファイル名候補:

**推奨:** `Untitled.md` を一時名として作成し、即Rename UI。

代替: `YYYY-MM-DD-HHmm.md`

---

## 5. Sidebar collapse

Expanded → Collapsed:

1. Sidebar content text fade
2. Width 226 → 56
3. Rail icon visible

180ms程度。

Collapsed → Expandedは逆。

Keyboard:

```text
Ctrl/Cmd + B
```

---

## 6. View switch

Write / Split / Read。

Active selectorは150ms以内。

本文全体のFadeは禁止。

SplitではLayout resize後にEditor layout engineへreflowを通知する。

---

## 7. Table of Contents

Open:

- opacity
- translateY 4–6px

Click heading:

- Active item更新
- 該当Headingへscroll
- Popoverを閉じるかは[DRAFT]

**推奨:** Desktopでは選択後に閉じる。連続移動したい場合だけPin機能を将来検討。

---

## 8. Front Matter

Collapsed:

```text
Metadata · N fields
```

Click → Expanded。

Mode:

```text
Fields | Raw
```

Fields edit:

```text
field edit
→ raw YAML patch
→ document dirty
```

Raw edit:

```text
raw edit
→ parse
├─ valid → Fields sync
└─ invalid → Rawを保持、Fields sync停止
```

Invalid YAMLでもユーザー入力を消さない。

---

## 9. Settings

Open:

```text
overlay opacity 0 → 1
panel translateY 6px → 0
```

150–180ms。

Setting変更:

```text
control state changes
→ persist
→ Settings内 "Saved"
→ 1秒前後でfade
```

---

## 10. Command Palette

Shortcut:

```text
Ctrl/Cmd + K
```

Open:

- overlay
- small translate
- focus input

Escで閉じる。

将来的にQuick OpenとCommand executionを統合してよい。

---

## 11. Tooltip

Filenameが実際に省略される場合のみ表示。

アイコンのみのボタンは省略の有無によらず名前を表示し、ショートカットがある場合は併記する（ADR-027）。

- Mouse hover
- Keyboard focus

Delay:

[DRAFT] 300–500msを推奨。

Tooltipに操作を置かない。

---

## 12. Archive

[DECIDED: U-005] 論理Archive。実ファイルは移動しない。Archiveしても同名ファイルは作れない点は制約として受け入れる。

推奨挙動:

```text
Archive
→ NotesからArchiveへ移動
→ Toast "Archived xxx.md    Undo"
```

物理ファイルは移動しない推奨。

折りたたみ（ADR-023）:

- Archive 区分は見出しごと折りたたみ可能とし、既定は閉じた状態とする。
- 開閉状態は保存せず、Window ごとおよび起動ごとに閉じた状態で開始する。
- 開いているノートが Archive 側にある場合は自動で開く。その後はユーザーが閉じられる。
- アーカイブが 1 件もない Workspace では、区分ごと非表示とする。

---

## 13. Context Menu

[DRAFT]

File row right click:

```text
Open
Open in New Window
──────────
Rename
Duplicate
Copy Path
Reveal in Explorer/Finder
──────────
Pin
Archive
```

Pin済み:

```text
Unpin
```

Archive済み:

```text
Restore
```

Pin と Archive は独立した flag とする（ADR-020）。Recent の Context Menu には Pin を表示しない。

破壊的DeleteはMVPでは出さない案を推奨。

まとめて選択したとき（ADR-024）:

```text
3 件を選択中
──────────
アーカイブ
アーカイブから戻す
──────────
ピン止め
ピン止めを外す
──────────
パスをコピー
──────────
選択を解除
```

- 選択が 2 件以上ある状態で選択内の行を右クリックした場合は、選択全体に対するメニューを表示する。
- 選択外を右クリックした場合は選択を解除し、その 1 件に対する従来のメニューを表示する。
- 「アーカイブ」は選択内に未アーカイブのファイルが 1 件以上ある場合のみ表示し、「アーカイブから戻す」はアーカイブ済みのファイルが 1 件以上ある場合のみ表示する。ピン止めとその解除も同様の規則で出し分け、両方が混在する選択では両方の項目を表示する。
- 先頭の件数はクリック不可の見出しとする。
- 「パスをコピー」は、選択したファイルのフルパスを改行区切りでまとめて書き込む。並び順は Sidebar の表示順とする。
- 1 件にしか意味を持たない操作（開く・名前を変更）、実行のたびにウィンドウやファイルが増える操作（新しいウィンドウで開く・複製）、「エクスプローラーで表示」は表示しない。破壊的な Delete も引き続き表示しない。

Editor body right click（ADR-025）:

対象は Write と Split の編集面のみとする。目次は Top bar から開く導線があるため、メニュー項目に含めない。

```text
元に戻す              Ctrl+Z
やり直す              Ctrl+Y
──────────
切り取り              Ctrl+X
コピー                Ctrl+C
貼り付け              Ctrl+V
──────────
太字
斜体
インラインコード
リンク
──────────
引用
箇条書き
チェックリスト
──────────
"◯◯" を検索
```

- 選択範囲外を右クリックしたときは、クリック位置へカーソルを移動してからメニューを表示する。選択範囲内では選択状態を維持する。
- 切り取り、コピー：非選択時は無効とする。
- 太字、斜体、インラインコード：非選択時も押下可能とし、記号のみを挿入してカーソルを記号の内側に置く。
- 元に戻す、やり直す：履歴が存在しないときは無効とする。
- 書式項目はトグルとして動作する。ブロック書式は選択範囲に含まれるすべての行を対象とし、すべての行が同じ接頭辞を持つ場合のみ解除する。
- 書式項目にショートカットは割り当てない。メニューに表示するのは既存のショートカットに限る。
- 「"◯◯" を検索」はテキスト選択時のみ表示し、選択文字列を Find bar へ渡して開く。選択文字列が長い場合は表示を省略する。

---

## 14. External change

### Local clean

```text
disk changed
→ reload automatically
→ optional subtle "Updated from disk"
```

### Local dirty

```text
disk changed
→ conflict
```

Conflict UI推奨:

```text
This file changed outside the editor.

Compare changes
Keep mine
Reload from disk
```

---

## 15. Window close

clean:

```text
close immediately
```

dirty:

Autosaveを即実行。

成功:

```text
close
```

失敗:

```text
Changes could not be saved.

Save As…
Discard
Cancel
```

---

## 16. Copy feedback

Copy系操作:

```text
Copy icon
→ Check
→ 1.2s
→ Copy icon
```

可能ならToastを使わない。
