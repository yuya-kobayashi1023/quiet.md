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
    // highlight で span に割れるため、素の文字列としては残らない。
    expect(html).toContain("const");
    expect(html).toContain("a = ");
  });
});

describe("renderMarkdown — code highlight（ADR-009）", () => {
  it("言語指定のある fence を highlight する", () => {
    const { html } = renderMarkdown("```js\nconst a = 1;\n```\n");
    expect(html).toContain('class="hljs language-js"');
    expect(html).toContain('<span class="hljs-keyword">const</span>');
    expect(html).toContain('<span class="hljs-number">1</span>');
  });

  it("言語指定のない fence は色を付けない", () => {
    const { html } = renderMarkdown("```\nconst a = 1;\n```\n");
    expect(html).not.toContain("hljs");
    expect(html).toContain("const a = 1;");
  });

  it("text 指定の fence は色を付けない", () => {
    const { html } = renderMarkdown("```text\nconst a = 1;\n```\n");
    expect(html).not.toContain("hljs-");
    expect(html).toContain("const a = 1;");
  });

  it("未登録の言語でも例外にせず素のまま出す", () => {
    const { html } = renderMarkdown("```zzz-not-a-language\nhello\n```\n");
    expect(html).toContain("hello");
    expect(html).not.toContain("hljs-");
  });

  it("inline code は highlight の対象にしない", () => {
    const { html } = renderMarkdown("`const a = 1;`\n");
    expect(html).toContain("<code>const a = 1;</code>");
  });

  it("highlight の後でも script は復活しない（U-023）", () => {
    const { html } = renderMarkdown(
      "```html\n<script>alert(1)</script>\n```\n",
    );
    // fence の中身は escape されたまま span に包まれるだけ。実行される形にはならない。
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("</script>");
    expect(html).toContain("&#x3C;");
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

describe("renderMarkdown — source lines（ADR-012）", () => {
  const body = "# Title\n\npara one\n\n```js\nconst a = 1;\n```\n\npara two\n";

  it("既定では付けない（書き出し HTML に混ぜない）", () => {
    const { html } = renderMarkdown(body);
    expect(html).not.toContain("data-source-line");
  });

  it("トップレベルの要素へ本文の行番号を振る", () => {
    const { html } = renderMarkdown(body, { sourceLines: true });
    expect(html).toContain('<h1 id="user-content-title" data-source-line="1">');
    expect(html).toContain('<p data-source-line="3">');
    expect(html).toContain('<pre data-source-line="5">');
    expect(html).toContain('<p data-source-line="9">');
  });

  it("入れ子の要素には振らない", () => {
    const { html } = renderMarkdown("- a\n- b\n", { sourceLines: true });
    expect(html).toContain('<ul data-source-line="1">');
    expect(html).not.toContain("<li data-source-line");
  });

  it("行番号は昇順に並ぶ", () => {
    const { html } = renderMarkdown(body, { sourceLines: true });
    const lines = [...html.matchAll(/data-source-line="(\d+)"/g)].map((m) => Number(m[1]));
    expect(lines.length).toBeGreaterThan(1);
    expect([...lines].sort((a, b) => a - b)).toEqual(lines);
  });

  it("sanitize を通っても残る", () => {
    const { html } = renderMarkdown("para\n", { sourceLines: true });
    // schema の attributes["*"] に dataSourceLine を足していないと、ここで消える。
    expect(html).toContain('data-source-line="1"');
  });
});

describe("renderMarkdown — CJK の改行（ADR-017）", () => {
  it("CJK 同士の改行は空白を残さず詰める", () => {
    const { html } = renderMarkdown("日本語の文で\n次の行です\n");
    expect(html).toContain("<p>日本語の文で次の行です</p>");
  });

  it("句読点や鍵括弧をまたいでも詰める", () => {
    const { html } = renderMarkdown("ここまでです。\n「次の行」から続く\n");
    expect(html).toContain("<p>ここまでです。「次の行」から続く</p>");
  });

  it("英文の語間の改行は空白のまま残す", () => {
    const { html } = renderMarkdown("first line\nsecond line\n");
    expect(html).toContain("first line\nsecond line");
  });

  it("CJK と英単語の間は空白のまま残す", () => {
    // ここで詰めると単語がくっつく。片側が CJK でないときは触らない。
    const { html } = renderMarkdown("日本語\nEnglish\n");
    expect(html).toContain("日本語\nEnglish");
    const reverse = renderMarkdown("English\n日本語\n");
    expect(reverse.html).toContain("English\n日本語");
  });

  it("inline 要素をまたぐ改行も詰める", () => {
    // 行末が強調で切れていても、書き手から見た改行の意味は変わらない。
    const { html } = renderMarkdown("日本語の文で\n**強調**が続く\n");
    expect(html).toContain("<p>日本語の文で<strong>強調</strong>が続く</p>");
  });

  it("hard break（行末 2 スペース）は改行のまま残す", () => {
    const { html } = renderMarkdown("日本語  \n次の行\n");
    expect(html).toContain("<br>");
    expect(html).not.toContain("<p>日本語次の行</p>");
  });

  it("段落の区切りは変えない", () => {
    const { html } = renderMarkdown("一段落目\n\n二段落目\n");
    expect(html).toContain("<p>一段落目</p>");
    expect(html).toContain("<p>二段落目</p>");
  });

  it("コードブロックの中は詰めない", () => {
    const { html } = renderMarkdown("```\n日本語\n次の行\n```\n");
    expect(html).toContain("日本語\n次の行");
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
