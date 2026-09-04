//! File watcher.
//!
//! `architecture/architecture.md` §10: Frontend へ送る前に
//! path normalize / debounce / self-save suppression を行う。
//!
//! self-save の判定は時間ではなく content hash で行う（U-028）。
//! 同期フォルダ経由のイベントは遅れて届くため、時間窓では取りこぼす。

use crate::filesystem;
use notify::RecursiveMode;
use notify_debouncer_full::{new_debouncer, DebouncedEvent, Debouncer, RecommendedCache};
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

const DEBOUNCE: Duration = Duration::from_millis(300);
pub const EVENT_NAME: &str = "quiet://file-change";

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum FileWatchEvent {
    #[serde(rename_all = "camelCase")]
    Changed {
        path: String,
        revision: filesystem::DiskRevision,
    },
    #[serde(rename_all = "camelCase")]
    Removed { path: String },
    #[serde(rename_all = "camelCase")]
    Created { path: String },
}

/// 自分が書いた内容の hash。これと一致する変更は外部変更として扱わない。
#[derive(Default)]
pub struct SelfWrites {
    hashes: Mutex<HashMap<PathBuf, String>>,
}

impl SelfWrites {
    pub fn record(&self, path: &Path, hash: &str) {
        if let Ok(mut map) = self.hashes.lock() {
            map.insert(path.to_path_buf(), hash.to_string());
        }
    }

    pub fn forget(&self, path: &Path) {
        if let Ok(mut map) = self.hashes.lock() {
            map.remove(path);
        }
    }

    fn is_self_write(&self, path: &Path, hash: &str) -> bool {
        self.hashes
            .lock()
            .ok()
            .and_then(|map| map.get(path).cloned())
            .map(|known| known == hash)
            .unwrap_or(false)
    }
}

pub struct WatcherState {
    debouncer: Mutex<Option<Debouncer<notify::RecommendedWatcher, RecommendedCache>>>,
    pub self_writes: Arc<SelfWrites>,
}

impl Default for WatcherState {
    fn default() -> Self {
        Self {
            debouncer: Mutex::new(None),
            self_writes: Arc::new(SelfWrites::default()),
        }
    }
}

fn is_markdown(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| {
            let e = e.to_ascii_lowercase();
            e == "md" || e == "markdown"
        })
        .unwrap_or(false)
}

fn is_ignored(path: &Path) -> bool {
    path.components().any(|c| {
        let name = c.as_os_str().to_string_lossy();
        name.starts_with('.') || name == "node_modules" || name == "target"
    })
}

fn handle_events(app: &AppHandle, self_writes: &SelfWrites, events: Vec<DebouncedEvent>) {
    for event in events {
        for path in &event.paths {
            // 一時ファイルと ignore 対象は無視する。atomic save の .tmp を拾わない。
            if !is_markdown(path) || is_ignored(path) {
                continue;
            }

            let payload = if path.exists() {
                match filesystem::current_revision(path) {
                    Ok(revision) => {
                        if self_writes.is_self_write(path, &revision.content_hash) {
                            // 自分の save。外部変更として扱わない。
                            continue;
                        }
                        if event.kind.is_create() {
                            FileWatchEvent::Created {
                                path: path.display().to_string(),
                            }
                        } else {
                            FileWatchEvent::Changed {
                                path: path.display().to_string(),
                                revision,
                            }
                        }
                    }
                    Err(_) => continue,
                }
            } else {
                self_writes.forget(path);
                FileWatchEvent::Removed {
                    path: path.display().to_string(),
                }
            };

            if let Err(e) = app.emit(EVENT_NAME, payload) {
                log::warn!("failed to emit watch event: {e}");
            }
        }
    }
}

/// root を監視し直す。既存の監視は止める。
pub fn watch(app: &AppHandle, state: &WatcherState, root: &Path) -> Result<(), String> {
    let app = app.clone();
    let self_writes = Arc::clone(&state.self_writes);

    let mut debouncer = new_debouncer(DEBOUNCE, None, move |result| match result {
        Ok(events) => handle_events(&app, &self_writes, events),
        Err(errors) => {
            for e in errors {
                log::warn!("watch error: {e}");
            }
        }
    })
    .map_err(|e| e.to_string())?;

    debouncer
        .watch(root, RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;

    if let Ok(mut slot) = state.debouncer.lock() {
        *slot = Some(debouncer);
    }
    Ok(())
}

pub fn unwatch(state: &WatcherState) {
    if let Ok(mut slot) = state.debouncer.lock() {
        *slot = None;
    }
}
