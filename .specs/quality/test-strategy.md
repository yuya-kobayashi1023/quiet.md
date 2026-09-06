# Test Strategy

## 1. 方針

UI Snapshotだけでは不十分。

以下を分ける。

1. Unit
2. Domain
3. Native integration
4. Component
5. E2E
6. Manual platform regression

---

## 2. Unit tests

### Front Matter

- no frontmatter
- valid YAML
- array tags
- nested unknown field
- comments
- quoted strings
- invalid YAML
- `---` inside body

### Markdown

- heading parse
- table
- code fence
- TOC extraction

### Filename

- truncate UI logic
- invalid Windows chars
- collision

---

## 3. State tests

Save state:

```text
clean → dirty → saving → clean
```

Failure:

```text
dirty → saving → save_error
```

Conflict:

```text
dirty + external change → conflict
```

---

## 4. Filesystem integration

Temporary directoryで実ファイルを使う。

- read
- atomic save
- rename
- permission failure
- delete externally
- modify externally
- watcher self-save suppression

---

## 5. Editor tests

Production editor engineで、

- Japanese IME
- Composition event
- Undo
- Large paste
- Selection
- Syntax highlight
- Line wrap
- Split resize

を確認。

IMEは自動テストだけでなくManual必須。

---

## 6. UI component tests

- Sidebar expand/collapse
- Settings open/close
- TOC open/close
- Front Matter Fields/Raw
- Theme switch
- Dirty dot
- Tooltip
- New Note

---

## 7. E2E scenarios

### Scenario 1: Create and autosave

```text
Open workspace
→ New Note
→ Rename
→ Type
→ Dirty dot
→ Autosave
→ dot disappears
→ restart app
→ content remains
```

### Scenario 2: External edit

```text
Open file
→ external process edits file
→ app reloads
```

### Scenario 3: Conflict

```text
Open file
→ type locally
→ external process edits file
→ conflict UI
→ Keep mine
```

### Scenario 4: Front Matter

```text
Open YAML document
→ Fields edit title
→ Raw reflects
→ Preview metadata reflects
→ save
→ unknown YAML key remains
```

### Scenario 5: Split scroll

```text
Open long document
→ Split
→ Editor has one vertical scrollbar
→ Preview has one vertical scrollbar
→ no nested editor scrollbar
```

---

## 8. Visual regression

Light / Darkで主要画面Screenshot。

対象:

- Write
- Split
- Read
- Sidebar collapsed
- TOC
- Settings
- Metadata expanded
- Tooltip
- Save error
- Conflict

Pixel-perfect固定ではなく、大きなRegression検出用途。

---

## 9. Accessibility tests

- Tab order
- Focus trap
- Esc
- aria labels
- contrast
- reduced motion

---

## 10. Platform matrix

### Windows

最低1つのWindows 11環境で毎release確認。

### macOS

対応開始後に、

- keyboard
- Finder
- titlebar
- file permission

を別matrix化。

---

## 11. Acceptance mapping

各E2E / Integration test名にAcceptance Criteria IDを付ける方式を推奨。

例:

```text
AC-SAVE-004
AC-FM-007
AC-SPLIT-002
```

実装時に`acceptance-criteria.md`へIDを正式付与してもよい。
