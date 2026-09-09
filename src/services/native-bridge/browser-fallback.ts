/**
 * Tauri の外で動かすためのフォールバック。
 *
 * 用途は 2 つだけ。
 * - ブラウザで UI を目視確認する
 * - テストで Document service を動かす
 *
 * 本番では使われない（`isNative()` が true になる）。
 * 実ファイルには触らないので、ここでの save は memory 上だけで完結する。
 */

import { NativeError } from "@/domain/document/errors";
import type {
  DiskRevision,
  DocumentSummary,
  SearchFileResult,
  SearchMatch,
  SearchQuery,
  WorkspaceMetadata,
} from "@/domain/document/types";

const SAMPLE = `---
title: Designing quieter software
tags:
  - design
  - editor
status: draft
created: 2026-09-04
---

# Designing quieter software

A good writing tool should disappear before the first sentence is finished.

## The interface is not the work

Most editors keep reminding us that they are editors: toolbars, borders, mode
labels, formatting controls. Each element can be justified on its own, yet
together they compete with the page.

- Commands exist, but stay behind \`Ctrl+K\`.
- Preview exists, but never owns the screen by default.
- Files exist, but the sidebar can disappear completely.

> The interface should feel less like software and more like a clean surface
> with memory.

## One warm system

| Element | Default | Reason |
| --- | --- | --- |
| File tree | Visible | Keeps document context nearby |
| Preview | Hidden | Writing remains the primary mode |
| Save state | Inline | A small dot appears only while unsaved |
`;

interface FakeFile {
  content: string;
  modifiedAt: number;
}

const files = new Map<string, FakeFile>([
  ["/notes/designing-quieter-software.md", { content: SAMPLE, modifiedAt: Date.now() }],
  [
    "/notes/editor-principles.md",
    { content: "# Editor principles\n\nQuiet by default.\n", modifiedAt: Date.now() },
  ],
  ["/notes/scratch.md", { content: "scratch\n", modifiedAt: Date.now() }],
  [
    "/notes/docs/design.md",
    { content: "# Design\n\nNested folder sample.\n", modifiedAt: Date.now() },
  ],
  ["/notes/2026-archive-sample.md", { content: "# Old note\n", modifiedAt: Date.now() }],
  // Workspace の外。Recent セクション（ADR-013）の確認用。
  [
    "/downloads/meeting-notes.md",
    { content: "# Meeting notes\n\nOutside the workspace.\n", modifiedAt: Date.now() },
  ],
  ["/repo/README.md", { content: "# README\n", modifiedAt: Date.now() }],
]);

let metadata: WorkspaceMetadata = {
  version: 1,
  archived: ["2026-archive-sample.md"],
  lastOpened: "designing-quieter-software.md",
  expandedFolders: ["docs"],
};

/**
 * ブラウザ確認用の初期 App settings。
 *
 * Recent（ADR-013）と Workspace 履歴（ADR-016）は、実際に開かないと出ない。
 * 目視確認できるよう最初から数件入れておく。テストは resetFallback で null へ戻す。
 */
let appSettings: unknown = {
  recentFiles: [
    { path: "/downloads/meeting-notes.md", filename: "meeting-notes.md", openedAt: 2 },
    { path: "/repo/README.md", filename: "README.md", openedAt: 1 },
  ],
  workspaces: [
    { path: "/work-notes", name: "work-notes", openedAt: Date.now() - 2 * 3_600_000 },
    { path: "/repo/docs", name: "docs", openedAt: Date.now() - 26 * 3_600_000 },
    { path: "/personal", name: "personal", openedAt: Date.now() - 4 * 86_400_000 },
    { path: "/research", name: "research", openedAt: Date.now() - 12 * 86_400_000 },
    { path: "/blog/content", name: "content", openedAt: Date.now() - 40 * 86_400_000 },
  ],
};

