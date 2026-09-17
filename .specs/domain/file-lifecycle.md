# File Lifecycle

## 1. Open

```text
select file
→ stat
→ read bytes
→ detect encoding
→ detect line endings
→ parse frontmatter
→ load editor
→ clean
→ start watch
```

ファイルをOpenしただけでは書き戻さない。

---

## 2. New

[DRAFT]

```text
New Note
→ determine directory
→ temporary/default filename
→ create file
→ activate
→ rename mode
```

### Collision

`Untitled.md`が存在する場合:

```text
Untitled 2.md
Untitled 3.md
```

等。

---

## 3. Edit

Editor / Title / Metadataの編集は同じDocument dirty stateへ統合。

複数の別々なDirty flagを持たない。

---

## 4. Autosave

[DECIDED: U-008] 700ms idle debounce + 即時save条件。Autosave前後でカーソル位置・選択・スクロールを保持する。

確定trigger:

- 最終入力から700ms
- Document switch前
- Window blur
- `Ctrl/Cmd+S`
- App close前

### Autosaveが編集状態を壊さないこと

**Autosaveの前後で、カーソル位置・選択範囲・スクロール位置を変えない。**

- 保存はmemoryの内容をディスクへ書く一方通行にする。保存処理からEditorのstateへ書き戻さない
- 自分のsaveによるwatch eventはcontent hashで抑制する（U-028）
- やむを得ずreloadする場合も、Editorのdocumentを差し替えるのではなく
  transactionで差分を適用し、selectionを明示的に引き継ぐ
- Editorコンポーネントを再mountさせない

---

## 5. Atomic save

必須推奨。

```text
serialize
→ temp file write
→ fsync/flush where appropriate
→ atomic replace/rename
→ update disk revision
→ clean
```

直接既存ファイルへ途中まで上書きしない。

Platform差異はRust/File serviceで吸収。

---

## 6. Save error

```text
saving
→ IO error
→ save_error
```

Dirty contentはmemoryに保持。

UI:

- File rowにwarning
- Message
- Retry
- Save As…

Status barの小さな色だけで済ませない。

---

## 7. Rename

明示操作だけ。

Flow:

```text
Rename
→ inline filename edit
→ validate
→ filesystem rename
→ update workspace metadata (archived / pinned / lastOpened)
→ update watcher
→ update breadcrumb
```

### Invalid

OS禁止文字・同名collisionをInline error。

Titleは変えない。

---

## 8. Archive

[DECIDED: U-005] 論理Archive。実ファイルは移動しない。Archiveしても同名ファイルは作れない点は制約として受け入れる。

推奨:

```text
archive metadata = true
```

ファイルpathは維持。

SidebarのNotesからArchiveへ移る。

Undo可能（Toastから。U-026）。

Archiveしてもファイル名は解放されない。
Archive済みの `note.md` がある状態で、同じフォルダに新しい `note.md` は作れない。
New Note時の衝突はU-015の連番規則で回避する。

---

## 9. Restore

Archive metadata解除。

Notesへ戻す。

---

## 10. Delete

[DRAFT]

MVPでは通常UIにDeleteを出さない案を推奨。

必要なら、

- Move to OS Trash
- Never permanent unlink by default

を推奨。

---

## 11. External modification

[DECIDED: U-010] File watcherは既定ON。Cleanは自動Reload、DirtyはConflict。

### Clean

```text
watch event
→ verify not self-save
→ reload
```

### Dirty

```text
watch event
→ conflict
→ stop autosave overwrite
```

重要: Dirtyなmemory内容で外部変更を黙って上書きしない。

---

## 12. External deletion

```text
file removed outside app
```

UI:

```text
This file was removed outside the editor.

Save a copy
Close
```

DirtyならSave a copyを強く推奨。

---

## 13. Close document/window

### Clean

即時。

### Dirty

Autosave。

### save_error

Modal:

```text
Changes could not be saved.

Save As…
Discard
Cancel
```

---

## 14. Crash recovery

[DRAFT]

MVP推奨。

Dirty bufferをApp Dataへ短周期Snapshot。

正常save時は消す。

Crash後:

```text
Recovered unsaved changes
```

として復旧可能。

Markdown本体を壊さない補助機能。

---

## 15. File watcher race

Productionで明示的にテストする。

例:

1. save temp
2. rename
3. watcher event
4. self-changeをexternal扱い
5. reload
6. cursor position lost

これを避けるため、save transaction ID / revision比較等を使う。
