// @vitest-environment jsdom

/**
 * 本文の右クリックメニュー（ADR-025）の結線。
 *
 * 書式そのものの判断は domain の inline-format / line-prefix のテストが持つ。
 * ここは「どの項目が押せるか」と「押したら CodeMirror が変わるか」を見る。
 *
 * jsdom には座標が無いので、右クリックの位置は常に (0, 0) になる。
 * 選択の内か外かは、その位置が選択に入るかどうかで作り分ける。
 */

import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { describe, expect, it, vi } from "vitest";
import { coreExtensions } from "./extensions";
import { Editor } from "./Editor";
import { EditorContextMenu, type EditorContextTarget } from "./EditorContextMenu";

// @ts-expect-error React の act 環境フラグ
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// jsdom は Range.getClientRects を持たない。CodeMirror の座標計算がここで落ちる。
Range.prototype.getClientRects = function () {
  return Object.assign([], { item: () => null }) as unknown as DOMRectList;
};

function mount(node: ReactNode): HTMLDivElement {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(node));
  return host;
}

function buttonWith(host: HTMLElement, label: string): HTMLButtonElement {
  const found = [...host.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").startsWith(label),
  );
  if (!found) throw new Error(`項目が無い: ${label}`);
  return found;
}

function viewWith(doc: string, from: number, to: number): EditorView {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  return new EditorView({
    state: EditorState.create({
      doc,
      selection: EditorSelection.single(from, to),
      extensions: coreExtensions(),
    }),
    parent,
  });
}

describe("Editor の contextmenu", () => {
  /** 右クリックを起こし、親へ上がった状態を返す。座標は (0, 0)。 */
  function rightClick(selection: { from: number; to: number }): {
    target: EditorContextTarget | null;
    prevented: boolean;
  } {
    let target: EditorContextTarget | null = null;
    const host = mount(
      <Editor
        initialText="hello world"
        documentKey="a"
        fontSize={14}
        tabWidth={2}
        lineWrap
        spellCheck={false}
        halfWidthAscii={false}
        halfWidthSeparators={false}
        onChange={() => {}}
        onCursorChange={() => {}}
        onReady={(view) => {
          view.dispatch({ selection: EditorSelection.single(selection.from, selection.to) });
        }}
        onContextMenu={(next) => {
          target = next;
        }}
      />,
    );

    const content = host.querySelector(".cm-content") as HTMLElement;
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    act(() => {
      content.dispatchEvent(event);
    });
    return { target, prevented: event.defaultPrevented };
  }

  it("既定のメニューを止め、選択の外ならカーソルをそこへ移す", () => {
    const { target, prevented } = rightClick({ from: 6, to: 11 });
    expect(prevented).toBe(true);
    expect(target?.selected).toBe("");
    expect(target?.canUndo).toBe(false);
    expect(target?.canRedo).toBe(false);
  });

  it("選択の中なら選択を保つ", () => {
    const { target } = rightClick({ from: 0, to: 11 });
    expect(target?.selected).toBe("hello world");
  });
});

describe("EditorContextMenu", () => {
  const target: EditorContextTarget = {
    position: { x: 10, y: 10 },
    selected: "world",
    canUndo: false,
    canRedo: true,
  };

  it("太字を押すと選択を囲む", () => {
    const view = viewWith("hello world", 6, 11);
    const host = mount(
      <EditorContextMenu
        target={target}
        view={view}
        onSearch={() => {}}
        onError={() => {}}
        onClose={() => {}}
      />,
    );
    act(() => buttonWith(host, "太字").click());
    expect(view.state.doc.toString()).toBe("hello **world**");
    expect(view.state.selection.main.from).toBe(8);
  });

  it("引用を押すと行頭へ付ける", () => {
    const view = viewWith("hello world", 6, 11);
    const host = mount(
      <EditorContextMenu
        target={target}
        view={view}
        onSearch={() => {}}
        onError={() => {}}
        onClose={() => {}}
      />,
    );
    act(() => buttonWith(host, "引用").click());
    expect(view.state.doc.toString()).toBe("> hello world");
  });

  it("履歴が無いと元に戻すを押せない", () => {
    const view = viewWith("hello world", 6, 11);
    const host = mount(
      <EditorContextMenu
        target={target}
        view={view}
        onSearch={() => {}}
        onError={() => {}}
        onClose={() => {}}
      />,
    );
    expect(buttonWith(host, "元に戻す").disabled).toBe(true);
    expect(buttonWith(host, "やり直す").disabled).toBe(false);
    expect(buttonWith(host, "リンク").disabled).toBe(false);
  });

  it("選択が無いと切り取りを押せず、検索の項目も出ない", () => {
    const view = viewWith("hello world", 3, 3);
    const host = mount(
      <EditorContextMenu
        target={{ position: { x: 1, y: 1 }, selected: "", canUndo: true, canRedo: false }}
        view={view}
        onSearch={() => {}}
        onError={() => {}}
        onClose={() => {}}
      />,
    );
    expect(buttonWith(host, "切り取り").disabled).toBe(true);
    expect(buttonWith(host, "コピー").disabled).toBe(true);
    expect(host.textContent).not.toContain("を検索");
  });

  it("選択が無くても太字を押すと記号だけ入り、カーソルが内側へ来る", () => {
    const view = viewWith("hello world", 3, 3);
    const host = mount(
      <EditorContextMenu
        target={{ position: { x: 1, y: 1 }, selected: "", canUndo: true, canRedo: false }}
        view={view}
        onSearch={() => {}}
        onError={() => {}}
        onClose={() => {}}
      />,
    );
    expect(buttonWith(host, "太字").disabled).toBe(false);
    act(() => buttonWith(host, "太字").click());
    expect(view.state.doc.toString()).toBe("hel****lo world");
    expect(view.state.selection.main.from).toBe(5);
    expect(view.state.selection.main.to).toBe(5);
  });

  it("検索は選択文字列を渡す", () => {
    const view = viewWith("hello world", 6, 11);
    const onSearch = vi.fn();
    const host = mount(
      <EditorContextMenu
        target={target}
        view={view}
        onSearch={onSearch}
        onError={() => {}}
        onClose={() => {}}
      />,
    );
    expect(host.textContent).toContain('"world" を検索');
    act(() => buttonWith(host, '"world"').click());
    expect(onSearch).toHaveBeenCalledWith("world");
  });

  it("貼り付けはクリップボードから読み直して入れる", async () => {
    const view = viewWith("hello world", 6, 11);
    Object.defineProperty(navigator, "clipboard", {
      value: { readText: () => Promise.resolve("quiet") },
      configurable: true,
    });
    const host = mount(
      <EditorContextMenu
        target={target}
        view={view}
        onSearch={() => {}}
        onError={() => {}}
        onClose={() => {}}
      />,
    );
    act(() => buttonWith(host, "貼り付け").click());
    await act(async () => {});
    expect(view.state.doc.toString()).toBe("hello quiet");
  });

  it("クリップボードが読めなければ知らせる", async () => {
    const view = viewWith("hello world", 6, 11);
    Object.defineProperty(navigator, "clipboard", {
      value: { readText: () => Promise.reject(new Error("no")) },
      configurable: true,
    });
    const onError = vi.fn();
    const host = mount(
      <EditorContextMenu
        target={target}
        view={view}
        onSearch={() => {}}
        onError={onError}
        onClose={() => {}}
      />,
    );
    act(() => buttonWith(host, "貼り付け").click());
    await act(async () => {});
    expect(onError).toHaveBeenCalledWith("クリップボードから貼り付けられませんでした");
    expect(view.state.doc.toString()).toBe("hello world");
  });
});
