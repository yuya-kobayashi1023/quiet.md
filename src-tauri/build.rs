fn main() {
  // tauri_build は tauri.conf.json と capabilities しか rerun-if-changed に登録しない。
  // icons/ を監視しないと、アイコンを差し替えても Windows のリソース (icon.ico の埋め込み)
  // が再生成されず、古いアイコンを持つ resource.lib がそのままリンクされる。
  println!("cargo:rerun-if-changed=icons");
  tauri_build::build()
}
