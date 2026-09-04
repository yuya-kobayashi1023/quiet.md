# Native / Frontend Interfaces

> 実装時の責任境界を固定するためのたたき台。関数名は変更可。

## 1. Workspace

```ts
openWorkspace(path: string): Promise<WorkspaceSnapshot>
```

```ts
listDocuments(workspaceId: string): Promise<DocumentSummary[]>
```

```ts
createDocument(input: {
  workspaceId: string;
  directory?: string;
  filename?: string;
}): Promise<DocumentSnapshot>
```

---

## 2. Read

```ts
readDocument(path: string): Promise<{
  path: string;
  content: string;
  encoding: "utf-8";
  hasBom: boolean;
  lineEnding: "lf" | "crlf";
  modifiedAt: number;
  size: number;
}>
```

---

## 3. Save

```ts
saveDocument(input: {
  path: string;
  content: string;
  expectedRevision?: {
    modifiedAt: number;
    size: number;
  };
  lineEnding: "lf" | "crlf";
  hasBom: boolean;
}): Promise<{
  modifiedAt: number;
  size: number;
}>
```

Expected revisionが一致しない場合は`CONFLICT`を返す。

---

## 4. Rename

```ts
renameDocument(input: {
  from: string;
  toFilename: string;
}): Promise<{
  path: string;
}>
```

---

## 5. Archive

Archiveが論理方式の場合:

```ts
setArchived(input: {
  workspaceId: string;
  path: string;
  archived: boolean;
}): Promise<void>
```

---

## 6. File watcher event

```ts
type FileWatchEvent =
  | {
      type: "changed";
      path: string;
      modifiedAt: number;
      size: number;
    }
  | {
      type: "removed";
      path: string;
    }
  | {
      type: "renamed";
      from: string;
      to: string;
    };
```

---

## 7. Native dialogs

```ts
chooseWorkspace(): Promise<string | null>
chooseMarkdownFile(): Promise<string | null>
saveAsMarkdown(defaultName: string): Promise<string | null>
```

---

## 8. Reveal

```ts
revealInFileManager(path: string): Promise<void>
```

Windows:

Explorer。

macOS:

Finder。

---

## 9. Error contract

```ts
type NativeErrorCode =
  | "NOT_FOUND"
  | "PERMISSION_DENIED"
  | "ALREADY_EXISTS"
  | "INVALID_FILENAME"
  | "CONFLICT"
  | "UNSUPPORTED_ENCODING"
  | "IO_ERROR";
```

Messageはデバッグ用とUI用を分離してもよい。

---

## 10. Settings

```ts
loadAppSettings(): Promise<AppSettings>
saveAppSettings(settings: AppSettings): Promise<void>
```

FrontendでLocalStorageへバラバラに保存せず、ProductionではSettings serviceへ集約する案を推奨。

---

## 11. Window

[DRAFT]

```ts
openDocumentInNewWindow(path: string): Promise<void>
```

Tabsを実装しないため、Multi-windowの責任はNative window layerへ置く。

---

## 12. Search

Quick Open:

FrontendでDocumentSummaryをFilter可能。

Search All:

Workspace規模次第で、

- Frontend scan
- Rust parallel scan
- Index

を選ぶ。

[USER DECISION REQUIRED: U-013]

MVPではSearch Allを後回しにする推奨。
