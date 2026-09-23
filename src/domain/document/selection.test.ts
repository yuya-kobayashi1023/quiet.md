import { describe, expect, it } from "vitest";
import { EMPTY_SELECTION, nextSelection, type SidebarSelection } from "./selection";

/** Notes → Archive の順に見えている行。 */
const order = ["a.md", "b.md", "c.md", "d.md"];

const selection = (paths: string[], anchor: string | null): SidebarSelection => ({ paths, anchor });

describe("nextSelection", () => {
  it("修飾キーなしのクリックは選択を解除する", () => {
    const next = nextSelection(selection(["a.md", "b.md"], "a.md"), order, "c.md", "plain");
    expect(next).toEqual({ paths: [], anchor: null });
  });

  it("Ctrl+クリックで選択に足す", () => {
    const next = nextSelection(EMPTY_SELECTION, order, "b.md", "toggle");
    expect(next).toEqual({ paths: ["b.md"], anchor: "b.md" });
  });

  it("Ctrl+クリックは選択済みの行を外す", () => {
    const next = nextSelection(selection(["b.md", "c.md"], "b.md"), order, "b.md", "toggle");
    expect(next).toEqual({ paths: ["c.md"], anchor: "b.md" });
  });

  it("Ctrl+クリックで足した行も表示順に並ぶ", () => {
    const next = nextSelection(selection(["c.md"], "c.md"), order, "a.md", "toggle");
    expect(next).toEqual({ paths: ["a.md", "c.md"], anchor: "a.md" });
  });

  it("Shift+クリックは起点からその行までを選ぶ", () => {
    const next = nextSelection(selection(["b.md"], "b.md"), order, "d.md", "range");
    expect(next).toEqual({ paths: ["b.md", "c.md", "d.md"], anchor: "b.md" });
  });

  it("Shift+クリックは起点より上の行へも効く", () => {
    const next = nextSelection(selection(["c.md"], "c.md"), order, "a.md", "range");
    expect(next).toEqual({ paths: ["a.md", "b.md", "c.md"], anchor: "c.md" });
  });

  it("Shift+クリックを続けると、同じ起点から範囲を取り直す", () => {
    const first = nextSelection(selection(["b.md"], "b.md"), order, "d.md", "range");
    const second = nextSelection(first, order, "c.md", "range");
    expect(second).toEqual({ paths: ["b.md", "c.md"], anchor: "b.md" });
  });

  it("起点が無い Shift+クリックは、その 1 件を選んで起点にする", () => {
    const next = nextSelection(EMPTY_SELECTION, order, "c.md", "range");
    expect(next).toEqual({ paths: ["c.md"], anchor: "c.md" });
  });

  it("起点が並びから消えているときも、その 1 件を選んで起点にする", () => {
    const next = nextSelection(selection([], "gone.md"), order, "c.md", "range");
    expect(next).toEqual({ paths: ["c.md"], anchor: "c.md" });
  });

  it("並びから消えた行は選択から外れる", () => {
    const next = nextSelection(selection(["a.md", "gone.md"], "a.md"), order, "c.md", "toggle");
    expect(next).toEqual({ paths: ["a.md", "c.md"], anchor: "c.md" });
  });

  it("並びに無い行はクリックしても選べない", () => {
    const next = nextSelection(selection(["a.md"], "a.md"), order, "gone.md", "toggle");
    expect(next).toEqual({ paths: ["a.md"], anchor: "a.md" });
  });
});
