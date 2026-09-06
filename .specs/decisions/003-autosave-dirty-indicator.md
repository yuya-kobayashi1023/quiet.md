# ADR-003 — 保存状態はファイル名右のDirty dotで表す

Status: **Accepted**

## Context

Top barやStatus barに`Saved`を常時表示すると、保存済みという通常状態に画面を使い続ける。

## Decision

Clean:

表示なし。

Dirty / Saving:

```text
filename.md          ●
```

Save成功:

dotが消える。

Save failure:

dotだけでは不足するため別の明示Error UIを使う。

## Consequences

通常状態は静か。

状態変化がDocument行へ直接紐づく。
