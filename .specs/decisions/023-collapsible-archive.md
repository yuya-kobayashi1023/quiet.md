# ADR-023 — Archive 区分を折りたためるようにする

Status: **Accepted**（2026-09-23、§7 を同日追記）

Amends: ADR-013（Recent の disclosure を Archive にも広げる）

Related: U-005, U-024, ADR-006, ADR-013, `ui/ui-spec.md` §2, `ui/interactions.md` §12

## Context

現状、Archive 区分は常に開いている。しかし Archive は一時的な参照用の区分であり、常時表示する必要はない。アーカイブしたノートが増えると Notes の下に長い一覧が表示され続け、Notes のスクロール領域を圧迫する。

Recent でも同様の理由から、見出しごと disclosure にして既定を閉じた状態としている（ADR-013、`ui/ui-spec.md` §2 Recent）。Archive にも同様の扱いを適用できる。

## Decision

### 1. 見出しごと disclosure にする

Archive の見出しを押して開閉できるようにし、既定は閉じた状態とする。見出しの右端に caret を配置し、開いているときは回転させる。Recent の `section-head--toggle` と同じ markup および外観にする。

なお、Notes は常時作業対象であり折りたたむ必要がないため、本仕様は適用しない。

### 2. 開閉状態は保持しない

開閉状態は Workspace metadata に保存せず、Window ごとおよび起動ごとに閉じた状態から開始する。

フォルダの開閉状態（`expandedFolders`）は Notes の作業動線に関わるため永続化している。一方、Archive 区分自体の開閉は整理作業中のみ開く一時的な状態であり、永続化する価値が Rust 側 metadata を増やすコストに見合わない。Recent の開閉も同じ理由で保持していない。

### 3. 開いているノートが Archive にあるときは自動で開く

`activePath` が Archive 側のファイルになったときは、Archive 区分を自動で開く。開いているノートの行が見えないと、Active 表示（`ui/ui-spec.md` §2）が表示されなくなるためである。

自動で開いた後はユーザー操作で閉じることができる。閉じた状態へ強制的に戻すことはしない。

### 4. 件数は出さない

閉じている状態も含め、件数は表示しない。Recent と同様に、Sidebar の見出し行を情報の置き場にしない方針（`ui/ui-spec.md` §2 の禁止事項）に揃える。

### 5. 0 件のときは区分ごと出さない

現状の挙動を維持し、アーカイブが 1 件もない Workspace では Archive の見出しも表示しない。

### 6. Collapsed rail は変えない

Collapsed rail（ADR-006）の Archive アイコンの挙動は変更せず、従来どおり Sidebar を開く。開いた先で Archive 区分が閉じているかどうかは §3 の規則に従う。

### 7. Sidebar の下端へ固定する（2026-09-23 追記）

Archive 区分は Notes と共にスクロールさせず、Recent と同様に Sidebar の下端（Recent の直上）へ固定する。開くと一覧は上方向へ伸び、その分だけ Notes の表示領域が縮小する。閉じている間は見出し 1 行分のみを占有するため、Notes を下端付近まで広く使える。

開いたときの高さは Recent と同様に 10 行分を上限とし、超過分は Archive 内でのみスクロールする。見出しの上には Recent と同様に薄い区切り線を配置し、スクロールする Notes と下端に固定した区分との境界を示す。

Notes の下に配置したままでは、アーカイブを閉じていても見出しが Notes の末尾に続くため、Notes の行数が多いと見出しがスクロールの奥に隠れる。逆に Archive を開くと、Notes の続きとして一覧が伸びるため、未アーカイブのノートを多く閲覧したいときの妨げになる。下端へ固定すれば、Notes の表示量は Archive の開閉だけで決まる。

## Consequences

- Archive 側のフォルダ開閉状態は `expandedFolders` を Notes と共有するため、Archive 区分を閉じても失われない。
- Archive を開いた状態で Workspace を切り替えると、切り替え先では閉じた状態から開始される。
- Sidebar のスクロール領域を主に Notes が使用できるようになる。

## Alternatives

### Workspace ごとに開閉を記憶する

不採用とする。Rust 側の `WorkspaceMetadata` に field を追加し、既存の `workspace.json` の読み込みに既定値を用意する必要がある。得られるメリットは「起動のたびに開き直さずに済む」ことのみであり、Archive を常用しない前提に対してコストが見合わない。

### 開いた状態を既定にする

不採用とする。アーカイブが多い Workspace では Notes の下に長い一覧が表示されたままになり、本 ADR の目的を果たせない。

### Notes も畳めるようにする

不採用とする。Notes を折りたたむとファイル一覧が表示されなくなり、Sidebar の役割が失われる。折りたたみたい場合は、Sidebar ごと折りたたむ導線がすでに存在する（ADR-006）。
