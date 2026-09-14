//! 起動経路の一本化（ADR-013）。
//!
//! `.md` の関連付け起動・CLI 引数・二重起動・macOS の Open with は、
//! すべてここで `OpenTarget` へ正規化してから Window へ配る。
//! Frontend は入口の違いを知らず、`OpenTarget` だけを受け取る。

use crate::commands::AppState;
use crate::filesystem::paths;
use crate::filesystem::scan;
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Manager};

/// 起動対象を Window へ配るときのイベント名。
pub const OPEN_TARGET_EVENT: &str = "quiet://open-target";

/// 外から「これを開け」と言われた対象。
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum OpenTarget {
    /// フォルダ。Workspace として開く。
    Workspace { path: String },
    /// 単体の Markdown ファイル。Workspace 外でもよい（U-001）。
    File { path: String },
}

impl OpenTarget {
    pub fn path(&self) -> &str {
        match self {
            OpenTarget::Workspace { path } | OpenTarget::File { path } => path,
        }
    }
}

/// イベントの宛先。`listen` は宛先違いのイベントも受け取れてしまうので、
/// Frontend が自分宛かを判定できるように Window label を同梱する。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenTargetEvent {
    pub window: String,
    #[serde(flatten)]
    pub target: OpenTarget,
}

/// コマンドライン引数から開く対象を 1 つ選ぶ。
///
/// - `argv[0]` は実行ファイル自身なので読み飛ばす
/// - `-` で始まるものは OS / Tauri が足すフラグ
/// - 実在しないパス、Markdown 以外のファイルは対象にしない
pub fn target_from_args<I, S>(args: I, cwd: &Path) -> Option<OpenTarget>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    args.into_iter()
        .skip(1)
        .find_map(|arg| target_from_arg(arg.as_ref(), cwd))
}

fn target_from_arg(arg: &str, cwd: &Path) -> Option<OpenTarget> {
    if arg.is_empty() || arg.starts_with('-') {
        return None;
    }
    let raw = PathBuf::from(arg);
    let absolute = if raw.is_absolute() { raw } else { cwd.join(raw) };
    target_from_path(&absolute)
}

/// 実在するパスを対象へ分類する。存在しなければ None。
pub fn target_from_path(path: &Path) -> Option<OpenTarget> {
    let path = paths::canonicalize(path).ok()?;
    let display = path.display().to_string();
    if path.is_dir() {
        Some(OpenTarget::Workspace { path: display })
    } else if path.is_file() && scan::is_markdown_path(&path) {
        Some(OpenTarget::File { path: display })
    } else {
        None
    }
}

/// 起動時に渡された対象を控えておく。Frontend が初期化時に引き取る。
///
/// 起動直後は WebView がまだ listen していないので、event だけでは取りこぼす。
/// 「起動時は pull、実行中は event」の 2 経路にする。
pub fn remember_launch_target(app: &AppHandle, target: OpenTarget) {
    app.state::<AppState>().set_pending_open(Some(target));
}

/// 実行中のアプリへ対象を配る（二重起動・macOS の Open with）。
///
/// 1. 同じファイルを開いている Window があれば、それを前へ出す（U-021）
/// 2. 最後に focus した Window へ渡す（ADR-018）
/// 3. Window が 1 つも無いときだけ、新しく作る（U-011: Tabs の代わり）
///
/// 外から渡された対象で Window を増やさない。複数 Window を並べるのは
/// アプリ内の `Open in New Window` に集約する（ADR-018）。
pub fn deliver(app: &AppHandle, target: OpenTarget) {
    let state = app.state::<AppState>();

    if let OpenTarget::File { path } = &target {
        if let Some(label) = state.window_for_document(Path::new(path)) {
            if let Some(window) = app.get_webview_window(&label) {
                focus(&window);
                return;
            }
            // Window はもう無い。レジストリだけ残っていた。
            state.forget_window(&label);
        }
    }

    if let Some(window) = delivery_window(app) {
        let label = window.label().to_string();
        focus(&window);
        let payload = OpenTargetEvent {
            window: label.clone(),
            target,
        };
        if let Err(e) = app.emit_to(label, OPEN_TARGET_EVENT, payload) {
            log::warn!("failed to deliver open target: {e}");
        }
        return;
    }

    if let Err(e) = crate::commands::system::open_window_for(app, &target) {
        log::warn!("failed to open window for target: {e}");
    }
}

/// 対象なしで二重起動されたときは、既存の Window を前へ出すだけにする。
pub fn focus_existing(app: &AppHandle) {
    if let Some(window) = delivery_window(app) {
        focus(&window);
    }
}

/// 外から渡された対象の配り先（ADR-018）。選び方そのものは `pick_delivery_label`。
fn delivery_window(app: &AppHandle) -> Option<tauri::WebviewWindow> {
    let live: Vec<String> = app.webview_windows().into_keys().collect();
    let label = pick_delivery_label(&app.state::<AppState>().focus_order(), &live)?;
    app.get_webview_window(&label)
}

