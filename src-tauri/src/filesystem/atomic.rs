//! Atomic save.
//!
//! `domain/file-lifecycle.md` §5:
//! serialize → temp file write → flush → atomic replace → revision 更新。
//! 既存ファイルへ直接途中まで書かない。

use crate::errors::{NativeError, Result};
use crate::filesystem::{epoch_millis, hash_bytes, DiskRevision};
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

    // rename 後のファイルは一時ファイルの作成時刻を持つ（NTFS で確認済み）。
    // 上書き前に控えておき、差し替え後に書き戻す（ADR-019 §3）。
    let created = std::fs::metadata(path).and_then(|m| m.created()).ok();
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

    if let Some(created) = created {
        restore_created(path, created);
    }

    let meta = std::fs::metadata(path).map_err(|e| NativeError::from_io(&e, path))?;
    Ok(DiskRevision {
        modified_at: epoch_millis(meta.modified()),
        size: meta.len(),
        content_hash: hash_bytes(bytes),
    })
}

/// 作成時刻は並び順のための情報でしかないので、失敗しても保存は成功させる。
#[cfg(any(windows, target_os = "macos"))]
fn restore_created(path: &Path, created: std::time::SystemTime) {
    #[cfg(target_os = "macos")]
    use std::os::macos::fs::FileTimesExt;
    #[cfg(windows)]
    use std::os::windows::fs::FileTimesExt;

    let times = std::fs::FileTimes::new().set_created(created);
    let _ = std::fs::OpenOptions::new()
        .write(true)
        .open(path)
        .and_then(|file| file.set_times(times));
}

/// birthtime を書き戻せない OS では何もしない。
#[cfg(not(any(windows, target_os = "macos")))]
fn restore_created(_path: &Path, _created: std::time::SystemTime) {}

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

    #[cfg(any(windows, target_os = "macos"))]
    #[test]
    fn keeps_creation_time_across_overwrite() {
        let dir = temp_dir("atomic-created");
        let path = dir.join("a.md");
        write_atomic(&path, b"first").unwrap();
        let created = std::fs::metadata(&path).unwrap().created().unwrap();

        std::thread::sleep(std::time::Duration::from_millis(50));
        write_atomic(&path, b"second").unwrap();

        assert_eq!(std::fs::read(&path).unwrap(), b"second");
        assert_eq!(std::fs::metadata(&path).unwrap().created().unwrap(), created);
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
