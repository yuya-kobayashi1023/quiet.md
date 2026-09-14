//! Tauri commands.
//!
//! Frontend からの唯一の入口。名前は `architecture/interfaces.md` に合わせる。

pub mod document;
pub mod system;
pub mod workspace;

use crate::launch::OpenTarget;
use crate::watcher::WatcherState;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

/// 現在の Workspace root。書込みスコープの判定に使う。
///
/// 単体 `.md` を開いた場合は None になり、その 1 ファイルだけが許可される（U-001）。
#[derive(Default)]
pub struct AppState {
    pub workspace_root: Mutex<Option<PathBuf>>,
    /// Workspace 外で明示的に開いたファイル。ユーザーが選んだものだけが入る。
    pub allowed_files: Mutex<Vec<PathBuf>>,
    /// 起動時に渡された対象。Frontend が初期化時に 1 度だけ引き取る（ADR-013）。
    pub pending_open: Mutex<Option<OpenTarget>>,
    /// どの Window がどの文書を開いているか。同一ファイル 1 Window の判定に使う（U-021）。
    pub document_windows: Mutex<Vec<(String, PathBuf)>>,
    /// Window label を focus した順（新しい順）に並べたもの。
    /// 外から渡された対象の配り先を決めるのに使う（ADR-018）。
    pub focus_order: Mutex<Vec<String>>,
    pub watcher: WatcherState,
}

impl AppState {
    pub fn root(&self) -> Option<PathBuf> {
        self.workspace_root.lock().ok().and_then(|r| r.clone())
    }

    /* ------------------------------------------------------------ *
     * 起動対象（ADR-013）
     * ------------------------------------------------------------ */

    pub fn set_pending_open(&self, target: Option<OpenTarget>) {
        if let Ok(mut slot) = self.pending_open.lock() {
            *slot = target;
        }
    }

    /// 起動対象を引き取る。2 度目は None を返す。
    pub fn take_pending_open(&self) -> Option<OpenTarget> {
        self.pending_open.lock().ok().and_then(|mut slot| slot.take())
    }

    /* ------------------------------------------------------------ *
     * Window と文書の対応（U-021）
     * ------------------------------------------------------------ */

    /// Window が今どの文書を開いているかを記録する。None で登録を外す。
    pub fn set_window_document(&self, label: &str, path: Option<PathBuf>) {
        if let Ok(mut windows) = self.document_windows.lock() {
            windows.retain(|(l, _)| l != label);
            if let Some(path) = path {
                windows.push((label.to_string(), path));
            }
        }
    }

    pub fn window_for_document(&self, path: &Path) -> Option<String> {
        let windows = self.document_windows.lock().ok()?;
        windows
            .iter()
            .find(|(_, p)| crate::filesystem::paths::same_path(p, path))
            .map(|(label, _)| label.clone())
    }

    /* ------------------------------------------------------------ *
     * Window の focus 順（ADR-018）
     * ------------------------------------------------------------ */

    /// focus された Window を先頭へ置く。同じ label は 1 件に畳む。
    pub fn note_focus(&self, label: &str) {
        if let Ok(mut order) = self.focus_order.lock() {
            order.retain(|l| l != label);
            order.insert(0, label.to_string());
        }
    }

    /// focus した順（新しい順）。破棄済みの label が残りうるので、
    /// 使う側が `get_webview_window` で実在を確かめる。
    pub fn focus_order(&self) -> Vec<String> {
        self.focus_order
            .lock()
            .map(|order| order.clone())
            .unwrap_or_default()
    }

    pub fn forget_window(&self, label: &str) {
        self.set_window_document(label, None);
        if let Ok(mut order) = self.focus_order.lock() {
            order.retain(|l| l != label);
        }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn focus_order_starts_with_the_newest_label() {
        let state = AppState::default();
        state.note_focus("main");
        state.note_focus("doc-1");

        assert_eq!(state.focus_order(), ["doc-1", "main"]);
    }

    #[test]
    fn re_focusing_moves_a_label_to_the_front() {
        let state = AppState::default();
        state.note_focus("main");
        state.note_focus("doc-1");
        state.note_focus("main");

        assert_eq!(state.focus_order(), ["main", "doc-1"]);
    }

    #[test]
    fn forget_window_clears_both_registries() {
        let state = AppState::default();
        let note = PathBuf::from("C:/notes/a.md");
        state.note_focus("doc-1");
        state.note_focus("main");
        state.set_window_document("doc-1", Some(note.clone()));

        state.forget_window("doc-1");

        assert_eq!(state.focus_order(), ["main"]);
        assert_eq!(state.window_for_document(&note), None);
    }
}
