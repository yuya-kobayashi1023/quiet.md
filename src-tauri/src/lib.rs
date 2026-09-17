//! Quiet Markdown Editor — native layer.
//!
//! Frontend は Filesystem へ直接触らない。すべてここの command を通す
//! （`architecture/architecture.md` §2）。

pub mod commands;
pub mod errors;
pub mod filesystem;
pub mod launch;
pub mod pdf;
pub mod settings;
pub mod shell_integration;
pub mod watcher;

use commands::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    // 二重起動は新しいプロセスを立てず、引数だけを既存プロセスへ渡す（ADR-013）。
    // `.quiet/workspace.json` を 2 プロセスが同時に書く事故を防ぐ（U-021）。
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
        match launch::target_from_args(&argv, std::path::Path::new(&cwd)) {
            Some(target) => launch::deliver(app, target),
            None => launch::focus_existing(app),
        }
    }));

    let app = builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // 関連付け起動 / CLI 引数。Frontend が初期化時に引き取る。
            let cwd = std::env::current_dir().unwrap_or_default();
            let args: Vec<String> = std::env::args().collect();
            if let Some(target) = launch::target_from_args(&args, &cwd) {
                launch::remember_launch_target(app.handle(), target);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::workspace::open_workspace,
            commands::workspace::list_documents,
            commands::workspace::allow_single_file,
            commands::workspace::load_workspace_metadata,
            commands::workspace::save_workspace_metadata,
            commands::workspace::set_archived,
            commands::workspace::set_pinned,
            commands::workspace::search_workspace,
            commands::workspace::load_app_settings,
            commands::workspace::save_app_settings,
            commands::document::read_document,
            commands::document::save_document,
            commands::document::create_document,
            commands::document::rename_document,
            commands::document::duplicate_document,
            commands::document::document_revision,
            commands::document::write_recovery_snapshot,
            commands::document::clear_recovery_snapshot,
            commands::document::list_recovery_snapshots,
            commands::system::reveal_in_file_manager,
            commands::system::reveal_folder,
            commands::system::open_external,
            commands::system::open_in_new_window,
            commands::system::open_workspace_in_new_window,
            commands::system::take_launch_target,
            commands::system::register_document_window,
            commands::system::context_menu_status,
            commands::system::set_context_menu,
            commands::system::export_pdf,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app, event| match event {
        // macOS の Open with。Windows / Linux は argv 経由で来る。
        #[cfg(target_os = "macos")]
        tauri::RunEvent::Opened { urls } => {
            for url in urls {
                let Ok(path) = url.to_file_path() else { continue };
                let Some(target) = launch::target_from_path(&path) else {
                    continue;
                };
                if app.webview_windows().is_empty() {
                    launch::remember_launch_target(app, target);
                } else {
                    launch::deliver(app, target);
                }
            }
        }
        // 外から渡された対象は、最後に focus した Window へ配る（ADR-018）。
        tauri::RunEvent::WindowEvent {
            label,
            event: tauri::WindowEvent::Focused(true),
            ..
        } => {
            app.state::<AppState>().note_focus(&label);
        }
        // 閉じた Window の登録を残さない（U-021）。
        tauri::RunEvent::WindowEvent {
            label,
            event: tauri::WindowEvent::Destroyed,
            ..
        } => {
            app.state::<AppState>().forget_window(&label);
        }
        _ => {}
    });
}
