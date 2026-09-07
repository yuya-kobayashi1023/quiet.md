//! Explorer の右クリック「Quiet で開く」（ADR-014）。
//!
//! 登録先は `HKCU\Software\Classes` の下だけにする。管理者権限を要求せず、
//! 他ユーザーの環境にも触らない（NSIS が currentUser インストールなのと揃える）。
//!
//! 出す対象は `launch::OpenTarget` と同じ 2 種類。
//! `.md` / `.markdown` はファイルとして、フォルダは Workspace として開く。
//!
//! Windows 11 の既定のメニューへ直接出せるのは MSIX + `IExplorerCommand` の
//! shell extension だけなので、ここで登録する legacy verb は
//! 「その他のオプションを表示」（Shift+F10）の中に出る。

#![cfg_attr(not(windows), allow(dead_code))]

use crate::errors::{NativeError, Result};
use serde::Serialize;
use std::path::{Path, PathBuf};

/// メニューに出す文字列。
pub const MENU_LABEL: &str = "Quiet で開く";

/// 登録キー名。他アプリの verb と混ざらない名前にする。
const VERB: &str = "QuietOpen";

/// 管理者権限が要らない登録先。
pub const CLASSES_ROOT: &str = r"Software\Classes";

/// 登録先の shell キー（Classes からの相対）と、command へ渡す引数。
///
/// - ファイルは `%1`（選択されたファイル）
/// - フォルダと、フォルダの余白（Background）は `%V`（そのフォルダ自身）
const TARGETS: [(&str, &str); 4] = [
    (r"SystemFileAssociations\.md\shell", "%1"),
    (r"SystemFileAssociations\.markdown\shell", "%1"),
    (r"Directory\shell", "%V"),
    (r"Directory\Background\shell", "%V"),
];

/// 右クリックメニューの登録状態。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContextMenuStatus {
    /// この OS で登録できるか。Windows 以外は false。
    pub supported: bool,
    /// 今の実行ファイルを指す登録が揃っているか。
    pub enabled: bool,
}

fn verb_key(root: &str, shell: &str) -> String {
    format!(r"{root}\{shell}\{VERB}")
}

fn command_key(root: &str, shell: &str) -> String {
    format!(r"{}\command", verb_key(root, shell))
}

/// `"C:\...\Quiet.exe" "%1"`。パスに空白があるので必ず引用する。
fn command_line(exe: &Path, arg: &str) -> String {
    format!("\"{}\" \"{arg}\"", exe.display())
}

fn icon_value(exe: &Path) -> String {
    format!("\"{}\",0", exe.display())
}

#[cfg(windows)]
fn current_exe() -> Result<PathBuf> {
    std::env::current_exe().map_err(|e| NativeError::IoError {
        message: format!("current_exe: {}", e.kind()),
    })
}

/// 今の登録状態を返す。読み取りに失敗したものは「未登録」として扱う。
pub fn status() -> ContextMenuStatus {
    #[cfg(windows)]
    {
        let enabled = current_exe()
            .map(|exe| imp::is_installed(CLASSES_ROOT, &exe))
            .unwrap_or(false);
        ContextMenuStatus {
            supported: true,
            enabled,
        }
    }
    #[cfg(not(windows))]
    {
        ContextMenuStatus {
            supported: false,
            enabled: false,
        }
    }
}

/// 登録する / 外す。結果として確定した状態を返す。
pub fn set_enabled(enabled: bool) -> Result<ContextMenuStatus> {
    #[cfg(windows)]
    {
        if enabled {
            imp::install(CLASSES_ROOT, &current_exe()?)?;
        } else {
            imp::uninstall(CLASSES_ROOT)?;
        }
        Ok(status())
    }
    #[cfg(not(windows))]
    {
        let _ = enabled;
        Err(NativeError::IoError {
            message: "context menu integration is Windows only".to_string(),
        })
    }
}

#[cfg(windows)]
mod imp {
    use super::*;
    use winreg::enums::{HKEY_CURRENT_USER, KEY_READ};
    use winreg::RegKey;

    fn hkcu() -> RegKey {
        RegKey::predef(HKEY_CURRENT_USER)
    }

