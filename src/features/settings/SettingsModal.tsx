/**
 * Settings modal。
 *
 * ui-spec.md §13: 左 Navigation（General / Editor / Appearance）、右 Content。
 * 設定変更時は Settings 内に一時的な `Saved` を出す。
 * これは文書の保存状態とは別（ADR-003 と混同しない）。
 *
 * Modal 内で focus を閉じ込め、Esc とバックドロップで閉じる（AC-I）。
 */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import * as native from "@/services/native-bridge";
import { settingsService, type AppSettings } from "@/services/settings-service";
import "./settings.css";

type Page = "general" | "editor" | "appearance";

const PAGES: { id: Page; label: string }[] = [
  { id: "general", label: "General" },
  { id: "editor", label: "Editor" },
  { id: "appearance", label: "Appearance" },
];

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="setting-row">
      <div className="setting-copy">
        <div className="setting-label">{label}</div>
        <div className="setting-hint">{hint}</div>
      </div>
      {children}
    </div>
  );
}

function Switch({
  checked,
  label,
  disabled = false,
  onChange,
}: {
  checked: boolean;
  label: string;
  /** 親の設定が off で効かないとき。値は保ったまま操作だけ止める。 */
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`switch${checked ? " is-on" : ""}`}
      onClick={() => onChange(!checked)}
    />
  );
}

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const settings = useSyncExternalStore(
    settingsService.store.subscribe,
    settingsService.store.get,
    settingsService.store.get,
  );
  const [page, setPage] = useState<Page>("general");
  const [saved, setSaved] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [contextMenu, setContextMenu] = useState<native.ContextMenuStatus | null>(null);
  const [contextMenuFailed, setContextMenuFailed] = useState(false);

  const flashSaved = () => {
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 1100);
  };

  const update = (patch: Partial<AppSettings>) => {
    settingsService.update(patch);
    flashSaved();
  };

  // 右クリックメニューの正はレジストリ側にある（ADR-014）。
  // 設定 JSON へ写すと外部で外されたときに食い違うので、開くたびに OS へ聞く。
  useEffect(() => {
    let alive = true;
    native
      .contextMenuStatus()
      .then((status) => alive && setContextMenu(status))
      .catch(() => alive && setContextMenu({ supported: false, enabled: false }));
    return () => {
      alive = false;
    };
  }, []);

  const toggleContextMenu = (next: boolean) => {
    setContextMenuFailed(false);
    void native
      .setContextMenu(next)
      .then((status) => {
        setContextMenu(status);
        flashSaved();
      })
      .catch(() => setContextMenuFailed(true));
  };

  // Focus trap（AC-I / desktop-ux.md §12）
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = panel.current;
    node?.querySelector<HTMLElement>("button")?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !node) return;
      const focusable = node.querySelectorAll<HTMLElement>(
        'button, select, input, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="settings-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="settings-panel"
        role="dialog"
        aria-modal="true"
        aria-label="設定"
        ref={panel}
      >
        <header className="settings-titlebar">
          <h2 className="settings-title">Settings</h2>
          <div className="settings-title-actions">
            <span className={`settings-saved${saved ? " is-visible" : ""}`} aria-live="polite">
              Saved
            </span>
            <button type="button" className="settings-done" onClick={onClose}>
              Done
            </button>
          </div>
        </header>

        <nav className="settings-nav" aria-label="設定セクション">
          {PAGES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={page === item.id ? "is-active" : ""}
              onClick={() => setPage(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="settings-content">
          {page === "general" ? (
            <>
              <h3 className="settings-heading">General</h3>
              <Row label="Autosave" hint="入力が止まってから自動で保存します。">
                <Switch
                  checked={settings.autosave}
                  label="Autosave"
                  onChange={(v) => update({ autosave: v })}
                />
              </Row>
              <Row label="起動時に前回のノートを開く" hint="最後に編集していた文書へ戻ります。">
                <Switch
                  checked={settings.openLastNoteOnLaunch}
                  label="起動時に前回のノートを開く"
                  onChange={(v) => update({ openLastNoteOnLaunch: v })}
                />
              </Row>
              {contextMenu?.supported ? (
                <>
                  <Row
                    label="右クリックメニューに追加"
                    hint="Markdown ファイルとフォルダの右クリックへ「Quiet で開く」を出します。Windows 11 では「その他のオプションを表示」の中に入ります。"
                  >
                    <Switch
                      checked={contextMenu.enabled}
                      label="右クリックメニューに追加"
                      onChange={toggleContextMenu}
                    />
                  </Row>
                  {contextMenuFailed ? (
                    <p className="settings-note" role="alert">
                      右クリックメニューを更新できませんでした。もう一度お試しください。
                    </p>
                  ) : null}
                </>
              ) : null}
              <Row label="コマンドパレット" hint="どこからでもコマンドとファイル検索を開きます。">
                <span className="setting-shortcut">Ctrl+K</span>
              </Row>
            </>
          ) : null}

          {page === "editor" ? (
            <>
              <h3 className="settings-heading">Editor</h3>
              <Row label="文字サイズ" hint="Markdown ソースの文字サイズ。">
                <select
                  className="setting-select"
                  aria-label="文字サイズ"
                  value={settings.fontSize}
                  onChange={(e) => update({ fontSize: Number(e.target.value) })}
                >
                  {[13, 14, 15, 16].map((size) => (
                    <option key={size} value={size}>
                      {size} px
                    </option>
                  ))}
                </select>
              </Row>
              <Row label="行の折り返し" hint="長い行を書き込み幅で折り返します。">
                <Switch
                  checked={settings.lineWrap}
                  label="行の折り返し"
                  onChange={(v) => update({ lineWrap: v })}
                />
              </Row>
              <Row label="スペルチェック" hint="OS のスペルチェッカーを使います。">
                <Switch
                  checked={settings.spellCheck}
                  label="スペルチェック"
                  onChange={(v) => update({ spellCheck: v })}
                />
              </Row>
              <Row label="タブ幅" hint="Tab キーで挿入するスペースの数。">
                <select
                  className="setting-select"
                  aria-label="タブ幅"
                  value={settings.tabWidth}
                  onChange={(e) => update({ tabWidth: Number(e.target.value) as 2 | 4 })}
                >
                  <option value={2}>2 spaces</option>
                  <option value={4}>4 spaces</option>
                </select>
              </Row>
              <Row
                label="スクロールを同期"
                hint="Split のとき、Editor と Preview のスクロールを行の対応で合わせます。"
              >
                <Switch
                  checked={settings.syncScroll}
                  label="スクロールを同期"
                  onChange={(v) => update({ syncScroll: v })}
                />
              </Row>

              <h4 className="settings-subheading">入力の自動修正</h4>
              <Row
                label="全角の英数字と記号を半角にする"
                hint="日本語入力で確定した Ａ〜Ｚ・０〜９・！？（）＂＋－ などを半角にします。"
              >
                <Switch
                  checked={settings.halfWidthAscii}
                  label="全角の英数字と記号を半角にする"
                  onChange={(v) => update({ halfWidthAscii: v })}
                />
              </Row>
              <Row
                label="区切り記号も半角にする"
                hint="： ； ， ． ～ も半角にします。文中で全角のまま使うなら off に。"
              >
                <Switch
                  checked={settings.halfWidthSeparators}
                  label="区切り記号も半角にする"
                  disabled={!settings.halfWidthAscii}
                  onChange={(v) => update({ halfWidthSeparators: v })}
                />
              </Row>
            </>
          ) : null}

          {page === "appearance" ? (
            <>
              <h3 className="settings-heading">Appearance</h3>
              <Row label="配色" hint="システムに合わせるか、固定するかを選びます。">
                <div className="segmented" role="group" aria-label="配色">
                  {(["system", "light", "dark"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={settings.theme === value}
                      className={settings.theme === value ? "is-active" : ""}
                      onClick={() => update({ theme: value })}
                    >
                      {value === "system" ? "System" : value === "light" ? "Light" : "Dark"}
                    </button>
                  ))}
                </div>
              </Row>
              <Row label="Preview の書体" hint="レンダリングされた本文の書体。">
                <select
                  className="setting-select"
                  aria-label="Preview の書体"
                  value={settings.previewTypeface}
                  onChange={(e) =>
                    update({ previewTypeface: e.target.value as "serif" | "sans" })
                  }
                >
                  <option value="serif">Serif</option>
                  <option value="sans">Sans serif</option>
                </select>
              </Row>
              <Row label="サイドバーを詰める" hint="ファイル行の高さを詰めます。">
                <Switch
                  checked={settings.compactSidebar}
                  label="サイドバーを詰める"
                  onChange={(v) => update({ compactSidebar: v })}
                />
              </Row>
              <Row label="作成日時を表示" hint="ファイル行の右端に作成日時を添えます。">
                <Switch
                  checked={settings.showCreatedAt}
                  label="作成日時を表示"
                  onChange={(v) => update({ showCreatedAt: v })}
                />
              </Row>
              <p className="settings-note">
                Dark は Light の反転ではなく、独立した配色です。Accent は小さな状態変化とリンクにだけ使います。
              </p>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
