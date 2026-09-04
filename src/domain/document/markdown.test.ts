import { describe, expect, it } from "vitest";
import { extractHeadings, HEADING_ID_PREFIX, renderMarkdown } from "./markdown";

describe("renderMarkdown — 見出しレベル（U-020）", () => {
  it("本文の # を H1 のまま描画する", () => {
    const { html } = renderMarkdown("# Title\n\n## Section\n");
    expect(html).toContain("<h1");
    expect(html).toContain("<h2");
    // 降格していないこと
    expect(html).not.toMatch(/<h2[^>]*>Title/);
  });

  it("見出しに id を振る", () => {
    const { html } = renderMarkdown("## Hello World\n");
    expect(html).toContain(`id="${HEADING_ID_PREFIX}hello-world"`);
  });

  it("同名の見出しで id が衝突しない", () => {
    const { html } = renderMarkdown("## A\n\n## A\n");
    expect(html).toContain(`id="${HEADING_ID_PREFIX}a"`);
    expect(html).toContain(`id="${HEADING_ID_PREFIX}a-1"`);
  });
});

describe("renderMarkdown — GFM", () => {
  it("テーブルを描画する", () => {
    const { html } = renderMarkdown("| a | b |\n| --- | --- |\n| 1 | 2 |\n");
    expect(html).toContain("<table>");
    expect(html).toContain("<th>a</th>");
  });

  it("打ち消し線とタスクリストを描画する", () => {
    const { html } = renderMarkdown("~~gone~~\n\n- [x] done\n");
    expect(html).toContain("<del>gone</del>");
    expect(html).toContain('type="checkbox"');
  });

  it("コードフェンスを描画する", () => {
    const { html } = renderMarkdown("```js\nconst a = 1;\n```\n");
    expect(html).toContain("<pre>");
    expect(html).toContain("const a = 1;");
  });
});

describe("renderMarkdown — security（U-023）", () => {
  it("script を除去する", () => {
    const { html } = renderMarkdown('<script>alert(1)</script>\n\ntext\n');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(1)");
  });

  it("on* 属性を除去する", () => {
    const { html } = renderMarkdown('<img src="x" onerror="alert(1)">\n');
    expect(html).not.toContain("onerror");
  });

  it("javascript: リンクを許可しない", () => {
    const { html } = renderMarkdown("[click](javascript:alert(1))\n");
    expect(html).not.toContain("javascript:alert");
  });

  it("外部画像を読み込まない", () => {
    const { html } = renderMarkdown("![alt](https://example.com/a.png)\n");
    expect(html).not.toContain("https://example.com/a.png");
    expect(html).toContain('alt="alt"');
  });
});

describe("renderMarkdown — links と images", () => {
  it("外部リンクへ印を付ける", () => {
    const { html } = renderMarkdown("[x](https://example.com)\n");
    expect(html).toContain('data-link="external"');
    expect(html).toContain('href="https://example.com"');
  });

  it("相対 .md リンクへ印を付ける", () => {
    const { html } = renderMarkdown("[x](./other.md)\n");
    expect(html).toContain('data-link="document"');
  });

  it("相対画像を asset URL へ変換する", () => {
    const { html } = renderMarkdown("![a](images/a.png)\n", {
      baseDir: "/notes",
      resolveAsset: (p) => `asset://${p}`,
    });
    expect(html).toContain('src="asset:///notes/images/a.png"');
  });

  it("baseDir がなければ画像パスを触らない", () => {
    const { html } = renderMarkdown("![a](images/a.png)\n");
    expect(html).toContain('src="images/a.png"');
  });
});

describe("extractHeadings", () => {
  it("レベルとオフセットを返す", () => {
    const body = "# A\n\ntext\n\n### C\n";
    const headings = extractHeadings(body);
    expect(headings.map((h) => [h.level, h.text])).toEqual([
      [1, "A"],
      [3, "C"],
    ]);
    expect(headings[1]!.offset).toBe(body.indexOf("### C"));
  });

  it("見出しがなければ空", () => {
    expect(extractHeadings("just text\n")).toEqual([]);
  });

  it("コードフェンス内の # を見出しにしない", () => {
    expect(extractHeadings("```\n# not a heading\n```\n")).toEqual([]);
  });
});
