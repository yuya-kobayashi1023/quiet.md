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
- [ ] Large titleと`title`の同期ルールが仕様通り
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
- [ ] Renameしても`frontmatter.title`は変わらない
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

## P. 未設計のため検証不能な項目

次はUI仕様が存在しないため、判断（`product/open-decisions.md`）が済むまでACを確定できない。

- Conflict / Save error / External delete のUI（U-022）
- Find in document のUI（U-025）
- Toast（U-026）
- Empty states / Error states（`ui/ui-spec.md` §14・§15 は[DRAFT]）
