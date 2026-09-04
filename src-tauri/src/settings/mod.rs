//! Settings と Workspace metadata。
//!
//! - App settings: OS の App Data 配下（`architecture/interfaces.md` §10）
//! - Workspace metadata: `.quiet/workspace.json`（U-012）
//!
//! 2 つは別 transaction。metadata が壊れても Markdown 本文へ影響しない（§13）。

use crate::errors::{NativeError, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::{Path, PathBuf};

pub const WORKSPACE_DIR: &str = ".quiet";
pub const WORKSPACE_FILE: &str = "workspace.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceMetadata {
    /// 将来の migration 用（NFR §10）。
    pub version: u32,
    #[serde(default)]
    pub archived: Vec<String>,
    #[serde(default)]
    pub last_opened: Option<String>,
    /// フォルダの展開状態（U-024）。
    #[serde(default)]
    pub expanded_folders: Vec<String>,
}

impl Default for WorkspaceMetadata {
    fn default() -> Self {
        Self {
            version: 1,
            archived: Vec::new(),
            last_opened: None,
            expanded_folders: Vec::new(),
        }
    }
}

fn metadata_path(root: &Path) -> PathBuf {
    root.join(WORKSPACE_DIR).join(WORKSPACE_FILE)
}

/// Workspace metadata を読む。
///
/// 壊れていても Markdown 本文には影響させない。既定値へ倒して続行する。
pub fn load_workspace_metadata(root: &Path) -> WorkspaceMetadata {
    let path = metadata_path(root);
    match std::fs::read_to_string(&path) {
        Ok(text) => match serde_json::from_str::<WorkspaceMetadata>(&text) {
            Ok(meta) => meta,
            Err(e) => {
                log::warn!("workspace metadata is broken, falling back to defaults: {e}");
                WorkspaceMetadata::default()
            }
        },
        Err(_) => WorkspaceMetadata::default(),
    }
}

pub fn save_workspace_metadata(root: &Path, meta: &WorkspaceMetadata) -> Result<()> {
    let dir = root.join(WORKSPACE_DIR);
    std::fs::create_dir_all(&dir).map_err(|e| NativeError::from_io(&e, &dir))?;
    let text = serde_json::to_string_pretty(meta).map_err(|e| NativeError::IoError {
        message: e.to_string(),
    })?;
    crate::filesystem::atomic::write_atomic(&metadata_path(root), text.as_bytes())?;
    Ok(())
}

/// App settings は Frontend が形を決める。Rust 側は JSON をそのまま預かる。
///
/// 設定項目が増えるたびに Rust の型を追うのは無駄なので、ここでは検証しない。
pub fn load_app_settings(dir: &Path) -> Value {
    let path = dir.join("settings.json");
    match std::fs::read_to_string(&path) {
        Ok(text) => serde_json::from_str(&text).unwrap_or(Value::Null),
        Err(_) => Value::Null,
    }
}

pub fn save_app_settings(dir: &Path, settings: &Value) -> Result<()> {
    std::fs::create_dir_all(dir).map_err(|e| NativeError::from_io(&e, dir))?;
    let text = serde_json::to_string_pretty(settings).map_err(|e| NativeError::IoError {
        message: e.to_string(),
    })?;
    crate::filesystem::atomic::write_atomic(&dir.join("settings.json"), text.as_bytes())?;
    Ok(())
}

/// Crash recovery 用の snapshot（U-014）。
///
/// Markdown 本体とは別ファイルに置き、正常 save で消す。
pub fn recovery_path(dir: &Path, doc_path: &Path) -> PathBuf {
    let key = blake3::hash(doc_path.display().to_string().as_bytes()).to_hex();
    dir.join("recovery").join(format!("{key}.json"))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoverySnapshot {
    pub path: String,
    pub content: String,
    pub saved_at: u64,
}

pub fn write_recovery(dir: &Path, snapshot: &RecoverySnapshot) -> Result<()> {
    let path = recovery_path(dir, Path::new(&snapshot.path));
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| NativeError::from_io(&e, parent))?;
    }
    let text = serde_json::to_string(snapshot).map_err(|e| NativeError::IoError {
        message: e.to_string(),
    })?;
    crate::filesystem::atomic::write_atomic(&path, text.as_bytes())?;
    Ok(())
}

pub fn clear_recovery(dir: &Path, doc_path: &Path) {
    let _ = std::fs::remove_file(recovery_path(dir, doc_path));
}

pub fn list_recovery(dir: &Path) -> Vec<RecoverySnapshot> {
    let recovery_dir = dir.join("recovery");
    let entries = match std::fs::read_dir(&recovery_dir) {
        Ok(e) => e,
        Err(_) => return Vec::new(),
    };
    entries
        .filter_map(|e| e.ok())
        .filter_map(|e| std::fs::read_to_string(e.path()).ok())
        .filter_map(|text| serde_json::from_str::<RecoverySnapshot>(&text).ok())
        .collect()
}
