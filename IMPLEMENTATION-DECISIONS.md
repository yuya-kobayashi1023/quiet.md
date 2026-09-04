# 実装中に私（AI）が独断で決めたこと

> ユーザー確認を取らずに進めた判断の記録。あとでまとめて確認してもらうためのもの。
> 仕様書（`.specs/`）で決まっていたことは、ここには書かない。ここにあるのは**仕様に書かれていなかった判断**だけ。
>
> - `[AUTO-xxx]` … 私が決めたもの。要確認。
> - 重要度 **High** は、あとで変えると作り直しが発生するもの。

## 一覧

| ID | 判断 | 重要度 |
|---|---|---|
| AUTO-001 | アプリを1リポジトリのルート直下に置く（`src/` と `src-tauri/`） | Low |
| AUTO-002 | Vite + React 19 + TypeScript を手書きでscaffoldする | Low |
| AUTO-003 | 状態管理ライブラリを入れず、React標準（Context + useSyncExternalStore）で始める | Medium |
| AUTO-004 | パッケージ名・アプリ識別子を `quiet-md` / `com.quiet-md.app` にする | Medium |

---

## AUTO-001 リポジトリ構成

`.specs/` と同じリポジトリのルート直下にアプリを置く。

```text
quiet.md/
├─ .specs/          仕様書
├─ src/             Frontend
├─ src-tauri/       Rust
├─ index.html
└─ package.json
```

理由: 単一アプリのリポジトリで、`apps/` のような階層を先に作る理由がない（YAGNI）。
`architecture/architecture.md` §3 のモジュール構成はそのまま `src/` 配下へ適用する。

## AUTO-002 scaffold方法

`npm create vite` は対話プロンプトが出て非対話実行が不安定なため、
必要なファイル（`package.json` / `vite.config.ts` / `tsconfig.json` / `index.html`）を直接書いた。
生成物は create-vite の react-ts テンプレートと同等。

React は執筆時点の最新（19系）を使う。仕様書はバージョンを指定していない。

## AUTO-003 状態管理

`architecture/architecture.md` §7 が「Global state libraryを最初から大きく入れすぎない」としているため、
Redux / Zustand / Jotai を入れず、React標準の機能だけで始める。

- Persistent app state（Theme / Settings）: Context
- Workspace state / Document session state: 小さなstore + `useSyncExternalStore`

**後から必要になれば差し替える。**この判断は変更コストが中程度。

## AUTO-004 名前と識別子

- npm package name: `quiet-md`
- Tauri identifier: `com.quiet-md.app`
- Window title: `Quiet`

仕様書にプロダクト名の正式表記（英語名・識別子）がなかったため、リポジトリ名 `quiet.md` から機械的に決めた。
配布物の名前に直結するので、変えるなら実装が進む前が良い。
