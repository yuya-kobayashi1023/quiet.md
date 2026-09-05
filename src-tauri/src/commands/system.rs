//! OS 連携。Reveal / 外部リンク / Window。

use crate::commands::AppState;
use crate::errors::{NativeError, Result};
use crate::filesystem::paths;
use std::path::Path;
use tauri::State;

/// Explorer / Finder で表示する。
#[tauri::command]
pub fn reveal_in_file_manager(state: State<'_, AppState>, path: String) -> Result<()> {
    let path = paths::canonicalize(Path::new(&path))?;
    state.ensure_allowed(&path)?;

    #[cfg(windows)]
    {
        std::process::Command::new("explorer")
            .arg("/select,")
            .arg(&path)
            .spawn()
            .map_err(|e| NativeError::from_io(&e, &path))?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(&path)
            .spawn()
            .map_err(|e| NativeError::from_io(&e, &path))?;
        return Ok(());
    }

    #[cfg(all(not(windows), not(target_os = "macos")))]
    {
        let parent = path.parent().unwrap_or(&path);
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
#[tauri::command]
pub async fn open_in_new_window(app: tauri::AppHandle, path: String) -> Result<()> {
    use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

    let canonical = paths::canonicalize(Path::new(&path))?;
    let label = format!("doc-{}", blake3::hash(canonical.display().to_string().as_bytes()).to_hex());
    let label: String = label.chars().take(60).collect();

    if let Some(existing) = app.get_webview_window(&label) {
        let _ = existing.unminimize();
        let _ = existing.set_focus();
        return Ok(());
    }

    let encoded = urlencode(&canonical.display().to_string());
    WebviewWindowBuilder::new(
        &app,
        &label,
        WebviewUrl::App(format!("index.html?path={encoded}").into()),
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
