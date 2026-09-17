import { describe, expect, it } from "vitest";
import { linkForPaste } from "./link-paste";

describe("linkForPaste", () => {
  it("選択文字と URL から Markdown リンクを組み立てる", () => {
    expect(linkForPaste("foo", "https://a.b/c")).toBe("[foo](https://a.b/c)");
  });

  it("URL の前後の空白は落とす", () => {
    expect(linkForPaste("foo", "  https://a.b/c\n")).toBe("[foo](https://a.b/c)");
  });

  it("http:// も受ける", () => {
    expect(linkForPaste("foo", "http://a.b")).toBe("[foo](http://a.b)");
  });

  it("http(s) 以外のスキームはリンク化しない", () => {
    expect(linkForPaste("foo", "ftp://x")).toBeNull();
  });

  it("URL に説明文が付いていればリンク化しない", () => {
    expect(linkForPaste("foo", "see https://a.b")).toBeNull();
  });

  it("URL が 2 本あればリンク化しない", () => {
    expect(linkForPaste("foo", "https://a.b\nhttps://c.d")).toBeNull();
  });

  it("選択が空ならリンク化しない", () => {
    expect(linkForPaste("", "https://a.b")).toBeNull();
  });

  it("複数行の選択はリンク化しない", () => {
    expect(linkForPaste("foo\nbar", "https://a.b")).toBeNull();
  });

  it("空白だけの選択はリンク化しない", () => {
    expect(linkForPaste("   ", "https://a.b")).toBeNull();
  });

  it("選択文字の [ ] はエスケープする", () => {
    expect(linkForPaste("a]b", "https://a.b")).toBe("[a\\]b](https://a.b)");
    expect(linkForPaste("[x]", "https://a.b")).toBe("[\\[x\\]](https://a.b)");
  });

  it("括弧を含む URL は <> で包む", () => {
    expect(linkForPaste("foo", "https://a.b/x_(y)")).toBe("[foo](<https://a.b/x_(y)>)");
  });
});
