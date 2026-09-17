/**
 * Settings service。
 *
 * Frontend で LocalStorage へバラバラに保存せず、ここへ集約する
 * （interfaces.md §10）。
 */

import * as native from "@/services/native-bridge";
import { pushRecent, removeRecent, type RecentFile } from "@/domain/document/recents";
import {
  pushWorkspace,
  removeWorkspace,
  type WorkspaceEntry,
} from "@/domain/document/workspaces";
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
  /** ADR-012: Split で Editor と Preview のスクロールを合わせるか。 */
  syncScroll: boolean;

  /* Appearance */
  theme: ThemePreference;
  previewTypeface: PreviewTypeface;
  compactSidebar: boolean;
  /** ADR-019: Sidebar のファイル行に作成日時を添えるか。 */
  showCreatedAt: boolean;

  /* UI 状態（設定画面には出さない） */
  sidebarCollapsed: boolean;
  viewMode: ViewMode;
  /** U-030: 既定は文字数。 */
  countMode: "characters" | "words";
  /** ADR-011: Search All で Archive も探すか。既定は探す。 */
  searchIncludeArchived: boolean;

  /* Recent（ADR-013） */
  /** Workspace 外で開いたファイルの履歴。新しい順。上限は RECENT_LIMIT。 */
  recentFiles: RecentFile[];

  /* Workspace 履歴（ADR-016） */
  /** 過去に開いた Workspace。新しい順。上限は WORKSPACE_LIMIT。 */
  workspaces: WorkspaceEntry[];
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
  syncScroll: true,

  theme: "system",
  previewTypeface: "serif",
  compactSidebar: false,
  showCreatedAt: false,

  sidebarCollapsed: false,
  viewMode: "write",
  countMode: "characters",
  searchIncludeArchived: true,

  recentFiles: [],

  workspaces: [],
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

  /* ---------------------------------------------------------------- *
   * Recent（ADR-013）
   * ---------------------------------------------------------------- */

  /** Workspace 外で開いたファイルを履歴の先頭へ積む。 */
  rememberRecent(path: string): void {
    this.update({ recentFiles: pushRecent(this.get().recentFiles, path, Date.now()) });
  }

  /** 開けなくなったファイルを履歴から外す。 */
  forgetRecent(path: string): void {
    this.update({ recentFiles: removeRecent(this.get().recentFiles, path) });
  }

  /* ---------------------------------------------------------------- *
   * Workspace 履歴（ADR-016）
   * ---------------------------------------------------------------- */

  /** 開いた Workspace を履歴の先頭へ積む。 */
  rememberWorkspace(path: string): void {
    this.update({ workspaces: pushWorkspace(this.get().workspaces, path, Date.now()) });
  }

  /** 開けなくなった Workspace を履歴から外す。 */
  forgetWorkspace(path: string): void {
    this.update({ workspaces: removeWorkspace(this.get().workspaces, path) });
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
