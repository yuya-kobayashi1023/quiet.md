//! Document 系コマンド。
//!
//! save の所有権は Document service 側（Frontend）にあるが、
//! 実際の書込み・競合判定・self-write の記録はここで完結させる。

use crate::commands::AppState;
use crate::errors::{NativeError, Result};
use crate::filesystem::{
    self, assets, atomic, paths, scan, DiskRevision, DocumentContent, LineEnding,
};
use crate::settings;
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, State};

#[tauri::command]
pub fn read_document(state: State<'_, AppState>, path: String) -> Result<DocumentContent> {
    let path = paths::canonicalize(Path::new(&path))?;
    state.ensure_allowed(&path)?;
    filesystem::read_document(&path)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveInput {
    pub path: String,
    pub content: String,
    pub line_ending: LineEnding,
    pub has_bom: bool,
    /// 直前に読み書きした版。None なら競合チェックを行わない（新規作成時）。
    pub expected_revision: Option<DiskRevision>,
}

#[tauri::command]
pub fn save_document(state: State<'_, AppState>, input: SaveInput) -> Result<DiskRevision> {
    let path = paths::canonicalize(Path::new(&input.path))?;
    state.ensure_allowed(&path)?;

    // 競合判定は content hash で行う（U-028）。
    if let Some(expected) = &input.expected_revision {
        if path.exists() && !filesystem::matches_revision(&path, expected)? {
            return Err(NativeError::Conflict {
                path: path.display().to_string(),
            });
        }
    }

    let bytes = filesystem::serialize(&input.content, input.line_ending, input.has_bom);
    let revision = atomic::write_atomic(&path, &bytes)?;

    // 自分の書込みを watcher が外部変更として拾わないようにする。
    state
        .watcher
        .self_writes
        .record(&path, &revision.content_hash);

    Ok(revision)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateInput {
    /// 省略時は Workspace root 直下。
    pub directory: Option<String>,
    /// 省略時は `Untitled.md`（U-015）。
    pub filename: Option<String>,
}

/// 新規ノートを作る。名前が衝突していれば連番を付ける（U-015）。
///
/// Archive してもファイル名は解放されないため、ここでの衝突回避は必須（U-005）。
#[tauri::command]
pub fn create_document(state: State<'_, AppState>, input: CreateInput) -> Result<scan::DocumentSummary> {
    let root = state.root().ok_or_else(|| NativeError::NotFound {
        path: "<no workspace>".to_string(),
    })?;

    let dir = match input.directory {
        Some(d) if !d.is_empty() => {
            let dir = paths::canonicalize(&root.join(d))?;
            paths::ensure_in_scope(Some(&root), &dir)?;
            dir
        }
        _ => root.clone(),
    };

    let requested = input.filename.unwrap_or_else(|| "Untitled.md".to_string());
    paths::validate_filename(&requested)?;

    let (stem, ext) = match requested.rsplit_once('.') {
        Some((s, e)) if !s.is_empty() => (s.to_string(), e.to_string()),
        _ => (requested.clone(), "md".to_string()),
    };

    let mut candidate = dir.join(format!("{stem}.{ext}"));
    let mut n = 2;
    while candidate.exists() {
        candidate = dir.join(format!("{stem} {n}.{ext}"));
        n += 1;
        if n > 9999 {
            return Err(NativeError::AlreadyExists {
                path: candidate.display().to_string(),
            });
        }
    }

    // 空ファイルを作る。開いた時点で本文を書き込まない（principles §5）。
    let revision = atomic::write_atomic(&candidate, b"")?;
    state
        .watcher
        .self_writes
        .record(&candidate, &revision.content_hash);

    let filename = candidate
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();

    Ok(scan::DocumentSummary {
        relative_path: candidate
            .strip_prefix(&root)
            .unwrap_or(&candidate)
            .to_string_lossy()
            .replace('\\', "/"),
        path: candidate.display().to_string(),
        title: scan::title_of(&filename),
        filename,
        modified_at: revision.modified_at,
        created_at: std::fs::metadata(&candidate)
            .map(|m| filesystem::created_at(&m))
            .unwrap_or(0),
        size: revision.size,
    })
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameResult {
    pub path: String,
    pub relative_path: String,
    pub filename: String,
    pub title: String,
}

/// Rename。Title UI の編集もここを通る（U-006 / U-020）。
#[tauri::command]
pub fn rename_document(
    state: State<'_, AppState>,
    from: String,
    to_filename: String,
) -> Result<RenameResult> {
    let from = paths::canonicalize(Path::new(&from))?;
    state.ensure_allowed(&from)?;
    paths::validate_filename(&to_filename)?;

    let dir = from.parent().ok_or_else(|| NativeError::NotFound {
        path: from.display().to_string(),
    })?;
    let to = dir.join(&to_filename);

    if paths::same_path(&from, &to) {
        // 大文字小文字だけの変更は Windows では同一パス扱いになる。
        // rename 自体は通るのでそのまま進める。
    } else if to.exists() {
        return Err(NativeError::AlreadyExists {
            path: to.display().to_string(),
        });
    }

    std::fs::rename(&from, &to).map_err(|e| NativeError::from_io(&e, &to))?;
    state.watcher.self_writes.forget(&from);

    let root = state.root();
    Ok(RenameResult {
        relative_path: match &root {
            Some(root) => to
                .strip_prefix(root)
                .unwrap_or(&to)
                .to_string_lossy()
                .replace('\\', "/"),
            None => to.display().to_string(),
        },
        path: to.display().to_string(),
        title: scan::title_of(&to_filename),
        filename: to_filename,
    })
}

#[tauri::command]
pub fn duplicate_document(state: State<'_, AppState>, path: String) -> Result<String> {
    let path = paths::canonicalize(Path::new(&path))?;
    state.ensure_allowed(&path)?;

    let dir = path.parent().ok_or_else(|| NativeError::NotFound {
        path: path.display().to_string(),
    })?;
    let filename = path
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();
    let (stem, ext) = match filename.rsplit_once('.') {
        Some((s, e)) => (s.to_string(), e.to_string()),
        None => (filename.clone(), "md".to_string()),
    };

    let mut candidate = dir.join(format!("{stem} copy.{ext}"));
    let mut n = 2;
    while candidate.exists() {
        candidate = dir.join(format!("{stem} copy {n}.{ext}"));
        n += 1;
    }

    std::fs::copy(&path, &candidate).map_err(|e| NativeError::from_io(&e, &candidate))?;
    Ok(candidate.display().to_string())
}

#[tauri::command]
pub fn document_revision(state: State<'_, AppState>, path: String) -> Result<DiskRevision> {
    let path = paths::canonicalize(Path::new(&path))?;
    state.ensure_allowed(&path)?;
    filesystem::current_revision(&path)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedImage {
    pub path: String,
    /// ノートのフォルダから見た `/` 区切りの相対パス。`![](...)` にそのまま入る。
    pub relative_path: String,
}

/// クリップボードの画像をノートの `assets/` へ保存する（AUTO-050）。
///
/// 保存先はノートの許可（Workspace 内か明示的に開いたファイル）から導く。
/// 名前の衝突はここで連番を付ける。
#[tauri::command]
pub fn save_pasted_image(
    app: AppHandle,
    state: State<'_, AppState>,
    note_path: String,
    filename: String,
    data_base64: String,
) -> Result<SavedImage> {
    let note = paths::canonicalize(Path::new(&note_path))?;
    state.ensure_allowed(&note)?;
    paths::validate_filename(&filename)?;

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&data_base64)
        .map_err(|e| NativeError::IoError {
            message: format!("invalid image data: {e}"),
        })?;

    let root = state.root();
    let target = assets::pasted_image_target(root.as_deref(), &note, &filename)?;
    atomic::write_atomic(&target.path, &bytes)?;

    // Workspace 外の単体ファイルは親フォルダだけ（非再帰）が asset protocol に許可されている。
    // 新しく作った assets/ も Preview で読めるようにする。
    let inside_workspace = root
        .as_deref()
        .is_some_and(|root| paths::is_inside(root, &target.path));
    if !inside_workspace {
        if let Some(dir) = target.path.parent() {
            app.asset_protocol_scope().allow_directory(dir, false).ok();
        }
    }

    Ok(SavedImage {
        path: target.path.display().to_string(),
        relative_path: target.relative_path,
    })
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf> {
    app.path().app_data_dir().map_err(|e| NativeError::IoError {
        message: e.to_string(),
    })
}

/// Crash recovery 用の snapshot を書く（U-014）。
#[tauri::command]
pub fn write_recovery_snapshot(app: AppHandle, path: String, content: String) -> Result<()> {
    let dir = app_data_dir(&app)?;
    settings::write_recovery(
        &dir,
        &settings::RecoverySnapshot {
            path,
            content,
            saved_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0),
        },
    )
}

#[tauri::command]
pub fn clear_recovery_snapshot(app: AppHandle, path: String) -> Result<()> {
    settings::clear_recovery(&app_data_dir(&app)?, Path::new(&path));
    Ok(())
}

#[tauri::command]
pub fn list_recovery_snapshots(app: AppHandle) -> Result<Vec<settings::RecoverySnapshot>> {
    Ok(settings::list_recovery(&app_data_dir(&app)?))
}
