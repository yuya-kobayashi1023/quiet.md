# Acceptance Criteria

> 「何をもって完成とするか」を固定する。  
> Prototypeの見た目だけ一致していても、ここを満たさなければ完了ではない。

## A. Shell / Layout

- [ ] Sidebarは通常226px
- [ ] Collapse時56px
- [ ] SidebarはContent Area上端から下端まで連続
- [ ] Settingsは最下部
- [ ] Settings上に不要なDividerがない
- [ ] Top barは52px相当
- [ ] Status barは28px相当
- [ ] `FILES`文字列がない
- [ ] Logo placeholderがない
- [ ] Tabsがない
- [ ] Breadcrumbがある

---

## B. Sidebar

- [ ] Notes header右にNew Note `+`
- [ ] Archive区分がある
- [ ] Active fileが明確
- [ ] Long filenameは折返さない
- [ ] Long filenameはellipsis
- [ ] 省略時Hoverでフルファイル名Tooltip
- [ ] Keyboard focusでもTooltip
- [ ] TooltipはBrowser native `title`だけに依存しない
- [ ] Dirty fileは右側にdot
- [ ] Clean時dotが消える
- [ ] Status barにSaved文字を出さない
- [ ] Collapse時に操作可能なIcon railが残る
- [ ] Collapse時Settingsは最下部
- [ ] サブフォルダを持つWorkspaceでも全ての`.md`へ到達できる（U-024）
- [ ] ignore対象（dotfolder / `node_modules` / `.quiet`）が一覧に出ない（U-024）

---

## C. Editor

- [ ] Markdownを編集できる
- [ ] IME日本語入力で文字欠落しない
- [ ] Undo / Redo
- [ ] Selection
- [ ] Copy / Paste
- [ ] Find
- [ ] Markdown syntax punctuationが控えめにhighlight
- [ ] 本文が多色になりすぎない
- [ ] Titleの`g`,`y`,`p`,`q`等descenderが欠けない
- [ ] 長いTitleが固定高で切り取られない（折り返す）
- [ ] Line wrap ON/OFF
- [ ] Tab width setting
- [ ] Large documentで入力が実用速度

---

## D. View modes

- [ ] Write
- [ ] Split
- [ ] Read
- [ ] Split時Editor paneに縦スクロール1本
- [ ] Split時Preview paneに縦スクロール1本
- [ ] Editor内部にNested vertical scrollbarが出ない
- [ ] View switchでEditor textが消失しない
- [ ] Split resize後にEditor layoutが正しく再計算

---

## E. Preview

- [ ] Heading
- [ ] Paragraph
- [ ] List
- [ ] Blockquote
- [ ] Inline code
- [ ] Fenced code
- [ ] Link
- [ ] Horizontal rule
- [ ] Markdown table
- [ ] Table横幅超過時だけ横scroll
- [ ] Preview上部に`PREVIEW`ラベルがない
- [ ] Dark themeでも可読
- [ ] 本文の`#`がPreviewでもH1のまま（降格しない）
- [ ] 相対パスの画像が表示される（U-023）
- [ ] 外部linkがWebView内で遷移しない（U-023）
- [ ] Raw HTMLの扱いが仕様通り（U-023）

---

## F. TOC

- [ ] Top bar iconからOpen
- [ ] 常時表示されない
- [ ] Headingから自動生成
- [ ] 階層が分かる
- [ ] Long headingはtruncate
- [ ] ClickでEditorの対象位置へ移動
- [ ] ReadではPreviewへ移動
- [ ] Splitでは適切に両側を扱う
- [ ] Esc / outside clickで閉じる

---

## G. Front Matter

- [ ] Front Matterを認識
- [ ] Collapsed時`Metadata · N fields`
- [ ] Fields view
- [ ] Raw view
- [ ] title
- [ ] tags
- [ ] status
- [ ] created
- [ ] `title` キーがあってもTitle UIの表示が変わらない
- [ ] Titleを編集してもFront Matterが増えない
- [ ] Unknown YAML keyを失わない
- [ ] YAML commentsを可能な限り保持
- [ ] Invalid YAML入力を勝手に破棄しない
- [ ] Invalid時にFeedback
- [ ] PreviewにRaw YAMLを見せない

---

## H. Theme

- [ ] System
- [ ] Light
- [ ] Dark
- [ ] DarkがCSS inversionではない
- [ ] Light canvas `#f7f7f4`系
- [ ] Dark canvas `#171713`系
- [ ] Accentをlarge surfaceに使わない
- [ ] Theme選択を再起動後も保持
- [ ] SystemはOS theme変更へ追従

---

## I. Settings

