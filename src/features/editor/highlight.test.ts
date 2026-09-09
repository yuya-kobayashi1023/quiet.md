/**
 * Markdown 記号の色が、囲みの役（heading / quote）に負けないこと。
 *
 * lezer-markdown は `ATXHeading1/...` のように子孫へも役を継がせるので、
 * `#` には heading と processingInstruction の両方の class が付く。
 * どちらも class 1 個で詳細度が同じため、**CSS の後ろに出た方が勝つ**。
 * `quietHighlight` の並び順がそのまま出力順なので、記号を前に戻すと
 * 見出しの `#` が本文と同色になる（ui-spec.md §8 に反する）。
 */

import { describe, expect, it } from "vitest";
import { quietHighlight } from "./extensions";

describe("quietHighlight", () => {
  it("記号の規則を heading / quote より後ろに出す", () => {
    const rules = quietHighlight.module?.getRules() ?? "";

    const marker = rules.lastIndexOf("--syntax-marker");
    const heading = rules.lastIndexOf("--text-primary");
    const quote = rules.lastIndexOf("--text-prose");

    expect(marker).toBeGreaterThan(-1);
    expect(marker).toBeGreaterThan(heading);
    expect(marker).toBeGreaterThan(quote);
  });
});