    fn failed(key: &str, e: &std::io::Error) -> NativeError {
        NativeError::IoError {
            message: format!(r"HKCU\{}: {}", key, e.kind()),
        }
    }

    /// 4 か所へ verb と command を書く。既にあれば上書きする（インストール先が変わっても直る）。
    pub fn install(root: &str, exe: &Path) -> Result<()> {
        for (shell, arg) in TARGETS {
            let key_path = verb_key(root, shell);
            let (key, _) = hkcu()
                .create_subkey(&key_path)
                .map_err(|e| failed(&key_path, &e))?;
            key.set_value("", &MENU_LABEL)
                .map_err(|e| failed(&key_path, &e))?;
            key.set_value("Icon", &icon_value(exe))
                .map_err(|e| failed(&key_path, &e))?;

            let command_path = command_key(root, shell);
            let (command, _) = hkcu()
                .create_subkey(&command_path)
                .map_err(|e| failed(&command_path, &e))?;
            command
                .set_value("", &command_line(exe, arg))
                .map_err(|e| failed(&command_path, &e))?;
        }
        Ok(())
    }

    /// verb キーごと消す。無いものは成功として扱う。
    pub fn uninstall(root: &str) -> Result<()> {
        for (shell, _) in TARGETS {
            let key_path = verb_key(root, shell);
            match hkcu().delete_subkey_all(&key_path) {
                Ok(()) => {}
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
                Err(e) => return Err(failed(&key_path, &e)),
            }
        }
        Ok(())
    }

    /// すべての command が今の実行ファイルを指しているときだけ true。
    ///
    /// 別の場所の Quiet を指したままの登録は、押しても今のアプリが開かない。
    /// 「ON だが動かない」を作らないよう、その状態は未登録として扱う。
    pub fn is_installed(root: &str, exe: &Path) -> bool {
        TARGETS
            .iter()
            .all(|(shell, arg)| match_command(root, shell, &command_line(exe, arg)))
    }

    fn match_command(root: &str, shell: &str, expected: &str) -> bool {
        hkcu()
            .open_subkey_with_flags(command_key(root, shell), KEY_READ)
            .and_then(|key| key.get_value::<String, _>(""))
            .map(|actual| actual.eq_ignore_ascii_case(expected))
            .unwrap_or(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quotes_the_executable_and_the_argument() {
        let exe = Path::new(r"C:\Program Files\Quiet\Quiet.exe");
        assert_eq!(
            command_line(exe, "%1"),
            r#""C:\Program Files\Quiet\Quiet.exe" "%1""#
        );
        assert_eq!(icon_value(exe), r#""C:\Program Files\Quiet\Quiet.exe",0"#);
    }

    #[test]
    fn keys_live_under_the_verb() {
        assert_eq!(
            verb_key(CLASSES_ROOT, r"Directory\shell"),
            r"Software\Classes\Directory\shell\QuietOpen"
        );
        assert_eq!(
            command_key(CLASSES_ROOT, r"SystemFileAssociations\.md\shell"),
            r"Software\Classes\SystemFileAssociations\.md\shell\QuietOpen\command"
        );
    }

    /// 実レジストリを触るが、書くのはテスト専用の root だけ。
    #[cfg(windows)]
    #[test]
    fn installs_and_removes_every_target() {
        use winreg::enums::HKEY_CURRENT_USER;
        use winreg::RegKey;

        let root = format!(r"Software\quiet-md-test\{}\Classes", std::process::id());
        let exe = Path::new(r"C:\Program Files\Quiet\Quiet.exe");

        assert!(!imp::is_installed(&root, exe));
        imp::install(&root, exe).unwrap();
        assert!(imp::is_installed(&root, exe));

        // 別の場所を指す登録は「未登録」として扱う。
        assert!(!imp::is_installed(&root, Path::new(r"D:\old\Quiet.exe")));

        imp::uninstall(&root).unwrap();
        assert!(!imp::is_installed(&root, exe));
        // 無い状態で外しても失敗しない。
        imp::uninstall(&root).unwrap();

        let _ = RegKey::predef(HKEY_CURRENT_USER)
            .delete_subkey_all(format!(r"Software\quiet-md-test\{}", std::process::id()));
    }
}
