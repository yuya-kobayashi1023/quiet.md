# Quiet

静かな Markdown エディタ。フォルダをそのまま Workspace として開き、書いている間は
エディタ以外のものを画面から減らすことを狙っている。

まだ開発中（v0.1.0）。Windows を主対象に作っていて、macOS は後追い。

## できること

- フォルダを Workspace として開く。アプリはフォルダを所有せず、普通の `.md` を読み書きする
- 入力が止まると自動保存。保存ボタンはない
- Write / Split / Read の 3 モード。Split はソースとプレビューのスクロールを行単位で同期する
- Front Matter を専用 UI で編集（本文とは分けて扱う）
- コマンドパレット（`Ctrl+K`）、文書内検索（`Ctrl+F`）、Workspace 全文検索（`Ctrl+Shift+F`）
- 論理 Archive（ファイルは移動しない）
- `.md` の関連付け起動。Workspace 外で開いたファイルはサイドバーの Recent に残る
- Explorer の右クリックに「Quiet で開く」を追加できる（Settings > General。Windows 11 では「その他のオプションを表示」の中）
- 箇条書きの階層編集、``` の閉じ補完、コードブロックのシンタックスハイライト

## 技術構成

Tauri 2 + React 19 + TypeScript。ファイルシステムに触る処理は全て Rust 側の command に閉じてあり、
フロントエンドは直接ファイルを読み書きしない。エディタは CodeMirror 6。

## 開発

```bash
npm install
npm run tauri:dev     # デスクトップアプリとして起動
npm run dev           # ブラウザで UI だけ確認（ファイル IO はメモリ上のフォールバック）
npm run check         # 型チェック + テスト
npm run tauri:build   # インストーラ（NSIS）を作る
```

Rust 側は `src-tauri/` で `cargo test` / `cargo check`。

## リリース

インストーラは GitHub Actions で作る。ローカルでビルドして手で上げる必要はない。

1. リリースしたい内容を GitHub へ push する
2. Actions > Release > Run workflow で、ブランチと `bump`（patch / minor / major）を選んで実行
   - CLI なら `gh workflow run release.yml -f bump=patch`
   - 試すだけなら `dry_run` を on にする（commit も Release もせず、成果物だけ Actions に残る）
3. ワークフローが `npm run check` と `cargo test` を通したうえで、
   バージョンを全ファイル（`package.json` / `package-lock.json` / `tauri.conf.json` / `Cargo.toml` / `Cargo.lock`）で上げ、
   `chore(release): vX.Y.Z` を commit、`vX.Y.Z` タグを push、NSIS インストーラを添えた Release を公開する

バージョンだけ手で動かしたいときは `node scripts/bump-version.mjs <patch|minor|major|X.Y.Z>`。

配布物にコード署名はしていないので、初回インストール時に SmartScreen の警告が出る。

## ライセンス

MIT
