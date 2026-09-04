# Design System

> 現PrototypeのTokenをProduction向けに整理したDraft。  
> DarkはLightの反転ではなく別スキーマ。

## 1. Color roles

### Light

```css
--canvas: #f7f7f4;
--sidebar: #f2f1ed;
--selected: #e6e5e0;
--border: #cdcdc9;

--text-primary: #26251e;
--text-editor: #34332d;
--text-prose: #3b3a34;
--text-muted: #7a7974;
--text-subtle: #a1a19f;

--accent: #f54e00;
--syntax-marker: #a36a43;
--success: #34785c;
--selection: #8bc4f8;
```

### Dark

```css
--canvas: #171713;
--sidebar: #1e1d19;
--selected: #292823;
--border: #3b3932;

--text-primary: #ebe8df;
--text-editor: #d9d5ca;
--text-prose: #d2cfc5;
--text-muted: #918e84;
--text-subtle: #77756c;

--accent: #ff6a2a;
--syntax-marker: #d19368;
--success: #67a987;
--selection: #355f82;
```

---

## 2. Semantic rules

### Accent

Accentは以下に限定する。

- Link
- Dirty dot
- Markdown syntax punctuation
- 短いemphasis

禁止:

- Primary large button全面
- Sidebar全面
- Selected file全面
- Large card background

### Success

文書の保存成功を常時Greenで表示しない。

Settings変更等、一時FBに限定可能。

### Error

[DRAFT]

Error colorはProductionで別Semantic tokenを追加する。

推奨Light:

```css
--error: #b44332;
```

推奨Dark:

```css
--error: #e07a68;
```

保存失敗はError icon + textで表示し、色だけに依存しない。

---

## 3. Typography

### UI

```text
Inter
system-ui fallback
```

用途:

- Buttons
- Settings
- Navigation
- Title

### Mono

```text
ui-monospace
SFMono-Regular
Menlo
Monaco
Consolas
```

用途:

- Markdown source
- Metadata keys
- Breadcrumb
- Status bar
- Shortcut
- Tooltip

### Preview prose

Default:

```text
Iowan Old Style
Palatino
Georgia
```

SettingsでSans serif選択可能。

---

## 4. Font sizes

Draft scale:

| Role | Size |
|---|---:|
| Micro status | 9.8–10.5px |
| Sidebar file | 12px |
| UI | 11.5–13px |
| Editor source | 14px |
| Preview prose | 17px |
| H2 Preview | 23px |
| Document title | 36px |

---

## 5. Radius

基本は4px。

- Button: 4px
- Row hover: 4px
- Input: 4px
- Tooltip: 4px
- Modal: 8pxまで許容

Pillの乱用は禁止。

---

## 6. Borders

1px Hairlineを基本。

面差を作れる場合はBorderを増やさない。

Settings行のように、Hover backgroundだけで十分な場所へDividerを追加しない。

---

## 7. Shadow

ShadowはFlyout系だけ。

- Tooltip
- TOC Popover
- Command Palette
- Settings Modal

通常のSidebar row / Editor areaにはDrop shadowを使わない。

---

## 8. Motion

推奨:

| Interaction | Duration |
|---|---:|
| Hover | 100–120ms |
| Active state | 120–150ms |
| Dirty dot | 120ms |
| Modal / Popover | 150–180ms |
| Sidebar collapse | 180ms |

Easing:

```css
cubic-bezier(.2, .8, .2, 1)
```

またはOSに違和感のないease-out。

---

## 9. Motion principle

「動いていること」ではなく「状態が変わったこと」が分かればよい。

避ける:

- Large scale animation
- Bounce
- Glow
- Continuous animation
- Cursor follow
- Page-wide fade

`prefers-reduced-motion` を尊重。

---

## 10. Icons

- 14–16px
- Thin monoline
- 原則currentColor
- Decorative filled iconを増やさない

SettingsはGearではなくSlider controls系を採用。

---

## 11. Hover

Sidebar utility / file row:

- 背景を一段だけ濃く
- textをprimaryへ近づける
- 位置を動かさない

---

## 12. Focus

[DRAFT]

Keyboard focusはHoverより明確にする。

推奨:

```css
outline: 1px solid color-mix(...);
outline-offset: 1px;
```

Focus ringを完全に消さない。
