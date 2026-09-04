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

  // displayTitle は filename から導出する。保持しない。
  displayTitle: string;

  encoding: "utf-8";
  hasBom: boolean;
  lineEnding: "lf" | "crlf";

  // 外部削除時の状態とconflictからの復帰遷移は未定義。U-022を参照。
  saveState: "clean" | "dirty" | "saving" | "save_error" | "conflict" | "missing";

  diskRevision: {
    modifiedAt: number;
    size: number;
    contentHash: string;
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

filenameはOS上の実ファイル名であり、**同時に文書のTitleでもある**。

[DECIDED: U-006 / U-020]

```text
displayTitle = filename から拡張子を除いた文字列
```

Title UIの編集はファイルのRenameとして扱う（`file-lifecycle.md` §7 のRename flowを通す）。

これは `product/principles.md` §5「タイトル変更でファイル名を勝手に変えない」の例外ではない。
Title UIがファイル名そのものの編集欄であるため、ユーザーは明示的にファイル名を編集している。

他のUI（本文、Metadata、Preview）からfilenameが変わることはない。

---

## 4. Title

[DECIDED: U-006] Title UIはファイル名から拡張子を除いた文字列。`frontmatter.title` とは連動しない。

Titleの正本はfilenameのみ。分岐はない。

```text
designing-quieter-software.md
→ Title UI: "designing-quieter-software"
```

ファイル名を整形しない（ハイフンをスペースに置換する等の加工をしない）。
表示されている文字列がそのままファイル名になる。

### `frontmatter.title` がある場合

Title UIには使わない。Metadata Fieldsの1項目として表示・編集・保存するだけ。

ファイルを開いただけでFront Matterを挿入しない、という原則は維持される。
Titleを編集してもFront Matterは増えない。

### 本文先頭の `# Heading` がある場合

何もしない。本文はTitleに影響しない。

`titleSource` は不要になったため、Documentモデルから削除する。

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

[DECIDED: U-012] `.quiet/workspace.json` を許可する。

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

[DECIDED: U-028] File watcherの誤検知や競合判定に、

- mtime
- size
- content hash（必須）

を使う。

hashは最後に読み書きした内容のものをメモリに保持する。
同期フォルダ（OneDrive / Box等）はメタデータだけを書き換えることがあるため、
mtimeとsizeだけでは誤検知する。

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

[DECIDED: U-016] 既存ファイルはLF / CRLFを保持。新規はLF。

Windows新規ファイルもCRLFにする方針を希望する場合は変更可能。
