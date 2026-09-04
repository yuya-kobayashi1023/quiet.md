//! Path の正規化とスコープ判定。
//!
//! `domain/document-model.md` §2: 単純な String 比較で同一 Document 判定をしない。
//! Windows の大小文字差と `\\?\` prefix をここで吸収する。

use crate::errors::{NativeError, Result};
use std::path::{Path, PathBuf};

/// Canonical path を返す。存在しないパスでも、可能な範囲で正規化する。
pub fn canonicalize(path: &Path) -> Result<PathBuf> {
    match dunce::canonicalize(path) {
        Ok(p) => Ok(p),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            // 新規作成の直前など、まだ存在しないパス。親までを正規化する。
            let parent = path.parent().ok_or_else(|| NativeError::NotFound {
                path: path.display().to_string(),
            })?;
            let file = path.file_name().ok_or_else(|| NativeError::NotFound {
                path: path.display().to_string(),
            })?;
            let parent = dunce::canonicalize(parent).map_err(|e| NativeError::from_io(&e, parent))?;
            Ok(parent.join(file))
        }
        Err(e) => Err(NativeError::from_io(&e, path)),
    }
}

/// 2 つのパスが同じファイルを指すか。
///
/// Windows は大小文字を区別しないため、単純比較では取りこぼす。
pub fn same_path(a: &Path, b: &Path) -> bool {
    if a == b {
        return true;
    }
    #[cfg(windows)]
    {
        let a = a.to_string_lossy().to_lowercase();
        let b = b.to_string_lossy().to_lowercase();
        return a == b;
    }
    #[cfg(not(windows))]
    false
}

/// `child` が `root` の中にあるか。
///
/// `architecture/architecture.md` §12: Workspace 外への書込みを制限する。
pub fn is_inside(root: &Path, child: &Path) -> bool {
    let root = root.components().collect::<Vec<_>>();
    let child = child.components().collect::<Vec<_>>();
    if child.len() < root.len() {
        return false;
    }
    root.iter().zip(child.iter()).all(|(r, c)| {
        #[cfg(windows)]
        {
            r.as_os_str().to_string_lossy().to_lowercase()
                == c.as_os_str().to_string_lossy().to_lowercase()
        }
        #[cfg(not(windows))]
        {
            r == c
        }
    })
}

/// Workspace スコープを強制する。root が None のとき（単体ファイル Open）は素通し。
pub fn ensure_in_scope(root: Option<&Path>, target: &Path) -> Result<()> {
    match root {
        None => Ok(()),
        Some(root) if is_inside(root, target) => Ok(()),
        Some(_) => Err(NativeError::OutOfScope {
            path: target.display().to_string(),
        }),
    }
}

/// Windows で使えないファイル名を弾く。
///
/// `domain/file-lifecycle.md` §7 / `quality/test-strategy.md` §2。
pub fn validate_filename(name: &str) -> Result<()> {
    let invalid = |reason: &str| -> NativeError {
        NativeError::InvalidFilename {
            filename: name.to_string(),
            reason: reason.to_string(),
        }
    };

    if name.is_empty() {
        return Err(invalid("empty"));
    }
    if name.len() > 255 {
        return Err(invalid("too long"));
    }
    if name.contains(['/', '\\', ':', '*', '?', '"', '<', '>', '|']) {
        return Err(invalid(r#"cannot contain / \ : * ? " < > |"#));
    }
    if name.chars().any(|c| (c as u32) < 0x20) {
        return Err(invalid("cannot contain control characters"));
    }
    if name == "." || name == ".." {
        return Err(invalid("reserved"));
    }
    if name.ends_with(' ') || name.ends_with('.') {
        return Err(invalid("cannot end with a space or a dot"));
    }

    // Windows の予約デバイス名。拡張子が付いていても予約される。
    const RESERVED: [&str; 22] = [
        "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
        "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
    ];
    let stem = name.split('.').next().unwrap_or(name).to_uppercase();
    if RESERVED.contains(&stem.as_str()) {
        return Err(invalid("reserved device name on Windows"));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_windows_reserved_names() {
        assert!(validate_filename("CON.md").is_err());
        assert!(validate_filename("nul.md").is_err());
        assert!(validate_filename("com1.md").is_err());
        assert!(validate_filename("console.md").is_ok());
    }

    #[test]
    fn rejects_trailing_dot_and_space() {
        assert!(validate_filename("note .md").is_ok());
        assert!(validate_filename("note.").is_err());
        assert!(validate_filename("note ").is_err());
    }

    #[test]
    fn rejects_path_separators() {
        assert!(validate_filename("a/b.md").is_err());
        assert!(validate_filename("a\\b.md").is_err());
        assert!(validate_filename("c:note.md").is_err());
    }

    #[test]
    fn accepts_japanese_names() {
        assert!(validate_filename("設計メモ.md").is_ok());
    }

    #[test]
    fn scope_check() {
        let root = Path::new(r"C:\notes");
        assert!(is_inside(root, Path::new(r"C:\notes\a.md")));
        assert!(is_inside(root, Path::new(r"C:\notes\sub\a.md")));
        assert!(!is_inside(root, Path::new(r"C:\other\a.md")));
        assert!(!is_inside(root, Path::new(r"C:\notesx\a.md")));
    }
}
