# ADR-021 — Preview を PDF に書き出す

Status: **Accepted**（2026-09-17）

Related: U-020, U-023, ADR-004, ADR-008, `product/requirements.md` §4（P2 候補）、`ui/ui-spec.md` §11、`architecture/interfaces.md` §7 / §13

## Context

ノートの共有、印刷、別ツールへの転記にあたり、Markdown のままでは受け取り側が読めない。`product/requirements.md` §4 では Export HTML / PDF が P2 候補として挙げられていたが、形式と入口は未定であった。

また、Quiet の Preview は書式・字形・コードの色を保持している。書き出し結果の外観がこれと一致していなければ、画面上で整えた文書と紙面との間に乖離が生じる。

## Decision

### 1. 入口は Command Palette の「PDFを生成」のみとする

常設 UI は追加しない（`AGENTS.md` §4）。コマンドを実行すると OS の保存ダイアログが開き、既定のファイル名は `<タイトル>.pdf` とする。保存先は Workspace の外でもよい。ノートを開いていないときは Toast で通知し、処理を行わない。

出力完了時は Toast「PDF を保存しました」を表示し、「フォルダを開く」から保存先を Explorer / Finder で表示する。失敗時も Toast で通知する。

### 2. 変換は WebView 自身で行う

HTML から PDF への変換に別のレンダラは同梱せず、Preview を描画している WebView 自身で紙面を描画する。これにより、字形・改行・コードの色を画面表示と一致させる。

Windows では WebView2 の `PrintToPdf` を使い、印刷ダイアログを挟まずに保存先へ直接書き出す。macOS / Linux は未対応とし、エラーを返す（Windows first）。

### 3. 紙面は Preview と同じ部品で構成し、書き出し中のみ配置する

書き出し中のみ、`PrintSheet` が Preview と同じ部品（タイトル、Front Matter の要約、本文）を `body` 直下に配置する。`@media print` で画面の chrome（Sidebar / TopBar / Editor / Popover / Toast）を非表示にし、紙面のみを出力する。View mode が Write の状態でも書き出せる。

タイトルは画面の chrome であり文書の見出しではないため（ADR-008）、紙面でも本文の `#` は H1 のまま降格しない。

### 4. 紙面は常に Light、用紙は A4 とする

Dark テーマでの利用時も紙面は常に Light とする（紙面に暗い背景を適用しない）。実装は tokens.css の Light 値を `[data-theme="light"]` の subtree にも適用し、紙面の要素に当該属性を付与する。

用紙は A4 縦、余白 15mm とする。コードブロックの背景と引用の罫線を保持するため、背景色は印刷する。URL と日付のヘッダ / フッタは付与しない。

## Consequences

- Export HTML は含めず、必要になった段階で別の ADR で決定する。
- 用紙サイズと余白は固定とし、設定項目は追加しない。
- 紙面は画面の Preview の CSS をそのまま利用するため、Preview の見た目を変更すると紙面も変更される（意図した結合であり、個別の保守は行わない）。
- `export_pdf` は呼び出し元の Window 全体を印刷する。紙面に載せる内容は Frontend の責務とし、Native は保存先のみを管理する。

## Alternatives

### `window.print()` で OS の印刷ダイアログを出す

不採用。ユーザーが「Microsoft Print to PDF」を選択した上でさらに保存先を指定する 2 段階の操作が必要となり、プリンタ構成にも依存するため。

### 見えない Window を作って紙面だけを読み込ませる

不採用。Window の生成と読み込み完了の同期が必要となり、非表示の WebView2 が描画を停止する条件も検証しきれないため。同一の Window で `@media print` を使用すれば、この同期は不要となる。

### Rust 側の HTML → PDF ライブラリを同梱する

不採用。字形・日本語の改行・コードの色を Preview と揃え直す必要があり、バイナリサイズも肥大化するため。
