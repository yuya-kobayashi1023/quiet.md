# ADR-004 — Dark Themeは独立Color Scheme

Status: **Accepted**

## Context

単純なLight反転は、Surface hierarchy・Text contrast・Accent量が不自然になる。

## Decision

Light / DarkでSemantic tokenを別定義する。

Dark:

```text
Canvas       #171713
Sidebar      #1e1d19
Selected     #292823
Border       #3b3932
Text         #ebe8df
Accent       #ff6a2a
```

`filter: invert()`等は使わない。

System modeはOS themeへ追従。

## Consequences

Color token管理が増えるが、ブランドトーンをDarkでも維持できる。