/// 生きている Window のうち、どれへ配るかを決める（ADR-018 §1）。
///
/// `focus_order` は破棄済みの label を含みうるので、`live` にあるものだけを見る。
/// focus を 1 度も観測していない起動直後は `focus_order` が空になる。そのときは
/// main を優先し、main が無ければ label 順にする。`webview_windows()` の反復順は
/// 一定ではないため、並べ替えずに選ぶと配り先が実行ごとに変わる。
fn pick_delivery_label(focus_order: &[String], live: &[String]) -> Option<String> {
    if let Some(label) = focus_order.iter().find(|&label| live.contains(label)) {
        return Some(label.clone());
    }

    let mut live = live.to_vec();
    live.sort_by_key(|label| (label != "main", label.clone()));
    live.into_iter().next()
}

fn focus(window: &tauri::WebviewWindow) {
    let _ = window.unminimize();
    let _ = window.set_focus();
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(name);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn labels(list: &[&str]) -> Vec<String> {
        list.iter().map(|label| label.to_string()).collect()
    }

    #[test]
    fn delivers_to_the_most_recently_focused_window() {
        let live = labels(&["doc-1", "doc-2"]);
        assert_eq!(
            pick_delivery_label(&labels(&["doc-2", "doc-1"]), &live).as_deref(),
            Some("doc-2")
        );
        assert_eq!(
            pick_delivery_label(&labels(&["doc-1", "doc-2"]), &live).as_deref(),
            Some("doc-1")
        );
    }

    #[test]
    fn the_last_focused_window_wins_over_main() {
        // 複数 Window を開いている利用者の main を奪わない（ADR-018 §1）。
        let picked = pick_delivery_label(&labels(&["doc-1", "main"]), &labels(&["main", "doc-1"]));
        assert_eq!(picked.as_deref(), Some("doc-1"));
    }

    #[test]
    fn skips_labels_whose_window_is_gone() {
        let picked = pick_delivery_label(&labels(&["closed", "main"]), &labels(&["main"]));
        assert_eq!(picked.as_deref(), Some("main"));
    }

    #[test]
    fn prefers_main_before_any_focus_is_observed() {
        assert_eq!(
            pick_delivery_label(&[], &labels(&["doc-1", "main"])).as_deref(),
            Some("main")
        );
    }

    #[test]
    fn picks_deterministically_without_main() {
        assert_eq!(
            pick_delivery_label(&[], &labels(&["doc-2", "doc-1"])).as_deref(),
            Some("doc-1")
        );
        assert_eq!(
            pick_delivery_label(&[], &labels(&["doc-1", "doc-2"])).as_deref(),
            Some("doc-1")
        );
    }

    #[test]
    fn picks_nothing_without_a_live_window() {
        assert_eq!(pick_delivery_label(&labels(&["main"]), &[]), None);
    }

    #[test]
    fn picks_the_first_existing_markdown_path() {
        let dir = temp_dir("quiet-md-test-launch-file");
        let file = dir.join("note.md");
        std::fs::write(&file, "# hi").unwrap();

        let target = target_from_args(
            ["quiet.exe", "--flag", file.to_str().unwrap()],
            Path::new("."),
        );
        assert!(matches!(target, Some(OpenTarget::File { .. })));
    }

    #[test]
    fn folders_become_workspaces() {
        let dir = temp_dir("quiet-md-test-launch-dir");
        let target = target_from_args(["quiet.exe", dir.to_str().unwrap()], Path::new("."));
        assert!(matches!(target, Some(OpenTarget::Workspace { .. })));
    }

    #[test]
    fn ignores_flags_missing_paths_and_other_files() {
        let dir = temp_dir("quiet-md-test-launch-other");
        let other = dir.join("note.txt");
        std::fs::write(&other, "hi").unwrap();

        assert_eq!(target_from_args(["quiet.exe"], Path::new(".")), None);
        assert_eq!(
            target_from_args(["quiet.exe", "--no-such-flag"], Path::new(".")),
            None
        );
        assert_eq!(
            target_from_args(["quiet.exe", "no-such-file.md"], &dir),
            None
        );
        assert_eq!(target_from_args(["quiet.exe", other.to_str().unwrap()], &dir), None);
    }

    #[test]
    fn resolves_relative_paths_against_cwd() {
        let dir = temp_dir("quiet-md-test-launch-relative");
        std::fs::write(dir.join("relative.md"), "# hi").unwrap();

        let target = target_from_args(["quiet.exe", "relative.md"], &dir);
        match target {
            Some(OpenTarget::File { path }) => assert!(path.ends_with("relative.md")),
            other => panic!("unexpected target: {other:?}"),
        }
    }
}
