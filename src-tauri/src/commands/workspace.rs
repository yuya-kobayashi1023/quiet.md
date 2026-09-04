//! Workspace 系コマンド。

use crate::commands::AppState;
use crate::errors::{NativeError, Result};
use crate::filesystem::paths;
use crate::filesystem::scan::{self, WorkspaceSnapshot};
use crate::settings::{self, WorkspaceMetadata};
use crate::watcher;
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, State};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenWorkspaceResult {
    #[serde(flatten)]
    pub snapshot: WorkspaceSnapshot,
    pub metadata: WorkspaceMetadata,
}

#[tauri::command]
pub fn open_workspace(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> Result<OpenWorkspaceResult> {
    let root = paths::canonicalize(Path::new(&path))?;
    if !root.is_dir() {
        return Err(NativeError::NotFound {
            path: root.display().to_string(),
        });
    }

    let snapshot = scan::scan_workspace(&root)?;
    let metadata = settings::load_workspace_metadata(&root);

    if let Ok(mut slot) = state.workspace_root.lock() {
        *slot = Some(root.clone());
    }

    // 画像を Preview で表示できるようにする（U-023）。Workspace 内に限る。
    app.asset_protocol_scope().allow_directory(&root, true).ok();

    watcher::unwatch(&state.watcher);
    if let Err(e) = watcher::watch(&app, &state.watcher, &root) {
        // 監視に失敗しても Workspace は開ける。監視だけ諦める。
        log::warn!("failed to start watcher: {e}");
    }

    Ok(OpenWorkspaceResult { snapshot, metadata })
}

#[tauri::command]
pub fn list_documents(state: State<'_, AppState>) -> Result<WorkspaceSnapshot> {
    let root = state.root().ok_or_else(|| NativeError::NotFound {
        path: "<no workspace>".to_string(),
    })?;
    scan::scan_workspace(&root)
}

/// Workspace 外の単体ファイルを開く（U-001）。
#[tauri::command]
pub fn allow_single_file(app: AppHandle, state: State<'_, AppState>, path: String) -> Result<String> {
    let path = paths::canonicalize(Path::new(&path))?;
    if !path.is_file() {
        return Err(NativeError::NotFound {
            path: path.display().to_string(),
        });
    }
    state.allow_file(&path);
    if let Some(parent) = path.parent() {
        app.asset_protocol_scope().allow_directory(parent, false).ok();
    }
    Ok(path.display().to_string())
}

#[tauri::command]
pub fn load_workspace_metadata(state: State<'_, AppState>) -> Result<WorkspaceMetadata> {
    let root = state.root().ok_or_else(|| NativeError::NotFound {
        path: "<no workspace>".to_string(),
    })?;
    Ok(settings::load_workspace_metadata(&root))
}

#[tauri::command]
pub fn save_workspace_metadata(
    state: State<'_, AppState>,
    metadata: WorkspaceMetadata,
) -> Result<()> {
    let root = state.root().ok_or_else(|| NativeError::NotFound {
        path: "<no workspace>".to_string(),
    })?;
    settings::save_workspace_metadata(&root, &metadata)
}

/// 論理 Archive（U-005）。ファイルは移動しない。
#[tauri::command]
pub fn set_archived(state: State<'_, AppState>, relative_path: String, archived: bool) -> Result<WorkspaceMetadata> {
    let root = state.root().ok_or_else(|| NativeError::NotFound {
        path: "<no workspace>".to_string(),
    })?;
    let mut metadata = settings::load_workspace_metadata(&root);
    metadata.archived.retain(|p| p != &relative_path);
    if archived {
        metadata.archived.push(relative_path);
    }
    settings::save_workspace_metadata(&root, &metadata)?;
    Ok(metadata)
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf> {
    app.path()
        .app_data_dir()
        .map_err(|e| NativeError::IoError {
            message: e.to_string(),
        })
}

#[tauri::command]
pub fn load_app_settings(app: AppHandle) -> Result<serde_json::Value> {
    Ok(settings::load_app_settings(&app_data_dir(&app)?))
}

#[tauri::command]
pub fn save_app_settings(app: AppHandle, settings_json: serde_json::Value) -> Result<()> {
    settings::save_app_settings(&app_data_dir(&app)?, &settings_json)
}
