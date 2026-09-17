import { describe, expect, it } from "vitest";
import { toggleTaskLine } from "./task-list";

describe("toggleTaskLine", () => {
  it("未完了を完了にする", () => {
    expect(toggleTaskLine("- [ ] a")).toBe("- [x] a");
  });

  it("完了を未完了にする（小文字 x）", () => {
    expect(toggleTaskLine("- [x] a")).toBe("- [ ] a");
  });

  it("完了を未完了にする（大文字 X）", () => {
    expect(toggleTaskLine("- [X] a")).toBe("- [ ] a");
  });

  it("入れ子の字下げを保つ", () => {
    expect(toggleTaskLine("  * [ ] nested")).toBe("  * [x] nested");
  });

  it("番号付きリストでも反転する", () => {
    expect(toggleTaskLine("1. [ ] ordered")).toBe("1. [x] ordered");
    expect(toggleTaskLine("2) [x] ordered")).toBe("2) [ ] ordered");
  });

  it("マーカーより後ろの文字列は変えない", () => {
    expect(toggleTaskLine("- [ ] a [ ] b  ")).toBe("- [x] a [ ] b  ");
  });

  it("タスク項目でない行は null", () => {
    expect(toggleTaskLine("- [ ]nospace")).toBeNull();
    expect(toggleTaskLine("plain")).toBeNull();
    expect(toggleTaskLine("[ ] no marker")).toBeNull();
    expect(toggleTaskLine("- [y] other")).toBeNull();
    expect(toggleTaskLine("")).toBeNull();
  });
});