function hash(text: string): string {
  // 衝突検知の用途としては十分な簡易ハッシュ。本番は blake3（Rust 側）。
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function revisionOf(file: FakeFile): DiskRevision {
  return {
    modifiedAt: file.modifiedAt,
    size: file.content.length,
    contentHash: hash(file.content),
  };
}

function summaryOf(path: string): DocumentSummary {
  const file = files.get(path)!;
  const filename = path.slice(path.lastIndexOf("/") + 1);
  const dot = filename.lastIndexOf(".");
  return {
    relativePath: path.replace("/notes/", ""),
    path,
    filename,
    title: dot > 0 ? filename.slice(0, dot) : filename,
    modifiedAt: file.modifiedAt,
    size: file.content.length,
  };
}

function snapshot() {
  return {
    rootPath: "/notes",
    name: "notes",
    documents: [...files.keys()]
      .filter((path) => path.startsWith("/notes/"))
      .sort()
      .map(summaryOf),
    truncated: false,
  };
}

/** テスト用。IO が飛んでいる最中の状態を作るための遅延。 */
let artificialDelay = 0;

export function setFallbackDelay(ms: number): void {
  artificialDelay = ms;
}

export async function browserFallback<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const arg = (key: string) => (args ?? {})[key];

  if (artificialDelay > 0) {
    await new Promise((resolve) => setTimeout(resolve, artificialDelay));
  }

  switch (cmd) {
    case "open_workspace":
      return { ...snapshot(), metadata } as T;

    case "list_documents":
      return snapshot() as T;

    case "load_workspace_metadata":
      return metadata as T;

    case "save_workspace_metadata":
      metadata = arg("metadata") as typeof metadata;
      return undefined as T;

    case "set_archived": {
      const relativePath = arg("relativePath") as string;
      const archived = arg("archived") as boolean;
      metadata = {
        ...metadata,
        archived: archived
          ? [...metadata.archived.filter((p) => p !== relativePath), relativePath]
          : metadata.archived.filter((p) => p !== relativePath),
      };
      return metadata as T;
    }

    /*
     * Rust 側（filesystem/search.rs）の縮小版。
     * ブラウザで UI を確認するためだけのもので、上限も preview の切り出しも持たない。
     * 挙動の正は Rust 側であり、ここを仕様の根拠にしない。
     */
    case "search_workspace": {
      const query = arg("query") as SearchQuery;
      const needle = query.query.trim();
      if (!needle) {
        return { files: [], totalMatches: 0, truncated: false, scannedFiles: 0 } as T;
      }
      const compare = (s: string) => (query.caseSensitive ? s : s.toLowerCase());
      const target = compare(needle);
      const results: SearchFileResult[] = [];
      let totalMatches = 0;
      let scannedFiles = 0;

      for (const path of [...files.keys()].sort()) {
        const summary = summaryOf(path);
        const isArchived = metadata.archived.includes(summary.relativePath);
        if (isArchived && !query.includeArchived) continue;
        scannedFiles += 1;

        const matches: SearchMatch[] = [];
        files.get(path)!.content.split("\n").forEach((line, index) => {
          const haystack = compare(line);
          let at = haystack.indexOf(target);
          while (at !== -1) {
            matches.push({
              line: index + 1,
              column: at + 1,
              length: needle.length,
              preview: line.trim(),
              previewColumn: at - (line.length - line.trimStart().length),
              previewTruncatedStart: false,
              previewTruncatedEnd: false,
            });
            at = haystack.indexOf(target, at + needle.length);
          }
        });

        if (matches.length === 0) continue;
        totalMatches += matches.length;
        results.push({
          document: summary,
          matches,
          matchCount: matches.length,
          archived: isArchived,
        });
      }

      results.sort((a, b) => b.matchCount - a.matchCount);
      return { files: results, totalMatches, truncated: false, scannedFiles } as T;
    }

    case "read_document": {
      const path = arg("path") as string;
      const file = files.get(path);
      if (!file) throw new NativeError("NOT_FOUND", { path });
      const filename = path.slice(path.lastIndexOf("/") + 1);
      return {
        path,
        filename,
        content: file.content,
        encoding: "utf-8",
        hasBom: false,
        lineEnding: "lf",
        revision: revisionOf(file),
      } as T;
    }

    case "save_document": {
      const input = arg("input") as {
        path: string;
        content: string;
        expectedRevision: DiskRevision | null;
      };
      const file = files.get(input.path);
      if (file && input.expectedRevision) {
        if (revisionOf(file).contentHash !== input.expectedRevision.contentHash) {
          throw new NativeError("CONFLICT", { path: input.path });
        }
      }
      const next: FakeFile = { content: input.content, modifiedAt: Date.now() };
      files.set(input.path, next);
      return revisionOf(next) as T;
    }

    case "create_document": {
      const input = (arg("input") ?? {}) as { filename?: string };
      const requested = input.filename ?? "Untitled.md";
      const dot = requested.lastIndexOf(".");
      const stem = dot > 0 ? requested.slice(0, dot) : requested;
      const ext = dot > 0 ? requested.slice(dot) : ".md";
      let candidate = `/notes/${stem}${ext}`;
      let n = 2;
      while (files.has(candidate)) {
        candidate = `/notes/${stem} ${n}${ext}`;
        n += 1;
      }
      files.set(candidate, { content: "", modifiedAt: Date.now() });
      return summaryOf(candidate) as T;
    }

    case "rename_document": {
      const from = arg("from") as string;
      const toFilename = arg("toFilename") as string;
      const file = files.get(from);
      if (!file) throw new NativeError("NOT_FOUND", { path: from });
      const to = `${from.slice(0, from.lastIndexOf("/"))}/${toFilename}`;
      if (to !== from && files.has(to)) {
        throw new NativeError("ALREADY_EXISTS", { path: to });
      }
      files.delete(from);
      files.set(to, file);
      const dot = toFilename.lastIndexOf(".");
      return {
        path: to,
        relativePath: to.replace("/notes/", ""),
        filename: toFilename,
        title: dot > 0 ? toFilename.slice(0, dot) : toFilename,
      } as T;
    }

    case "duplicate_document": {
      const path = arg("path") as string;
      const file = files.get(path);
      if (!file) throw new NativeError("NOT_FOUND", { path });
      const copy = path.replace(/(\.[^.]+)$/, " copy$1");
      files.set(copy, { ...file });
      return copy as T;
    }

    case "document_revision": {
      const path = arg("path") as string;
      const file = files.get(path);
      if (!file) throw new NativeError("NOT_FOUND", { path });
      return revisionOf(file) as T;
    }

    case "load_app_settings":
      return appSettings as T;

    case "save_app_settings":
      appSettings = arg("settingsJson");
      return undefined as T;

    case "write_recovery_snapshot":
    case "clear_recovery_snapshot":
      return undefined as T;

    case "list_recovery_snapshots":
      return [] as T;

    case "allow_single_file":
      return arg("path") as T;

    case "take_launch_target":
      return null as T;

    // Explorer の右クリック登録（ADR-014）は Windows の実アプリだけの機能。
    case "context_menu_status":
      return { supported: false, enabled: false } as T;

    case "reveal_in_file_manager":
    case "reveal_folder":
    case "open_in_new_window":
    case "open_workspace_in_new_window":
    case "register_document_window":
      return undefined as T;

    case "open_external": {
      const url = arg("url") as string;
      window.open(url, "_blank", "noopener,noreferrer");
      return undefined as T;
    }

    default:
      throw new NativeError("IO_ERROR", { message: `unsupported command: ${cmd}` });
  }
}

/** テスト用。フォールバックの状態を初期化する。 */
export function resetFallback(): void {
  files.clear();
  files.set("/notes/a.md", { content: "# A\n", modifiedAt: 1000 });
  files.set("/notes/b.md", { content: "# B\n", modifiedAt: 1000 });
  metadata = { version: 1, archived: [], lastOpened: null, expandedFolders: [] };
  appSettings = null;
}

/** テスト用。外部プロセスによる書き換えを模す。 */
export function externalWrite(path: string, content: string): void {
  files.set(path, { content, modifiedAt: Date.now() + 1 });
}
