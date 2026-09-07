# ADR-014 — Explorer の右クリック「Quiet で開く」

Status: **Accepted**（2026-09-08）

Related: ADR-013, U-001, U-011, U-021, `ui/desktop-ux.md` §6

## Context

ADR-013 で関連付け起動は通った。しかし関連付けは「既定のアプリ」に選ばれた 1 つしか効かない。
別のエディタを既定にしている人には、ダブルクリック以外に Quiet で開く手段がない。

フォルダを Workspace として開く導線も、アプリを起動してから Open を選ぶ経路しかない。
Explorer で目的のフォルダを見ている状態から始められない。

## Decision

### 1. HKCU の legacy verb として登録する

書き込むのは `HKCU\Software\Classes` の下の 4 か所だけにする。管理者権限を要求せず、
NSIS の currentUser インストールと権限の前提が揃う。

| 登録先（Classes からの相対） | command の引数 | 開くもの |
|---|---|---|
| `SystemFileAssociations\.md\shell\QuietOpen` | `%1` | File |
| `SystemFileAssociations\.markdown\shell\QuietOpen` | `%1` | File |
| `Directory\shell\QuietOpen` | `%V` | Workspace |
| `Directory\Background\shell\QuietOpen` | `%V` | Workspace |

`SystemFileAssociations` に置くのは、既定のアプリが Quiet でなくても出したいため。
ProgId 側（関連付け）に置くと、既定を取らない限り出ない。

起動後は argv を通って ADR-013 の `OpenTarget` に合流する。開く経路は増やさない。

### 2. 既定では登録せず、Settings のトグルで入れる

右クリックメニューは全アプリの共有資源で、勝手に増やすと他のアプリの項目を押しのける。
インストーラでは登録せず、Settings > General のトグルで入れる / 外す。

### 3. 状態の正はレジストリに置く

`settings.json` へ写さない。別 Window の Quiet・regedit・アンインストーラのどれで消えても、
設定画面の表示と実態が食い違わないようにする。Settings を開くたびに OS へ聞く。

command が今の実行ファイルを指していないときは「未登録」として扱う。
押しても今のアプリが開かない登録を ON と表示しないため。ON にし直せば上書きで直る。

### 4. アンインストールで消す

NSIS の `NSIS_HOOK_PREUNINSTALL`（`src-tauri/nsis/hooks.nsh`）で 4 キーを削除する。
消えた実行ファイルを指す「Quiet で開く」をメニューへ残さない。

## Consequences

- Windows 11 では既定のメニューではなく「その他のオプションを表示」（Shift+F10）の中に出る。
  既定メニューへ出すには MSIX パッケージ + `IExplorerCommand` の shell extension が要り、
  配布形態を NSIS から変えることになる。本 ADR の範囲外
- 複数ファイルを選んで実行すると選択数だけ command が起動するが、
  single-instance（ADR-013）が 1 プロセスへ束ねる
- 登録には現在の実行ファイルパスが入る。インストール先が変わるとトグルは OFF に見える。
  ON にし直すと現在のパスで書き直る
- Windows 以外は `supported: false` を返し、設定に項目自体を出さない

## Alternatives

### MSIX + IExplorerCommand

Windows 11 の既定メニューへ出せる唯一の方法。ただし配布を NSIS から MSIX へ変え、
COM を実装した DLL を同梱する必要がある。得るものは表示位置だけなので採らない。

### `*\shell` へ登録して全ファイルに出す

拡張子を問わず出てしまう。Quiet は Markdown 以外を開けないので、押せるのに開けない項目になる。

### インストーラで既定登録する

ユーザーが選ぶ前にメニューを増やすことになる。`product/principles.md` の「静かに」と合わない。
