/**
 * Document service。
 *
 * Save transaction を統括する（architecture.md §8）。
 * Editor コンポーネントは直接 write しない。
 *
 * 最重要の制約（U-008）:
 * **保存は memory → disk の一方通行。ここから Editor の state へ書き戻さない。**
 * 書き戻すとカーソル・選択・スクロールが飛ぶ。
 */

import * as native from "@/services/native-bridge";
import { NativeError } from "@/domain/document/errors";
import type {
  DiskRevision,
  DocumentProblem,
  DocumentSession,
  LineEnding,
} from "@/domain/document/types";
import { titleOf } from "@/domain/document/types";
import { Store } from "@/services/store";

/** U-008: 最終入力から 700ms。 */
export const AUTOSAVE_DELAY = 700;
/** Crash recovery 用の snapshot 間隔（U-014）。 */
const RECOVERY_INTERVAL = 4000;

export interface DocumentState {
  session: DocumentSession | null;
  /** 外部変更を検知したが、まだユーザーが選択していない状態の相手側の内容。 */
  incoming: { revision: DiskRevision } | null;
}

const EMPTY: DocumentState = { session: null, incoming: null };

export class DocumentService {
  readonly store = new Store<DocumentState>(EMPTY);

  private autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  private recoveryTimer: ReturnType<typeof setTimeout> | null = null;
  private saveChain: Promise<unknown> = Promise.resolve();

  get session(): DocumentSession | null {
    return this.store.get().session;
  }

  /* ---------------------------------------------------------------- *
   * Open / Close
   * ---------------------------------------------------------------- */

  async open(path: string): Promise<void> {
    // 切替前に保存する（U-008 の即時save条件）。
    await this.flush();

    const doc = await native.readDocument(path);
    this.store.set({
      session: {
        path: doc.path,
        filename: doc.filename,
        title: titleOf(doc.filename),
        text: doc.content,
        hasBom: doc.hasBom,
        lineEnding: doc.lineEnding,
        revision: doc.revision,
        saveState: "clean",
        problem: null,
      },
      incoming: null,
    });
  }

  /** 新規作成直後など、内容が空と分かっている文書を開く。 */
  adopt(session: DocumentSession): void {
    this.store.set({ session, incoming: null });
  }

  async close(): Promise<void> {
    await this.flush();
    this.clearTimers();
    this.store.set(EMPTY);
  }

  /* ---------------------------------------------------------------- *
   * Edit
   * ---------------------------------------------------------------- */

  /**
   * 本文が変わった。Editor / Title / Metadata の編集はすべてここへ集約する
   * （file-lifecycle.md §3: 別々の dirty flag を持たない）。
   */
  edit(text: string): void {
    const { session } = this.store.get();
    if (!session || session.text === text) return;

    this.store.set((prev) => ({
      ...prev,
      session: prev.session
        ? {
            ...prev.session,
            text,
            // conflict 中は dirty へ戻さない。ユーザーが選ぶまで保留する。
            saveState: prev.session.saveState === "conflict" ? "conflict" : "dirty",
          }
        : null,
    }));

    this.scheduleAutosave();
    this.scheduleRecovery();
  }

  private scheduleAutosave(): void {
    const { session } = this.store.get();
    if (!session || session.saveState === "conflict" || session.saveState === "missing") {
      return;
    }
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
    this.autosaveTimer = setTimeout(() => {
      void this.save();
    }, AUTOSAVE_DELAY);
  }

