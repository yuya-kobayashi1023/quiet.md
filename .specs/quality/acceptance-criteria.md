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
- [ ] Rail と Sidebar のアイコンにホバーまたは Keyboard focus すると、名前（ショートカットがあればそれも）が Tooltip で表示される（ADR-027）
- [ ] Rail の Archive アイコンを押すと、Archive 区分が開いた状態で Sidebar が開く（ADR-023 §6）
- [ ] サブフォルダを持つWorkspaceでも全ての`.md`へ到達できる（U-024）
- [ ] ignore対象（dotfolder / `node_modules` / `.quiet`）が一覧に出ない（U-024）
- [ ] Notes / Archive の各階層で、フォルダ行が名前順に先に並び、ファイル行が作成日時の新しい順に続く（ADR-019）
- [ ] 保存しても、そのファイルの並び位置が変わらない（ADR-019）
- [ ] 既定では作成日時が出ない（ADR-019）
- [ ] Appearance「作成日時を表示」を on にすると、ファイル行の右端に `yyyy-mm-dd hh:mm` が出る（ADR-019）
- [ ] Recent の行には作成日時が出ない（ADR-019）
- [ ] Archive 区分は既定で閉じており、見出しを押すと開閉する（ADR-023）
- [ ] Archive 内のノートを開くと Archive 区分が開き、その後は手動で閉じられる（ADR-023）
- [ ] 開閉状態は保存されず、起動時は常に閉じた状態となる（ADR-023）
- [ ] Ctrl+クリックでファイル行の選択が増減し、ノートは開かない（ADR-024）
- [ ] Shift+クリックで起点からその行までが選択される（上下どちらの向きでも同様）（ADR-024）
- [ ] 修飾キーなしのクリックでノートを開き、選択を解除する（ADR-024）
- [ ] 選択中の行は Active 行と区別できる（ADR-024）
- [ ] 選択範囲内を右クリックすると件数付きの一括メニューが表示され、選択範囲外を右クリックすると 1 件のメニューに戻る（ADR-024）
- [ ] 複数のノートを一括でアーカイブでき、Toast の「元に戻す」でその一覧だけが元に戻る（ADR-024）
- [ ] Escape キーの押下または Workspace の切り替えで選択が解除される（ADR-024）

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
- [ ] 日本語入力で `Ｑｕｉｅｔ１２` と確定すると `Quiet12` に変換され、カーソルより前の全角は変更されない（ADR-022）
- [ ] Editor「区切り記号も半角にする」を on にすると `１２：３０` が `12:30` に変換され、off（既定）では `12：30` のまま維持される（ADR-022）
- [ ] 本文を右クリックした際、WebView の既定メニューではなく Quiet のメニューが表示される（ADR-025）
- [ ] 選択範囲外を右クリックするとカーソルがその位置へ移動し、選択範囲内では選択状態が維持される（ADR-025）
- [ ] 非選択時は切り取り・コピー、履歴がないときは元に戻す・やり直すを押下できない（ADR-025）
- [ ] 非選択時に太字を押すと記号のみが挿入され、カーソルが記号の内側に入る（ADR-025）
- [ ] 太字を 2 回適用すると `**` が外れ、引用・箇条書き・チェックリストは選択した全行に付与され、全行に付与されている場合は解除される（ADR-025）
- [ ] テキストを選択して「"◯◯" を検索」を押下すると、その語が入力された状態で Find bar が開く（ADR-025）
- [ ] 折り返しを有効にした状態で長いリスト項目を書くと、2行目以降が本文の頭に揃う（ADR-026）
- [ ] 入れ子の箇条書き項目にカーソルを置いた際、同じ深さの兄弟の marker だけが濃く表示され、別の深さへ移動すると濃く表示される marker もその深さへ移る（ADR-027）
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
