# Non-Functional Requirements

> 数値は初期Draft。実機計測後に調整する。

## 1. Performance

[DRAFT]

### Launch

Warm launch:

```text
< 1.0s target
```

Cold launch:

```text
< 2.0s target
```

一般的な開発PC上。

### Editor input

Typingから画面反映:

```text
< 16ms ideal
< 50ms worst-case target
```

Preview再parseは入力をBlockしない。

### File open

1MB程度のMarkdown:

```text
< 300ms target
```

---

## 2. Large files

[DRAFT]

少なくとも5MB程度のMarkdownで、

- App freezeしない
- Editor入力可能
- TOC parseがUI threadを長時間Blockしない

巨大ファイルではPreview / TOCを遅延更新してよい。

大きな**Workspace**（1000ファイル超）の目標値は未定義。`U-024` を参照。

---

## 3. Reliability

- Atomic save
- Dirty buffer保持
- Save errorでcontent lossしない
- External conflictでsilent overwriteしない
- Crash recovery
- Workspace metadata破損でMarkdown本体を失わない

---

## 4. Data integrity

保存時に意図なく変えない。

- Line endings
- UTF-8 BOM
- YAML unknown keys
- YAML comments
- Markdown spacing

Formatting commandをユーザーが明示実行した場合だけ整形可能。

---

## 5. Privacy

[DRAFT]

MVPはLocal-first。

ユーザーDocument本文を外部Serverへ送らない。

Telemetryを追加する場合は別仕様・明示判断が必要。

---

## 6. Security

- Workspace範囲外writeを制限
- Path traversal
- Symlink
- Unsafe HTML preview
- `file://` link handling

を考慮。

Markdown raw HTMLをPreviewで許可するかは別途判断。

**推奨:** MVPではRaw HTML無効またはsanitize。

---

## 7. Accessibility

現在のLight tokenはWCAG AAを満たしていない。`U-019` を参照。

- WCAG相当のContrastを確認
- Keyboard navigation
- reduced motion
- Semantic roles
- Screen reader
- Focus visible

---

## 8. Cross-platform

[USER DECISION REQUIRED: U-009]

Windows first推奨。

ただしdomain / interfaceでWindows APIを直接UIへ露出しない。

---

## 9. Offline

Network未接続でもMVP基本機能が全て動作。

---

## 10. Update / migration

Workspace metadataにはversionを付ける。

例:

```json
{
  "version": 1
}
```

将来migration可能にする。

---

## 11. Logging

Production logへDocument本文を出さない。

記録してよい例:

```text
save failed: PERMISSION_DENIED, path=...
watch event: changed, path=...
```

YAML valueや本文を無断でlogしない。
