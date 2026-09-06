# Glossary

## Autosave

入力後、ユーザーがSaveボタンを押さなくてもファイルへ保存する仕組み。

## Dirty state

Memory上の内容が、最後に正常保存されたDisk上の内容と一致していない状態。

UIでは未保存`●`として表す。

## Atomic save

既存ファイルへ直接途中書きせず、一時ファイルへ完全に書いた後で差し替える保存方法。

保存途中のCrashでファイルが半壊するリスクを下げる。

## File watcher

OS上でファイルが外部変更されたことを検知する仕組み。

## Front Matter

Markdown先頭のYAMLメタデータ。

## Progressive disclosure

必要になるまで詳細UIを隠す設計。

## Breadcrumb

現在のファイル位置を示すナビゲーション。

Tabsとは違い、複数Documentを並列表示するものではない。

## Popover

ボタン等の近くへ一時表示する小さな浮動パネル。

## Context Menu

右クリック等で開く、その対象に紐づいた操作一覧。

## Workspace

アプリが現在扱っているMarkdown群のルートフォルダ。

## CST

Concrete Syntax Tree。

YAML等の構文情報・コメント・表記を保持しながら編集するために使える構造。

## IME Composition

日本語入力などで、変換確定前の文字列を編集中の状態。

通常のkeydown文字入力とは異なるため、Editor実装で重要。
