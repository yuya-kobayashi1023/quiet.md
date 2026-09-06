# ADR-002 — YAML Front MatterをMetadata UIとして段階表示する

Status: **Accepted**

## Context

YAML Front MatterはMarkdown利用者に一般的だが、本文先頭へ常時Raw YAMLを表示するとWriting surfaceの静けさを壊す。

一方で、隠しすぎると編集性を損なう。

## Decision

通常時:

```text
Metadata · N fields
```

Expanded:

```text
Fields | Raw
```

FieldsではKnown fieldを編集。

RawではYAMLを直接編集。

PreviewではRaw YAMLを表示せず、意味を圧縮したmetadataだけ表示。

## Known fields

- title
- tags
- status
- created

`title` はMetadata Fieldsの1項目にすぎない。
画面上部のTitle UIはファイル名を表示しており、`title` とは連動しない（U-006 / U-020）。

## Consequences

- YAML初心者でも編集可能
- 上級者はRawを失わない
- ProductionではLossless YAML preservationが必要
