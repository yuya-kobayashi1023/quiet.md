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

[DECIDED: U-028] 競合判定は mtime + size + content hash で行う。

```ts
expectedRevision?: {
  modifiedAt: number;
  size: number;
  contentHash: string;
}
```

hashは最後に読み書きした内容のものをメモリに保持し、
ディスク側はwatcherイベント時にだけ再計算する。
保存のたびにファイル全体を読み直さない（Box Drive等のオンデマンド同期対策）。

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

### 5.1 Pin

ピン止め（ADR-020）は `archived` と同様の形式とし、`.quiet/workspace.json` 内の相対パス一覧 `pinned` に保持する。`pinned` キーのない既存ファイルは空の一覧として読み込む。

```ts
setPinned(input: {
  workspaceId: string;
  path: string;
  pinned: boolean;
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

/** フォルダを表示する。中身に触れないため Workspace scope の判定は行わない（ADR-016）。 */
revealFolder(path: string): Promise<void>
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

## 11. Window / 起動対象

[DECIDED: ADR-013]

```ts
type OpenTarget =
  | { kind: "workspace"; path: string }
  | { kind: "file"; path: string };

openInNewWindow(path: string): Promise<void>

/** Workspaceを新しいWindowで開く（ADR-016）。同一フォルダの重複は許す。 */
openWorkspaceInNewWindow(path: string): Promise<void>

/** 起動時に渡された対象を引き取る。2度目はnull。 */
takeLaunchTarget(): Promise<OpenTarget | null>

/** このWindowが開いている文書をNativeへ知らせる（U-021の判定に使う）。 */
registerDocumentWindow(path: string | null): Promise<void>

/** 実行中に届いた対象。自分のWindow宛だけを受け取る。 */
onOpenTarget(handler: (target: OpenTarget) => void): Promise<() => void>
```

Tabsを実装しないため、Multi-windowの責任はNative window layerへ置く。

どのWindowがどの文書を開いているかはNative側が持つ（`AppState.document_windows`）。
Frontendは開く・閉じるたびに `registerDocumentWindow` で通知する。

[DECIDED: ADR-018] 外部から渡された対象の配り先も Native 側が決定する。Native が Window の
focus 順を保持し、「同一ファイルのWindow」→「最後にfocusしたWindow」→「Windowが無ければ新規作成」
の順で配る。Frontend への新しい IPC は追加されない。

受け取った側が Workspace を切り替えるかどうかは Frontend が判断し、App settings の
Workspace 履歴（ADR-016）のみに基づいて決定する。Native はファイルの所属を調べない。

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

[DECIDED: U-013] Quick OpenとFindはMVP。Search AllはP1。

MVPではSearch Allを後回しにする推奨。