  private scheduleRecovery(): void {
    if (this.recoveryTimer) return;
    this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null;
      const { session } = this.store.get();
      if (session && session.saveState !== "clean") {
        void native.writeRecoverySnapshot(session.path, session.text).catch(() => {
          // recovery は補助機能。失敗しても本編集を止めない。
        });
      }
    }, RECOVERY_INTERVAL);
  }

  private clearTimers(): void {
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
    if (this.recoveryTimer) clearTimeout(this.recoveryTimer);
    this.autosaveTimer = null;
    this.recoveryTimer = null;
  }

  /* ---------------------------------------------------------------- *
   * Save
   * ---------------------------------------------------------------- */

  /** 保留中の autosave があれば即座に走らせる。Window blur / 切替 / close で呼ぶ。 */
  async flush(): Promise<void> {
    const { session } = this.store.get();
    if (!session || session.saveState === "clean") return;
    await this.save();
  }

  /**
   * 保存する。
   *
   * 直列化して、autosave と Ctrl+S が同時に走らないようにする。
   */
  save(): Promise<void> {
    this.saveChain = this.saveChain.then(
      () => this.performSave(),
      () => this.performSave(),
    );
    return this.saveChain as Promise<void>;
  }

  private async performSave(): Promise<void> {
    if (this.autosaveTimer) {
      clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }

    const { session } = this.store.get();
    if (!session) return;
    if (session.saveState === "clean" || session.saveState === "conflict") return;

    // 保存する内容を先に固定する。保存中の入力は次の dirty として扱う。
    const snapshot = session.text;

    this.patchSession({ saveState: "saving", problem: null });

    try {
      const revision = await native.saveDocument({
        path: session.path,
        content: snapshot,
        lineEnding: session.lineEnding,
        hasBom: session.hasBom,
        expectedRevision: session.revision,
      });

      const current = this.store.get().session;
      if (!current || current.path !== session.path) return;

      // 保存中にさらに編集されていたら dirty のまま。text は絶対に上書きしない。
      const stillDirty = current.text !== snapshot;
      this.patchSession({
        revision,
        saveState: stillDirty ? "dirty" : "clean",
        problem: null,
      });

      if (stillDirty) {
        this.scheduleAutosave();
      } else {
        void native.clearRecoverySnapshot(session.path).catch(() => {});
      }
    } catch (raw) {
      const error = raw instanceof NativeError ? raw : new NativeError("IO_ERROR");
      const problem: DocumentProblem =
        error.code === "CONFLICT"
          ? { kind: "conflict", message: error.message }
          : error.code === "NOT_FOUND"
            ? { kind: "missing", message: error.message }
            : { kind: "save_error", message: error.message };

      this.patchSession({
        saveState: problem.kind === "conflict" ? "conflict" : problem.kind,
        problem,
      });

      // 失敗しても dirty content は memory に残る（file-lifecycle.md §6）。
      const { session: current } = this.store.get();
      if (current) {
        void native.writeRecoverySnapshot(current.path, current.text).catch(() => {});
      }
    }
  }

  private patchSession(patch: Partial<DocumentSession>): void {
    this.store.set((prev) =>
      prev.session ? { ...prev, session: { ...prev.session, ...patch } } : prev,
    );
  }

  /* ---------------------------------------------------------------- *
   * Rename（Title 編集もここを通る。U-006 / U-020）
   * ---------------------------------------------------------------- */

  async rename(toFilename: string): Promise<void> {
    const { session } = this.store.get();
    if (!session) return;

    // 先に保存しておく。rename 後に古い path へ書かないため。
    await this.flush();

    const result = await native.renameDocument(session.path, toFilename);
    this.patchSession({
      path: result.path,
      filename: result.filename,
      title: result.title,
    });
  }

  /* ---------------------------------------------------------------- *
   * External change（U-010 / U-022）
   * ---------------------------------------------------------------- */

  /**
   * 外部変更が届いた。
   *
   * clean なら黙って reload、dirty なら conflict。
   * dirty な内容で外部変更を上書きしない（file-lifecycle.md §11）。
   */
  async handleExternalChange(path: string, revision: DiskRevision): Promise<void> {
    const { session } = this.store.get();
    if (!session || session.path !== path) return;
    if (session.revision?.contentHash === revision.contentHash) return;

    if (session.saveState === "clean") {
      const doc = await native.readDocument(path);
      this.store.set((prev) => ({
        ...prev,
        session: prev.session
          ? {
              ...prev.session,
              text: doc.content,
              hasBom: doc.hasBom,
              lineEnding: doc.lineEnding,
              revision: doc.revision,
              saveState: "clean",
              problem: null,
            }
          : null,
      }));
      return;
    }

    this.store.set((prev) => ({
      incoming: { revision },
      session: prev.session
        ? {
            ...prev.session,
            saveState: "conflict",
            problem: {
              kind: "conflict",
              message: "このファイルはエディタの外で変更されました。",
            },
          }
        : null,
    }));
  }

  handleExternalDelete(path: string): void {
    const { session } = this.store.get();
    if (!session || session.path !== path) return;
    this.patchSession({
      saveState: "missing",
      problem: {
        kind: "missing",
        message: "このファイルはエディタの外で削除されました。",
      },
    });
  }

  /** conflict の解決: 自分の変更を残す。 */
  async keepMine(): Promise<void> {
    const { session } = this.store.get();
    if (!session) return;
    const revision = await native.documentRevision(session.path).catch(() => null);
    this.store.set((prev) => ({
      incoming: null,
      session: prev.session
        ? { ...prev.session, revision, saveState: "dirty", problem: null }
        : null,
    }));
    await this.save();
  }

  /** conflict の解決: ディスクの内容で置き換える。 */
  async reloadFromDisk(): Promise<void> {
    const { session } = this.store.get();
    if (!session) return;
    const doc = await native.readDocument(session.path);
    this.store.set({
      incoming: null,
      session: {
        ...session,
        text: doc.content,
        hasBom: doc.hasBom,
        lineEnding: doc.lineEnding,
        revision: doc.revision,
        saveState: "clean",
        problem: null,
      },
    });
    void native.clearRecoverySnapshot(session.path).catch(() => {});
  }

  /** save_error からの再試行。 */
  async retry(): Promise<void> {
    this.patchSession({ saveState: "dirty", problem: null });
    await this.save();
  }
}

export const documentService = new DocumentService();

export type { DiskRevision, LineEnding };
