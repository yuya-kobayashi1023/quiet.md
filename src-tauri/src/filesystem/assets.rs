//! 貼り付けた画像の保存先（AUTO-050）。
//!
//! Workspace 内のノートなら `<root>/assets/`、Workspace 外の単体ファイルなら
//! `<ノートのフォルダ>/assets/` に置く。ディスクを見て衝突を連番で避け、
//! ノートから見た相対パスを `/` 区切りで返す。書込みそのものはしない。

use crate::errors::{NativeError, Result};
use crate::filesystem::paths;
use std::path::{Path, PathBuf};

#[derive(Debug, PartialEq, Eq)]
pub struct ImageTarget {
    pub path: PathBuf,
    /// ノートのフォルダから見た相対パス。Markdown にそのまま書ける形。
    pub relative_path: String,
}

pub fn pasted_image_target(
    workspace_root: Option<&Path>,
    note: &Path,
    filename: &str,
) -> Result<ImageTarget> {
    let note_dir = note.parent().ok_or_else(|| NativeError::NotFound {
        path: note.display().to_string(),
    })?;
    let base = workspace_root
        .filter(|root| paths::is_inside(root, note_dir))
        .unwrap_or(note_dir);
    let assets_dir = base.join("assets");
    let path = first_free_name(&assets_dir, filename)?;

    let depth = note_dir.components().count() - base.components().count();
    let saved_name = path
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();
    let relative_path = format!("{}assets/{saved_name}", "../".repeat(depth));

    Ok(ImageTarget { path, relative_path })
}

/// `name.ext` が既にあれば `name-2.ext`、`name-3.ext`… と空きを探す。
fn first_free_name(dir: &Path, filename: &str) -> Result<PathBuf> {
    let (stem, ext) = match filename.rsplit_once('.') {
        Some((s, e)) if !s.is_empty() => (s, Some(e)),
        _ => (filename, None),
    };
    let with_suffix = |suffix: &str| match ext {
        Some(ext) => dir.join(format!("{stem}{suffix}.{ext}")),
        None => dir.join(format!("{stem}{suffix}")),
    };

    let mut candidate = with_suffix("");
    let mut n = 2;
    while candidate.exists() {
        candidate = with_suffix(&format!("-{n}"));
        n += 1;
        if n > 9999 {
            return Err(NativeError::AlreadyExists {
                path: candidate.display().to_string(),
            });
        }
    }
    Ok(candidate)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("quiet-md-test-assets-{name}"));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn note_at_workspace_root_uses_assets_next_to_it() {
        let root = temp_dir("root");
        let target = pasted_image_target(Some(&root), &root.join("a.md"), "x.png").unwrap();
        assert_eq!(target.path, root.join("assets").join("x.png"));
        assert_eq!(target.relative_path, "assets/x.png");
    }

    #[test]
    fn note_in_subfolder_points_back_up_to_workspace_assets() {
        let root = temp_dir("sub");
        let note = root.join("sub").join("deep").join("a.md");
        let target = pasted_image_target(Some(&root), &note, "x.png").unwrap();
        assert_eq!(target.path, root.join("assets").join("x.png"));
        assert_eq!(target.relative_path, "../../assets/x.png");
    }

    #[test]
    fn existing_file_gets_a_numbered_suffix() {
        let root = temp_dir("collision");
        std::fs::create_dir_all(root.join("assets")).unwrap();
        std::fs::write(root.join("assets").join("x.png"), b"1").unwrap();
        std::fs::write(root.join("assets").join("x-2.png"), b"2").unwrap();

        let target = pasted_image_target(Some(&root), &root.join("a.md"), "x.png").unwrap();
        assert_eq!(target.path, root.join("assets").join("x-3.png"));
        assert_eq!(target.relative_path, "assets/x-3.png");
    }

    #[test]
    fn note_outside_workspace_uses_its_own_folder() {
        let root = temp_dir("ws");
        let elsewhere = temp_dir("elsewhere");
        let note = elsewhere.join("a.md");
        let target = pasted_image_target(Some(&root), &note, "x.png").unwrap();
        assert_eq!(target.path, elsewhere.join("assets").join("x.png"));
        assert_eq!(target.relative_path, "assets/x.png");
    }

    #[test]
    fn no_workspace_uses_the_note_folder() {
        let dir = temp_dir("no-ws");
        let target = pasted_image_target(None, &dir.join("a.md"), "x.png").unwrap();
        assert_eq!(target.path, dir.join("assets").join("x.png"));
        assert_eq!(target.relative_path, "assets/x.png");
    }
}
