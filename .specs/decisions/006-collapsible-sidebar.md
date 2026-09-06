# ADR-006 — Sidebarはフルハイト + Collapsed rail

Status: **Accepted**

## Context

SidebarとStatus barの境界線がずれるレイアウトは、パネル構造が曖昧に見えた。

完全にSidebarを消すと、戻すための操作も消える。

## Decision

Expanded:

226px、Content Areaの上端から下端まで。

Collapsed:

56px rail。

Railには主要iconだけ残す。

SettingsはExpanded / Collapsedとも最下部。

## Consequences

アプリのNavigation axisが残る。

本文幅を確保しつつ、Sidebarを完全に見失わない。