- [ ] Sidebar最下部から開く
- [ ] Slider controls icon
- [ ] General / Editor / Appearance
- [ ] Doneで閉じる
- [ ] Escで閉じる
- [ ] Backdrop clickで閉じる
- [ ] Modal内focus management
- [ ] Setting変更時の一時Saved feedback
- [ ] 文書Saved状態と混同しない

---

## J. Save

- [ ] EditでDirty
- [ ] Dirty dotが出る
- [ ] Autosave成功で消える
- [ ] `Ctrl/Cmd+S`で即時save
- [ ] Atomic write
- [ ] Save failureでDirty contentを保持
- [ ] Save failureを明示通知
- [ ] Window close時に保存安全性を確認
- [ ] 保存時にline endingを変換しない（LF / CRLFを保持）
- [ ] 保存時にUTF-8 BOMの有無を保持
- [ ] 保存時に本文を無条件で再整形しない
- [ ] Autosave delayが仕様値（U-008）
- [ ] Autosaveの前後でカーソル位置が変わらない（U-008）
- [ ] Autosaveの前後で選択範囲とスクロール位置が変わらない（U-008）
- [ ] 自分のsaveがExternal changeとして扱われない（U-028）
- [ ] Window blur / Document切替 / App close前に即時save

---

## K. External change

- [ ] Clean fileの外部変更を検知
- [ ] Cleanならreload
- [ ] Dirtyなら自動上書きしない
- [ ] Conflict stateになる
- [ ] External deleteを検知
- [ ] Dirty contentのSave a copy導線

---

## L. Desktop

- [ ] OS Open dialog
- [ ] Folder picker
- [ ] Save As
- [ ] Markdown file drag/drop
- [ ] Context menu
- [ ] Reveal in Explorer/Finder
- [ ] Keyboard shortcut
- [ ] Window close
- [ ] New Windowが仕様通り
- [ ] Tabsを追加しない

### 外部から渡された対象（ADR-018）

アプリが起動し、いずれかのファイルを開いている状態から確認する。

- [ ] 現在の Workspace 内の `.md` をエクスプローラーで開く → 同一Windowで開き、選択行がそのファイルへ移動する
- [ ] 既知のどの Workspace にも属さない `.md` を開く → 同一Windowで開き、Recent に追加される
- [ ] Workspace 履歴にある別 Workspace の `.md` を開く → 同一Windowでその Workspace に切り替わった後に開く（Recent には追加されない）
- [ ] 既に開いているファイルを開く → そのファイルを表示しているWindowが前面に表示される（U-021）
- [ ] いずれの場合もWindowが増えない
- [ ] `Open in New Window` は従来どおりWindowを増やす
- [ ] 2つのWindowを開き、片方をfocusした状態で外部ファイルを開く → focusしていた側のWindowで開く
- [ ] 切り替え先の Workspace フォルダが存在しない場合 → 履歴から除外され、Toast が表示されて単体ファイルとして開く
- [ ] アプリが終了している状態から別 Workspace の `.md` をダブルクリックする → その Workspace が開いた状態で起動する

---

## M. Accessibility

- [ ] KeyboardだけでSidebar / Editor / TOC / Settingsを操作
- [ ] Focus visible
- [ ] Modal focus trap
- [ ] Screen reader labels
- [ ] Reduced motion
- [ ] Major errorを色だけで表現しない
- [ ] Light / Darkの双方でContrast要求を満たす（U-019）
- [ ] TooltipがScreen readerから対象行に紐づいている

---

## N. File operations

- [ ] 明示操作からRenameできる
- [ ] Rename時にOS禁止文字・Windows予約名・同名衝突をInline errorで示す
- [ ] Title UIの編集でファイルがRenameされる
- [ ] Renameしても`frontmatter.title`は変わらない
- [ ] Renameの失敗時に元のファイル名へ戻る
- [ ] Duplicate
- [ ] Copy Path
- [ ] Archiveで対象がArchive区分へ移る（U-005）
- [ ] ArchiveをUndoできる（U-026）
- [ ] Restoreできる
- [ ] MVPの通常UIにDeleteを置かない

---

## O. Recovery / Persistence

- [ ] Crash後に未保存内容を復旧できる（U-014）
- [ ] 正常save後にrecovery snapshotが残らない
- [ ] Settings / Theme / 最終選択ファイルが再起動後も保持される
- [ ] `.quiet/workspace.json` が壊れてもMarkdown本文を失わない
- [ ] Workspace metadataにversionがある

---

## P. UI詳細の確定待ち

判断は済んでいる（`product/open-decisions.md` は30/30回答済み）。
次は画面の細部を描いた時点でACへ落とす。

- Conflict / Save error / External delete banner の文言とボタン配置（U-022で配置は確定）
- Inline find bar の各コントロール（U-025で位置は確定）
- Toast の文言（U-026で位置・時間は確定）
- Empty states（`ui/ui-spec.md` §14 は[DRAFT]のまま）
