//! Preview の PDF 書き出し（ADR-021）。
//!
//! HTML → PDF の変換は WebView 自身に任せる。別のレンダラを同梱すると
//! Preview と字形・改行・コードの色が揃わなくなる。
//!
//! Windows は WebView2 の `PrintToPdf` を使う。印刷ダイアログを挟まず、
//! Frontend が Save dialog で決めたパスへ直接書く。
//! 何を紙面に載せるかは Frontend の `@media print` が決める（`print.css`）。

use crate::errors::{NativeError, Result};
use std::path::Path;
use tauri::WebviewWindow;

/// A4（インチ）。WebView2 の既定は Letter なので明示する。
#[cfg(windows)]
const A4_WIDTH_IN: f64 = 8.27;
#[cfg(windows)]
const A4_HEIGHT_IN: f64 = 11.69;
/// 余白 15mm。
#[cfg(windows)]
const MARGIN_IN: f64 = 0.59;

#[cfg(windows)]
pub async fn print_to_pdf(window: &WebviewWindow, path: &Path) -> Result<()> {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2Environment6, ICoreWebView2_7,
    };
    use webview2_com::PrintToPdfCompletedHandler;
    use windows::core::{Interface, HSTRING};

    // PrintToPdf は WebView のスレッドで非同期に走り、完了は callback で返る。
    // command 側はその結果を channel で待つ。
    let (tx, rx) = std::sync::mpsc::channel::<Result<()>>();
    let target = HSTRING::from(path.as_os_str());

    window
        .with_webview(move |webview| {
            let started = (|| -> windows::core::Result<()> {
                let tx = tx.clone();
                unsafe {
                    let core: ICoreWebView2_7 = webview.controller().CoreWebView2()?.cast()?;
                    let environment: ICoreWebView2Environment6 = webview.environment().cast()?;

                    let settings = environment.CreatePrintSettings()?;
                    settings.SetPageWidth(A4_WIDTH_IN)?;
                    settings.SetPageHeight(A4_HEIGHT_IN)?;
                    settings.SetMarginTop(MARGIN_IN)?;
                    settings.SetMarginBottom(MARGIN_IN)?;
                    settings.SetMarginLeft(MARGIN_IN)?;
                    settings.SetMarginRight(MARGIN_IN)?;
                    // コードブロックの背景と引用の罫線を落とさない。
                    settings.SetShouldPrintBackgrounds(true)?;
                    // URL と日付のヘッダ / フッタは Quiet の紙面に要らない。
                    settings.SetShouldPrintHeaderAndFooter(false)?;

                    let handler = PrintToPdfCompletedHandler::create(Box::new(move |hr, ok| {
                        let result = match (hr, ok) {
                            (Ok(()), true) => Ok(()),
                            (Ok(()), false) => Err(NativeError::IoError {
                                message: "PDF を書き出せませんでした".to_string(),
                            }),
                            (Err(e), _) => Err(NativeError::IoError {
                                message: e.message(),
                            }),
                        };
                        let _ = tx.send(result);
                        Ok(())
                    }));
                    core.PrintToPdf(&target, &settings, &handler)
                }
            })();
            if let Err(e) = started {
                let _ = tx.send(Err(NativeError::IoError {
                    message: e.message(),
                }));
            }
        })
        .map_err(|e| NativeError::IoError {
            message: e.to_string(),
        })?;

    tauri::async_runtime::spawn_blocking(move || rx.recv())
        .await
        .ok()
        .and_then(|received| received.ok())
        .unwrap_or_else(|| {
            Err(NativeError::IoError {
                message: "PDF の書き出しが完了しませんでした".to_string(),
            })
        })
}

/// macOS / Linux はまだ対応していない（Windows first）。
#[cfg(not(windows))]
pub async fn print_to_pdf(_window: &WebviewWindow, _path: &Path) -> Result<()> {
    Err(NativeError::IoError {
        message: "この OS では PDF の書き出しに対応していません".to_string(),
    })
}
