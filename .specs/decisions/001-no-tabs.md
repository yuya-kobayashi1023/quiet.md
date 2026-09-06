# ADR-001 — Tabsを採用しない

Status: **Accepted**

## Context

複数Markdownを開くためにTop barへTabsを試作した。

Tabsは機能的には便利だったが、現在開いている複数文書の状態を常時表示するため、UIの情報密度が上がった。

本アプリではContent first / Quiet by defaultを優先する。

## Decision

Tabsを採用しない。

Top barはBreadcrumbを維持する。

## Consequences

利点:

- Top barが静か
- 文書コンテキストが1つに明確
- Sidebarとの役割重複が少ない

欠点:

- 2文書を高速往復する場合はTabsより遅い可能性

補完:

- Quick Open
- Sidebar
- Open in New Window

## Guardrail

AI実装時に、複数文書対応を理由としてTabsを再追加しない。

再検討には明示的なProduct decisionが必要。
