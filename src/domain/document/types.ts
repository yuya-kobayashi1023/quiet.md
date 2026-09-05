/**
 * Document / Workspace のモデル。
 * .specs/domain/document-model.md と architecture/interfaces.md に対応する。
 */

export type LineEnding = "lf" | "crlf";

export type SaveState =
  | "clean"
  | "dirty"
  | "saving"
  | "save_error"
  | "conflict"
  | "missing";

export interface DiskRevision {
  modifiedAt: number;
  size: number;
  /** U-028: mtime と size だけでは足りないため必須。 */
  contentHash: string;
}

export interface DocumentContent {
  path: string;
  filename: string;
  /** メモリ上は常に LF。保存時に lineEnding へ戻す。 */
  content: string;
  encoding: "utf-8";
  hasBom: boolean;
  lineEnding: LineEnding;
  revision: DiskRevision;
}

export interface DocumentSummary {
  relativePath: string;
  path: string;
  filename: string;
  /** 拡張子を除いたファイル名。これが Title（U-006 / U-020）。 */
  title: string;
  modifiedAt: number;
  size: number;
}

export interface WorkspaceSnapshot {
  rootPath: string;
  name: string;
  documents: DocumentSummary[];
  truncated: boolean;
}

export interface WorkspaceMetadata {
  version: number;
  archived: string[];
  lastOpened: string | null;
  expandedFolders: string[];
}

/* ------------------------------------------------------------------ *
 * Workspace 全文検索（U-013 / ADR-011）
 * ------------------------------------------------------------------ */

export interface SearchQuery {
  query: string;
  /** 既定は true。Archive も探す。 */
  includeArchived: boolean;
  caseSensitive: boolean;
}

export interface SearchMatch {
  /** ファイル先頭からの行番号（1 始まり）。Front Matter も 1 行として数える。 */
  line: number;
  /** 行頭からの位置（1 始まり、UTF-16 code unit）。JS の文字列位置と一致する。 */
  column: number;
  length: number;
  /** 表示用に切り出した行。 */
  preview: string;
  /** preview 内での一致開始位置。 */
  previewColumn: number;
  previewTruncatedStart: boolean;
  previewTruncatedEnd: boolean;
}

export interface SearchFileResult {
  document: DocumentSummary;
  matches: SearchMatch[];
  /** 総ヒット数。上限で切られている場合 `matches.length` より大きい。 */
  matchCount: number;
  archived: boolean;
}

export interface SearchResults {
  files: SearchFileResult[];
  totalMatches: number;
  /** 上限で打ち切ったか。 */
  truncated: boolean;
  scannedFiles: number;
}

export interface RenameResult {
  path: string;
  relativePath: string;
  filename: string;
  title: string;
}

export interface RecoverySnapshot {
  path: string;
  content: string;
  savedAt: number;
}

/** 開いている 1 文書の状態。 */
export interface DocumentSession {
  path: string;
  filename: string;
  /** ファイル名から拡張子を除いたもの。 */
  title: string;
  /** ディスクへ書く全文（Front Matter を含む）。 */
  text: string;
  hasBom: boolean;
  lineEnding: LineEnding;
  revision: DiskRevision | null;
  saveState: SaveState;
  /** save_error / conflict のときの詳細。 */
  problem: DocumentProblem | null;
}

export interface DocumentProblem {
  kind: "save_error" | "conflict" | "missing";
  message: string;
}

/** Title は filename から導出する。保持しない（document-model.md §4）。 */
export function titleOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot <= 0) return filename;
  return filename.slice(0, dot);
}

export function filenameWithExtension(title: string, previousFilename: string): string {
  const dot = previousFilename.lastIndexOf(".");
  const ext = dot > 0 ? previousFilename.slice(dot) : ".md";
  return `${title}${ext}`;
}
