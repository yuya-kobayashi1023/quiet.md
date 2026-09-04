//! Tauri commands.
//!
//! Frontend からの唯一の入口。名前は `architecture/interfaces.md` に合わせる。

pub mod document;
pub mod system;
pub mod workspace;

use crate::watcher::WatcherState;
use std::path::PathBuf;
use std::sync::Mutex;

/// 現在の Workspace root。書込みスコープの判定に使う。
///
/// 単体 `.md` を開いた場合は None になり、その 1 ファイルだけが許可される（U-001）。
#[derive(Default)]
pub struct AppState {
    pub workspace_root: Mutex<Option<PathBuf>>,
    /// Workspace 外で明示的に開いたファイル。ユーザーが選んだものだけが入る。
    pub allowed_files: Mutex<Vec<PathBuf>>,
    pub watcher: WatcherState,
}

impl AppState {
    pub fn root(&self) -> Option<PathBuf> {
        self.workspace_root.lock().ok().and_then(|r| r.clone())
    }

    pub fn allow_file(&self, path: &std::path::Path) {
        if let Ok(mut files) = self.allowed_files.lock() {
            if !files.iter().any(|p| p == path) {
                files.push(path.to_path_buf());
            }
        }
    }

    /// 書込み・読込を許可してよいパスか。
    ///
    /// Workspace 内か、ユーザーが明示的に開いたファイルだけを通す
    /// （`architecture/architecture.md` §12）。
    pub fn ensure_allowed(&self, path: &std::path::Path) -> crate::errors::Result<()> {
        if let Some(root) = self.root() {
            if crate::filesystem::paths::is_inside(&root, path) {
                return Ok(());
            }
        }
        let allowed = self
            .allowed_files
            .lock()
            .map(|files| {
                files
                    .iter()
                    .any(|p| crate::filesystem::paths::same_path(p, path))
            })
            .unwrap_or(false);
        if allowed {
            Ok(())
        } else {
            Err(crate::errors::NativeError::OutOfScope {
                path: path.display().to_string(),
            })
        }
    }
}
