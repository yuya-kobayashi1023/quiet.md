// @vitest-environment jsdom

/**
 * 畳んだ Rail のアイコン（ADR-027）と、Rail から Archive を開く導線（ADR-023 §6）。
 */

import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EMPTY_SELECTION } from "@/domain/document/selection";
import type { DocumentSummary } from "@/domain/document/types";
import { Sidebar } from "./Sidebar";

// @ts-expect-error React の act 環境フラグ
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const archivedNote: DocumentSummary = {
  relativePath: "old.md",
  path: "C:/notes/old.md",
  filename: "old.md",
  title: "old",
  modifiedAt: 0,
  createdAt: 0,
  size: 0,
};

function Harness() {
  const [collapsed, setCollapsed] = useState(true);
  const noop = () => {};
  return (
    <Sidebar
      documents={[archivedNote]}
      recents={[]}
      workspaces={[]}
      workspaceRoot="C:/notes"
      workspaceName="notes"
      archived={["old.md"]}
      pinned={[]}
      expandedFolders={[]}
      activePath={null}
      selection={EMPTY_SELECTION}
      saveState="clean"
      collapsed={collapsed}
      compact={false}
      showCreatedAt={false}
      onToggleCollapsed={() => setCollapsed((value) => !value)}
      onSelect={noop}
      onSelectionChange={noop}
      onNewNote={noop}
      onToggleFolder={noop}
      onOpenSettings={noop}
      onContextMenu={noop}
      onSelectRecent={noop}
      onRecentContextMenu={noop}
      onSelectWorkspace={noop}
      onOpenWorkspace={noop}
      onWorkspaceContextMenu={noop}
    />
  );
}

function mount(): HTMLDivElement {
  const host = document.createElement("div");
  document.body.appendChild(host);
  act(() => createRoot(host).render(<Harness />));
  return host;
}

function button(host: HTMLElement, label: string): HTMLButtonElement {
  const found = host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (!found) throw new Error(`ボタンが無い: ${label}`);
  return found;
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("Rail", () => {
  it("アイコンにホバーすると、名前とショートカットが Tooltip で出る", () => {
    vi.useFakeTimers();
    const host = mount();

    act(() => {
      button(host, "新規ノート").dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      vi.advanceTimersByTime(400);
    });
    expect(document.querySelector('[role="tooltip"]')?.textContent).toBe("新規ノートCtrl+N");

    act(() => {
      button(host, "新規ノート").dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
    });
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
  });

  it("名前の無いアイコンは無い", () => {
    const host = mount();
    const labels = [...host.querySelectorAll("button")].map((b) => b.getAttribute("aria-label"));
    expect(labels).toEqual([
      "サイドバーを開く",
      "Workspace を切り替える",
      "ノート",
      "新規ノート",
      "アーカイブ",
      "設定",
    ]);
  });

  it("アーカイブを押すと、Archive 区分が開いた状態で Sidebar が開く", () => {
    const host = mount();
    act(() => button(host, "アーカイブ").click());

    const head = host.querySelector(".sidebar-dock .section-head--toggle");
    expect(head?.getAttribute("aria-expanded")).toBe("true");
    expect(host.querySelector(".sidebar-dock .tree-label")?.textContent).toBe("old.md");
  });
});
