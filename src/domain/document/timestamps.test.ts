import { describe, expect, it } from "vitest";
import { formatCreatedAt } from "./timestamps";

// ローカル時刻の成分から Date を組み、タイムゾーンに依らず同じ結果になるようにする。
const local = (y: number, m: number, d: number, h: number, min: number) =>
  new Date(y, m - 1, d, h, min).getTime();

describe("formatCreatedAt", () => {
  it("yyyy-mm-dd hh:mm のローカル時刻にする", () => {
    expect(formatCreatedAt(local(2026, 9, 17, 14, 5))).toBe("2026-09-17 14:05");
  });

  it("月・日・時・分を 0 埋めする", () => {
    expect(formatCreatedAt(local(2026, 1, 2, 3, 4))).toBe("2026-01-02 03:04");
  });

  it("24 時間制で、午後を 12 時間制に丸めない", () => {
    expect(formatCreatedAt(local(2026, 12, 31, 23, 59))).toBe("2026-12-31 23:59");
    expect(formatCreatedAt(local(2026, 12, 31, 0, 0))).toBe("2026-12-31 00:00");
  });
});
