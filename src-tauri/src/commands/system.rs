//! OS 連携。Reveal / 外部リンク / Window。

use crate::commands::AppState;
use crate::errors::{NativeError, Result};
use crate::filesystem::paths;
use crate::launch::OpenTarget;
use crate::shell_integration::{self, ContextMenuStatus};
use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};
use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder};

/// Explorer / Finder で表示する。
#[tauri::command]
pub fn reveal_in_file_manager(state: State<'_, AppState>, path: String) -> Result<()> {
    let path = paths::canonicalize(Path::new(&path))?;
    state.ensure_allowed(&path)?;
    reveal(&path)
}

/// Workspace の外にあるパスを Explorer / Finder で選択状態で表示する。
///
/// Workspace 履歴のフォルダ（ADR-016）と、書き出した PDF（ADR-021）が使う。
/// `ensure_allowed` は「中身を読み書きしてよいか」の判定。ここは OS のファイルマネージャへ
/// 渡すだけで中身に触れないため、実在することだけを確かめる。
#[tauri::command]
pub fn reveal_path(path: String) -> Result<()> {
    let path = paths::canonicalize(Path::new(&path))?;
    if !path.exists() {
        return Err(NativeError::NotFound {
            path: path.display().to_string(),
        });
    }
    reveal(&path)
}

fn reveal(path: &Path) -> Result<()> {
    #[cfg(windows)]
    {
        std::process::Command::new("explorer")
            .arg("/select,")
            .arg(path)
            .spawn()
            .map_err(|e| NativeError::from_io(&e, path))?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(path)
            .spawn()
            .map_err(|e| NativeError::from_io(&e, path))?;
        return Ok(());
    }

    #[cfg(all(not(windows), not(target_os = "macos")))]
    {
        let parent = path.parent().unwrap_or(path);
        std::process::Command::new("xdg-open")
            .arg(parent)
            .spawn()
            .map_err(|e| NativeError::from_io(&e, parent))?;
        Ok(())
    }
}

/// 外部リンクを OS 既定のブラウザで開く（U-023）。
///
/// WebView 内で遷移させない。http / https 以外は開かない。
#[tauri::command]
pub fn open_external(app: tauri::AppHandle, url: String) -> Result<()> {
    let allowed = url.starts_with("http://") || url.starts_with("https://") || url.starts_with("mailto:");
    if !allowed {
        return Err(NativeError::OutOfScope { path: url });
    }
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| NativeError::IoError {
            message: e.to_string(),
        })
}

/// 同一ファイルは 1 Window のみ（U-021）。
///
/// 既に開いていればそのウィンドウを前面に出し、開いていなければ新しく作る。
/// どの Window が何を開いているかは `AppState::document_windows` が持つ。
#[tauri::command]
pub async fn open_in_new_window(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> Result<()> {
    let canonical = paths::canonicalize(Path::new(&path))?;

    if let Some(label) = state.window_for_document(&canonical) {
        if let Some(existing) = app.get_webview_window(&label) {
            let _ = existing.unminimize();
            let _ = existing.set_focus();
            return Ok(());
        }
        // Window は閉じられている。登録だけが残っていた。
        state.forget_window(&label);
    }

    open_window_for(
        &app,
        &OpenTarget::File {
            path: canonical.display().to_string(),
        },
    )
}

/// Workspace を新しい Window で開く（ADR-016）。
///
/// 同一ファイル 1 Window（U-021）は文書の話で、Workspace には適用しない。
/// 同じフォルダを 2 つの Window で開くことは、比較・並べ読みのために許す。
#[tauri::command]
pub async fn open_workspace_in_new_window(app: AppHandle, path: String) -> Result<()> {
    let canonical = paths::canonicalize(Path::new(&path))?;
    if !canonical.is_dir() {
        return Err(NativeError::NotFound {
            path: canonical.display().to_string(),
        });
    }

    open_window_for(
        &app,
        &OpenTarget::Workspace {
            path: canonical.display().to_string(),
        },
    )
}

/// 起動時に渡された対象を引き取る（ADR-013）。2 度目は None。
#[tauri::command]
pub fn take_launch_target(state: State<'_, AppState>) -> Option<OpenTarget> {
    state.take_pending_open()
}

/// この Window が今開いている文書を Native へ知らせる（U-021）。
///
/// 関連付け起動や二重起動で同じファイルが来たとき、どの Window を前へ出せばよいかは
/// Frontend しか知らない。開く / 閉じるたびにここへ通知する。
#[tauri::command]
pub fn register_document_window(
    window: tauri::Window,
    state: State<'_, AppState>,
    path: Option<String>,
) -> Result<()> {
    let resolved = match path {
        Some(path) if !path.is_empty() => Some(paths::canonicalize(Path::new(&path))?),
        _ => None,
    };
    state.set_window_document(window.label(), resolved);
    Ok(())
}

/// 対象を新しい Window で開く。Window label は毎回新しく振る。
///
/// 同一ファイル判定はレジストリ側の責任にして、label には持たせない。
/// label に path のハッシュを使うと、その Window が別の文書へ移った後に衝突する。
pub fn open_window_for(app: &AppHandle, target: &OpenTarget) -> Result<()> {
    static NEXT_WINDOW: AtomicUsize = AtomicUsize::new(1);
    let label = format!("doc-{}", NEXT_WINDOW.fetch_add(1, Ordering::Relaxed));

    let query = match target {
        OpenTarget::File { path } => format!("path={}", urlencode(path)),
        OpenTarget::Workspace { path } => format!("workspace={}", urlencode(path)),
    };

    WebviewWindowBuilder::new(
        app,
        &label,
        WebviewUrl::App(format!("index.html?{query}").into()),
    )
    .title("Quiet")
    .inner_size(1200.0, 820.0)
    .min_inner_size(760.0, 520.0)
    // Custom title bar（ADR-010）。main window と同じ見た目にする。
    .decorations(false)
    .shadow(true)
    .build()
    .map_err(|e| NativeError::IoError {
        message: e.to_string(),
    })?;

    Ok(())
}

fn urlencode(s: &str) -> String {
    s.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                (b as char).to_string()
            }
            _ => format!("%{b:02X}"),
        })
        .collect()
}

/// Preview を PDF として書き出す（ADR-021）。
///
/// 保存先は Frontend が Save dialog で決めている。Workspace 外でも書ける。
/// 紙面に載せる内容は呼び出し元の Window が `@media print` で用意している。
#[tauri::command]
pub async fn export_pdf(window: tauri::WebviewWindow, path: String) -> Result<()> {
    crate::pdf::print_to_pdf(&window, Path::new(&path)).await
}

/// Explorer の右クリック「Quiet で開く」の状態を返す（ADR-014）。
///
/// `supported` が false の OS では、設定画面に項目自体を出さない。
#[tauri::command]
pub fn context_menu_status() -> ContextMenuStatus {
    shell_integration::status()
}

/// 右クリックメニューを登録する / 外す（ADR-014）。
///
/// 書くのは `HKCU\Software\Classes` の下だけなので、管理者権限は要らない。
#[tauri::command]
pub fn set_context_menu(enabled: bool) -> Result<ContextMenuStatus> {
    shell_integration::set_enabled(enabled)
}
