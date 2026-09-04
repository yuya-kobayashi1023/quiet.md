# Document Model

## 1. Document

Production内部モデル案。

```ts
type Document = {
  id: string;
  path: string;
  filename: string;
  extension: ".md" | ".markdown";

  rawText: string;
  body: string;

  frontmatter: FrontmatterState | null;

  displayTitle: string;
  titleSource: "frontmatter" | "filename" | "heading";

  encoding: "utf-8";
  hasBom: boolean;
  lineEnding: "lf" | "crlf";

  saveState: "clean" | "dirty" | "saving" | "save_error" | "conflict";

  diskRevision: {
    modifiedAt: number;
    size: number;
  };

  parseDiagnostics: Diagnostic[];
};
```

これは実装言語へそのまま固定する型ではなく、責任の抜けを防ぐ概念モデル。

---

## 2. Path

- Canonical pathを内部identityの基礎にする
- UIでは必要以上にフルPathを表示しない
- Symlinkの扱いはPlatform層で正規化

[DRAFT]

Windows pathの大小文字差等を考慮し、単純なString比較だけで同一Document判定しない。

---

## 3. Filename

filenameはOS上の実ファイル名。

Titleとは別。

[ADOPTED寄り]

Title変更でfilenameを自動Renameしない。

---

## 4. Title

[USER DECISION REQUIRED: U-006]

推奨:

### Front Matter `title`あり

```text
displayTitle = frontmatter.title
```

### Front Matterなし

filename stemをPlaceholder的に表示。

例:

```text
designing-quieter-software.md
→ Designing quieter software
```

ただしファイルを開いただけでFront Matterは挿入しない。

Title UIを編集した時点で`title`を追加。

---

## 5. Body

Front Matterを除いたMarkdown。

Raw file:

```md
---
title: Example
---

# Body
```

内部:

```text
frontmatterRaw = ...
body = "# Body"
```

ただし保存時はlossless preservationを優先する。

---

## 6. Frontmatter

詳細: `frontmatter.md`

Known UI fields:

- title
- tags
- status
- created

Unknown fieldsも保存する。

---

## 7. Workspace

推奨モデル:

```ts
type Workspace = {
  rootPath: string;
  documents: DocumentSummary[];
  archivedPaths: Set<string>;
  settings: WorkspaceSettings;
};
```

---

## 8. Workspace metadata

[USER DECISION REQUIRED: U-012]

推奨:

```text
.quiet/
└─ workspace.json
```

例:

```json
{
  "version": 1,
  "archived": [
    "archive-candidate.md"
  ],
  "lastOpened": "designing-quieter-software.md"
}
```

Markdown本文は入れない。

---

## 9. Dirty state

Dirtyは、

```text
memory representation != last successfully persisted revision
```

を意味する。

UI上はActive fileのdotで表現。

---

## 10. Disk revision

File watcherの誤検知や競合判定に、

- mtime
- size
- optional content hash

を使う。

自分自身のsaveによるwatch eventをExternal changeとして扱わないようにする。

---

## 11. Encoding

[DRAFT]

MVP:

- UTF-8を正式サポート
- UTF-8 BOMは読める
- 既存BOMは保存時に保持
- Shift-JIS等は明示Error / Unsupportedとする案

日本語Windows利用を考えると、Shift-JIS読込をLaterで追加する余地は残す。

---

## 12. Line endings

既存ファイルの、

- LF
- CRLF

を保持する。

新規ファイルはOSに関係なくLFを推奨。

[USER DECISION REQUIRED]

Windows新規ファイルもCRLFにする方針を希望する場合は変更可能。
