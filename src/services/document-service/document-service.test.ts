/**
 * Save state machine のテスト。
 * .specs/quality/test-strategy.md §3 に対応する。
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentService, AUTOSAVE_DELAY } from "./index";
import {
  externalWrite,
  resetFallback,
  setFallbackDelay,
} from "@/services/native-bridge/browser-fallback";
import * as native from "@/services/native-bridge";

async function settle() {
  // マイクロタスクを流す。
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("DocumentService", () => {
  beforeEach(() => {
    resetFallback();
    vi.useFakeTimers();
  });

  it("clean → dirty → saving → clean", async () => {
    const service = new DocumentService();
    await service.open("/notes/a.md");
    expect(service.session?.saveState).toBe("clean");

    service.edit("# A changed\n");
    expect(service.session?.saveState).toBe("dirty");

    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY);
    await settle();
    expect(service.session?.saveState).toBe("clean");

    const saved = await native.readDocument("/notes/a.md");
    expect(saved.content).toBe("# A changed\n");
  });

  it("編集していなければ autosave しない", async () => {
    const service = new DocumentService();
    await service.open("/notes/a.md");
    const before = service.session?.revision;
    service.edit("# A\n"); // 同じ内容
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY);
    await settle();
    expect(service.session?.revision).toEqual(before);
    expect(service.session?.saveState).toBe("clean");
  });

  it("autosave は最後の入力から数える（debounce）", async () => {
    const service = new DocumentService();
    await service.open("/notes/a.md");

    service.edit("1");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY - 100);
    service.edit("12");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY - 100);
    expect(service.session?.saveState).toBe("dirty");

    await vi.advanceTimersByTimeAsync(100);
    await settle();
    expect(service.session?.saveState).toBe("clean");
  });

  it("保存中に編集されたら dirty のまま、本文を巻き戻さない", async () => {
    const service = new DocumentService();
    await service.open("/notes/a.md");

    // IO を飛ばしている最中に編集が入る状況を作る。
    setFallbackDelay(50);
    service.edit("first");
    const saving = service.save();
    await settle();
    expect(service.session?.saveState).toBe("saving");

    service.edit("second");
    await vi.advanceTimersByTimeAsync(50);
    await saving;
    await settle();
    setFallbackDelay(0);

    // 保存が終わっても、保存中に入力された内容を巻き戻さない。
    expect(service.session?.text).toBe("second");
    expect(service.session?.saveState).toBe("dirty");
  });

  it("flush は保留中の autosave を即座に走らせる", async () => {
    const service = new DocumentService();
    await service.open("/notes/a.md");
    service.edit("flushed");
    await service.flush();
    await settle();
    expect(service.session?.saveState).toBe("clean");
    expect((await native.readDocument("/notes/a.md")).content).toBe("flushed");
  });

  it("clean のまま外部変更が来たら reload する", async () => {
    const service = new DocumentService();
    await service.open("/notes/a.md");

    externalWrite("/notes/a.md", "# from outside\n");
    const revision = await native.documentRevision("/notes/a.md");
    await service.handleExternalChange("/notes/a.md", revision);

    expect(service.session?.text).toBe("# from outside\n");
    expect(service.session?.saveState).toBe("clean");
  });

  it("dirty で外部変更が来たら conflict になり、上書きしない", async () => {
    const service = new DocumentService();
    await service.open("/notes/a.md");
    service.edit("mine");

    externalWrite("/notes/a.md", "theirs");
    const revision = await native.documentRevision("/notes/a.md");
    await service.handleExternalChange("/notes/a.md", revision);

    expect(service.session?.saveState).toBe("conflict");
    // 自分の変更は memory に残っている
    expect(service.session?.text).toBe("mine");

    // conflict 中は autosave が走らない
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY * 3);
    await settle();
    expect((await native.readDocument("/notes/a.md")).content).toBe("theirs");
  });

  it("conflict から keep mine で自分の内容を保存できる", async () => {
    const service = new DocumentService();
    await service.open("/notes/a.md");
    service.edit("mine");
    externalWrite("/notes/a.md", "theirs");
    await service.handleExternalChange(
      "/notes/a.md",
      await native.documentRevision("/notes/a.md"),
    );

    await service.keepMine();
    await settle();

    expect(service.session?.saveState).toBe("clean");
    expect((await native.readDocument("/notes/a.md")).content).toBe("mine");
  });

  it("conflict から reload すると disk の内容になる", async () => {
    const service = new DocumentService();
    await service.open("/notes/a.md");
    service.edit("mine");
    externalWrite("/notes/a.md", "theirs");
    await service.handleExternalChange(
      "/notes/a.md",
      await native.documentRevision("/notes/a.md"),
    );

    await service.reloadFromDisk();
    expect(service.session?.text).toBe("theirs");
    expect(service.session?.saveState).toBe("clean");
  });

  it("外部削除で missing になり、内容を保持する", async () => {
    const service = new DocumentService();
    await service.open("/notes/a.md");
    service.edit("unsaved work");
    service.handleExternalDelete("/notes/a.md");

    expect(service.session?.saveState).toBe("missing");
    expect(service.session?.text).toBe("unsaved work");
  });

  it("Rename しても本文と saveState を壊さない", async () => {
    const service = new DocumentService();
    await service.open("/notes/a.md");
    service.edit("body");
    await service.rename("renamed.md");
    await settle();

    expect(service.session?.filename).toBe("renamed.md");
    expect(service.session?.title).toBe("renamed");
    expect(service.session?.text).toBe("body");
  });

  it("文書を切り替える前に保存する", async () => {
    const service = new DocumentService();
    await service.open("/notes/a.md");
    service.edit("edited a");
    await service.open("/notes/b.md");
    await settle();

    expect((await native.readDocument("/notes/a.md")).content).toBe("edited a");
    expect(service.session?.path).toBe("/notes/b.md");
  });
});
