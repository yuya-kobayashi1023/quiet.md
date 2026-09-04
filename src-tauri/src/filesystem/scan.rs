//! Workspace の走査。
//!
//! U-024 の決定に従う。
//! - 入れ子フォルダをそのまま返す（ツリー表示は Frontend）
//! - dotfolder と `.quiet/` は既定で非表示、`node_modules/` は ignore
//! - 並び順は名前順
//! - 5000 ファイル程度で UI が固まらないこと

use crate::errors::{NativeError, Result};
use serde::Serialize;
use std::path::Path;
use walkdir::{DirEntry, WalkDir};

/// 走査の上限。これを超えると打ち切り、Frontend へ truncated を伝える。
const MAX_ENTRIES: usize = 20_000;
const MAX_DEPTH: usize = 16;

const IGNORED_DIRS: [&str; 5] = ["node_modules", "target", "dist", "build", ".git"];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentSummary {
    /// Workspace root からの相対パス。`/` 区切りで正規化する。
    pub relative_path: String,
    pub path: String,
    pub filename: String,
    /// 拡張子を除いたファイル名。これが Title（U-006 / U-020）。
    pub title: String,
    pub modified_at: u64,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSnapshot {
    pub root_path: String,
    pub name: String,
    pub documents: Vec<DocumentSummary>,
    /// 上限に達して打ち切った場合 true。
    pub truncated: bool,
}

fn is_markdown(entry: &DirEntry) -> bool {
    entry
        .path()
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| {
            let e = e.to_ascii_lowercase();
            e == "md" || e == "markdown"
        })
        .unwrap_or(false)
}

fn is_ignored_dir(entry: &DirEntry) -> bool {
    if !entry.file_type().is_dir() {
        return false;
    }
    let name = entry.file_name().to_string_lossy();
    // dotfolder（`.quiet` を含む）は既定で非表示。
    name.starts_with('.') || IGNORED_DIRS.contains(&name.as_ref())
}

pub fn title_of(filename: &str) -> String {
    match filename.rsplit_once('.') {
        Some((stem, _ext)) if !stem.is_empty() => stem.to_string(),
        _ => filename.to_string(),
    }
}

fn to_relative(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

pub fn scan_workspace(root: &Path) -> Result<WorkspaceSnapshot> {
    if !root.is_dir() {
        return Err(NativeError::NotFound {
            path: root.display().to_string(),
        });
    }

    let mut documents = Vec::new();
    let mut truncated = false;

    let walker = WalkDir::new(root)
        .max_depth(MAX_DEPTH)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| e.depth() == 0 || !is_ignored_dir(e));

    for entry in walker {
        let entry = match entry {
            Ok(e) => e,
            // 権限のないフォルダで走査全体を落とさない。
            Err(_) => continue,
        };
        if !entry.file_type().is_file() || !is_markdown(&entry) {
            continue;
        }
        if documents.len() >= MAX_ENTRIES {
            truncated = true;
            break;
        }

        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        let filename = entry.file_name().to_string_lossy().to_string();
        documents.push(DocumentSummary {
            relative_path: to_relative(root, entry.path()),
            path: entry.path().display().to_string(),
            title: title_of(&filename),
            filename,
            modified_at: meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0),
            size: meta.len(),
        });
    }

    // 並び順は名前順（U-024）。フォルダ階層は relativePath の順序で表現する。
    documents.sort_by(|a, b| {
        a.relative_path
            .to_lowercase()
            .cmp(&b.relative_path.to_lowercase())
    });

    Ok(WorkspaceSnapshot {
        root_path: root.display().to_string(),
        name: root
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| root.display().to_string()),
        documents,
        truncated,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn title_strips_extension() {
        assert_eq!(title_of("designing-quieter-software.md"), "designing-quieter-software");
        assert_eq!(title_of("設計メモ.markdown"), "設計メモ");
        assert_eq!(title_of("no-extension"), "no-extension");
        // 先頭ドットのみのファイルは、そのまま名前として扱う。
        assert_eq!(title_of(".gitignore"), ".gitignore");
    }

    #[test]
    fn skips_ignored_directories() {
        let dir = std::env::temp_dir().join("quiet-md-test-scan");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join("node_modules")).unwrap();
        std::fs::create_dir_all(dir.join(".quiet")).unwrap();
        std::fs::create_dir_all(dir.join("docs")).unwrap();
        std::fs::write(dir.join("a.md"), "a").unwrap();
        std::fs::write(dir.join("docs/b.md"), "b").unwrap();
        std::fs::write(dir.join("node_modules/c.md"), "c").unwrap();
        std::fs::write(dir.join(".quiet/d.md"), "d").unwrap();
        std::fs::write(dir.join("e.txt"), "e").unwrap();

        let snapshot = scan_workspace(&dir).unwrap();
        let names: Vec<_> = snapshot
            .documents
            .iter()
            .map(|d| d.relative_path.clone())
            .collect();
        assert_eq!(names, vec!["a.md", "docs/b.md"]);
    }
}
