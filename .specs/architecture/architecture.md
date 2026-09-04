# Architecture

> これは推奨たたき台。Stackはユーザー判断対象。

## 1. Proposed stack

[USER DECISION REQUIRED: U-002]

```text
Tauri 2
├─ Frontend
│  ├─ React
│  ├─ TypeScript
│  ├─ CodeMirror 6
│  └─ remark/unified
│
└─ Native
   └─ Rust
      ├─ File I/O
      ├─ Watcher
      ├─ Native dialog
      ├─ Window integration
      └─ Atomic save
```

---

## 2. Boundary principle

Frontendから任意Pathへ直接Filesystem accessしない。

```text
UI
↓
Application service
↓
Tauri command
↓
Rust filesystem layer
↓
OS
```

理由:

- 権限
- Error normalization
- Atomic save
- Testability
- Platform差異
- Watcherとの整合

---

## 3. Frontend modules

推奨:

```text
src/
├─ app/
├─ features/
│  ├─ editor/
│  ├─ preview/
│  ├─ sidebar/
│  ├─ frontmatter/
│  ├─ toc/
│  ├─ settings/
│  ├─ command-palette/
│  └─ search/
├─ domain/
│  ├─ document/
│  └─ workspace/
├─ services/
│  ├─ document-service/
│  ├─ settings-service/
│  └─ native-bridge/
└─ ui/
   ├─ tokens/
   └─ components/
```

Feature単位の責任を優先し、巨大な`components/`へ全部置かない。

---

## 4. Native modules

```text
src-tauri/src/
├─ commands/
├─ filesystem/
├─ watcher/
├─ settings/
├─ window/
└─ errors/
```

---

## 5. Editor

[USER DECISION REQUIRED: U-003]

CodeMirror 6推奨。

責任:

- Source text
- Selection
- Undo
- Find
- Highlight
- IME
- Keymap

Preview parseとは分離。

---

## 6. Markdown parse

[USER DECISION REQUIRED: U-004]

remark/unified推奨。

1つのparse結果を可能な範囲で、

- Preview
- TOC
- Diagnostics

へ利用。

EditorのSyntax parserと完全同一である必要はない。

---

## 7. State management

[DRAFT]

Global state libraryを最初から大きく入れすぎない。

分離:

### Persistent app state

- Theme
- Settings
- Last workspace

### Workspace state

- file summaries
- archive flags

### Document session state

- text
- frontmatter
- dirty
- cursor
- view mode

---

## 8. Save ownership

Save transactionはDocument serviceが統括。

Editor componentが直接writeしない。

```text
Editor onChange
→ DocumentSession dirty
→ Autosave coordinator
→ Document service
→ Native file command
```

---

## 9. Front Matter ownership

Raw textを失わないため、

- Parsed objectだけを正本にしない
- YAML Document/CST相当を保持

UI FieldsはView / Editing projection。

---

## 10. Watcher

Rust側推奨。

EventをFrontendへ送る前に、

- path normalize
- debounce
- self-save suppression

を行う。

---

## 11. Error model

Native errorを文字列だけで返さない。

例:

```ts
type FileError =
  | { code: "NOT_FOUND"; path: string }
  | { code: "PERMISSION_DENIED"; path: string }
  | { code: "CONFLICT"; path: string }
  | { code: "IO_ERROR"; message: string };
```

UI側が適切なFeedbackを選べるようにする。

---

## 12. Security

Tauri allowlist / capabilityは最小化。

Workspace外への書込みは、

- User file dialog
- User explicit open

等から得たPathへ限定する設計を推奨。

---

## 13. App metadata

[USER DECISION REQUIRED: U-012]

`.quiet/workspace.json` を使う場合、Document file writeとは別transaction。

Metadata corruption時にMarkdown本文へ影響しない。

---

## 14. Packaging

[DRAFT]

Windows:

- MSI / NSIS等

macOS:

- dmg

自動UpdateはMVP外でもよいが、将来導入を阻害しないVersioningにする。
