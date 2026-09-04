//! Quiet Markdown Editor — native layer.
//!
//! Frontend は Filesystem へ直接触らない。すべてここの command を通す
//! （`architecture/architecture.md` §2）。

pub mod commands;
pub mod errors;
pub mod filesystem;
pub mod settings;
pub mod watcher;

use commands::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::workspace::open_workspace,
            commands::workspace::list_documents,
            commands::workspace::allow_single_file,
            commands::workspace::load_workspace_metadata,
            commands::workspace::save_workspace_metadata,
            commands::workspace::set_archived,
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
            commands::system::open_external,
            commands::system::open_in_new_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
