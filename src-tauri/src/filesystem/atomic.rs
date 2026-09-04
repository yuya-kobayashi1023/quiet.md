//! Atomic save.
//!
//! `domain/file-lifecycle.md` §5:
//! serialize → temp file write → flush → atomic replace → revision 更新。
//! 既存ファイルへ直接途中まで書かない。

use crate::errors::{NativeError, Result};
use crate::filesystem::{hash_bytes, DiskRevision};
use std::io::Write;
use std::path::{Path, PathBuf};

fn temp_path_for(path: &Path) -> PathBuf {
    let name = path
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "document".to_string());
    // 同じディレクトリへ置く。別ボリュームだと rename が atomic にならないため。
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    path.with_file_name(format!(".{name}.{nanos}.tmp"))
}

/// 一時ファイルへ書いてから差し替える。
pub fn write_atomic(path: &Path, bytes: &[u8]) -> Result<DiskRevision> {
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent).map_err(|e| NativeError::from_io(&e, parent))?;
        }
    }

    let tmp = temp_path_for(path);

    let write_result = (|| -> std::io::Result<()> {
        let mut file = std::fs::File::create(&tmp)?;
        file.write_all(bytes)?;
        // OS のバッファに残したまま rename すると、電源断で 0 バイトになりうる。
        file.sync_all()?;
        Ok(())
    })();

    if let Err(e) = write_result {
        let _ = std::fs::remove_file(&tmp);
        return Err(NativeError::from_io(&e, &tmp));
    }

    // Windows の rename は上書きできないため、std::fs::rename ではなく
    // ReplaceFile 相当の挙動になる fs::rename を使う（Rust の rename は Windows でも上書き可）。
    if let Err(e) = std::fs::rename(&tmp, path) {
        let _ = std::fs::remove_file(&tmp);
        return Err(NativeError::from_io(&e, path));
    }

    let meta = std::fs::metadata(path).map_err(|e| NativeError::from_io(&e, path))?;
    Ok(DiskRevision {
        modified_at: meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0),
        size: meta.len(),
        content_hash: hash_bytes(bytes),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("quiet-md-test-{name}"));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn writes_new_file() {
        let dir = temp_dir("atomic-new");
        let path = dir.join("a.md");
        let rev = write_atomic(&path, b"hello").unwrap();
        assert_eq!(std::fs::read(&path).unwrap(), b"hello");
        assert_eq!(rev.size, 5);
    }

    #[test]
    fn overwrites_existing_file() {
        let dir = temp_dir("atomic-overwrite");
        let path = dir.join("a.md");
        std::fs::write(&path, b"old content here").unwrap();
        write_atomic(&path, b"new").unwrap();
        assert_eq!(std::fs::read(&path).unwrap(), b"new");
    }

    #[test]
    fn leaves_no_temp_file_behind() {
        let dir = temp_dir("atomic-clean");
        let path = dir.join("a.md");
        write_atomic(&path, b"x").unwrap();
        let leftovers: Vec<_> = std::fs::read_dir(&dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().ends_with(".tmp"))
            .collect();
        assert!(leftovers.is_empty(), "temp file left behind");
    }
}
