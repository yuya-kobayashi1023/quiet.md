import { describe, expect, it } from "vitest";
import { pastedImageFilename } from "./pasted-image";

// ローカル時刻の成分から Date を組み、タイムゾーンに依らず同じ結果になるようにする。
const local = (y: number, m: number, d: number, h: number, min: number, s: number) =>
  new Date(y, m - 1, d, h, min, s);

describe("pastedImageFilename", () => {
  it("MIME type ごとの拡張子で image-YYYYMMDD-HHMMSS.<ext> にする", () => {
    const at = local(2026, 9, 17, 14, 30, 45);
    expect(pastedImageFilename(at, "image/png")).toBe("image-20260917-143045.png");
    expect(pastedImageFilename(at, "image/jpeg")).toBe("image-20260917-143045.jpg");
    expect(pastedImageFilename(at, "image/gif")).toBe("image-20260917-143045.gif");
    expect(pastedImageFilename(at, "image/webp")).toBe("image-20260917-143045.webp");
  });

  it("画像でない MIME type は null（既定の貼り付けへ譲る）", () => {
    expect(pastedImageFilename(local(2026, 9, 17, 14, 30, 45), "text/plain")).toBeNull();
    expect(pastedImageFilename(local(2026, 9, 17, 14, 30, 45), "image/svg+xml")).toBeNull();
  });

  it("月・日・時・分・秒を 0 埋めする", () => {
    expect(pastedImageFilename(local(2026, 1, 2, 3, 4, 5), "image/png")).toBe(
      "image-20260102-030405.png",
    );
  });
});
