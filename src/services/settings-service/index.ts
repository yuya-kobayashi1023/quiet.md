/**
 * Settings service。
 *
 * Frontend で LocalStorage へバラバラに保存せず、ここへ集約する
 * （interfaces.md §10）。
 */

import * as native from "@/services/native-bridge";
import { Store } from "@/services/store";

export type ThemePreference = "system" | "light" | "dark";
export type PreviewTypeface = "serif" | "sans";
export type ViewMode = "write" | "split" | "read";

export interface AppSettings {
  /* General */
  autosave: boolean;
  openLastNoteOnLaunch: boolean;
  defaultLocation: string | null;
  lastWorkspace: string | null;

  /* Editor */
  fontSize: number;
  lineWrap: boolean;
  spellCheck: boolean;
  tabWidth: 2 | 4;

  /* Appearance */
  theme: ThemePreference;
  previewTypeface: PreviewTypeface;
  compactSidebar: boolean;

  /* UI 状態（設定画面には出さない） */
  sidebarCollapsed: boolean;
  viewMode: ViewMode;
  /** U-030: 既定は文字数。 */
  countMode: "characters" | "words";
}

export const DEFAULT_SETTINGS: AppSettings = {
  autosave: true,
  openLastNoteOnLaunch: true,
  defaultLocation: null,
  lastWorkspace: null,

  fontSize: 14,
  lineWrap: true,
  spellCheck: false,
  tabWidth: 2,

  theme: "system",
  previewTypeface: "serif",
  compactSidebar: false,

  sidebarCollapsed: false,
  viewMode: "write",
  countMode: "characters",
};

export class SettingsService {
  readonly store = new Store<AppSettings>(DEFAULT_SETTINGS);
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private mediaQuery: MediaQueryList | null = null;

  async load(): Promise<void> {
    try {
      const raw = await native.loadAppSettings();
      if (raw && typeof raw === "object") {
        this.store.set({ ...DEFAULT_SETTINGS, ...(raw as Partial<AppSettings>) });
      }
    } catch {
      // 設定が読めなくてもアプリは起動する。既定値で続行する。
    }
    this.applyTheme();
    this.watchSystemTheme();
  }

  get(): AppSettings {
    return this.store.get();
  }

  update(patch: Partial<AppSettings>): void {
    this.store.set((prev) => ({ ...prev, ...patch }));
    if (patch.theme !== undefined) this.applyTheme();
    this.persistSoon();
  }

  private persistSoon(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      void native.saveAppSettings(this.store.get()).catch(() => {});
    }, 250);
  }

  /* ---------------------------------------------------------------- *
   * Theme（ADR-004 / U-019）
   * ---------------------------------------------------------------- */

  private resolvedTheme(): "light" | "dark" {
    const { theme } = this.store.get();
    if (theme === "light" || theme === "dark") return theme;
    if (typeof window === "undefined" || !window.matchMedia) return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  applyTheme(): void {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = this.resolvedTheme();
  }

  /** System 選択時に OS の変更へ追従する（AC-H）。 */
  private watchSystemTheme(): void {
    if (typeof window === "undefined" || !window.matchMedia || this.mediaQuery) return;
    this.mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    this.mediaQuery.addEventListener("change", () => {
      if (this.store.get().theme === "system") this.applyTheme();
    });
  }
}

export const settingsService = new SettingsService();
