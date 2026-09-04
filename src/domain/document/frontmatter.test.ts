import { describe, expect, it } from "vitest";
import {
  addFrontmatter,
  detectFrontmatter,
  parseFrontmatter,
  patchField,
  replaceFrontmatter,
} from "./frontmatter";

const SAMPLE = `---
title: Designing quieter software
tags:
  - design
  - editor
status: draft
created: 2026-09-04
custom:
  # important
  value: "001"
---

# Body

text
`;

describe("detectFrontmatter", () => {
  it("Front Matter がない文書をそのまま返す", () => {
    const slice = detectFrontmatter("# Hello\n");
    expect(slice.raw).toBeNull();
    expect(slice.body).toBe("# Hello\n");
  });

  it("1 行目が --- でなければ Front Matter として扱わない", () => {
    const slice = detectFrontmatter("\n---\ntitle: x\n---\n");
    expect(slice.raw).toBeNull();
  });

  it("閉じフェンスがなければ Front Matter として扱わない", () => {
    const slice = detectFrontmatter("---\ntitle: x\n");
    expect(slice.raw).toBeNull();
  });

  it("--- で閉じた Front Matter を切り出す", () => {
    const slice = detectFrontmatter(SAMPLE);
    expect(slice.raw).toContain("title: Designing quieter software");
    expect(slice.body.trimStart().startsWith("# Body")).toBe(true);
  });

  it("... で閉じた Front Matter も認識する", () => {
    const slice = detectFrontmatter("---\ntitle: x\n...\nbody\n");
    expect(slice.raw).toBe("title: x");
    expect(slice.body).toBe("body\n");
  });

  it("本文中の --- を終端と誤認しない", () => {
    const slice = detectFrontmatter("---\ntitle: x\n---\na\n\n---\n\nb\n");
    expect(slice.raw).toBe("title: x");
    expect(slice.body).toBe("a\n\n---\n\nb\n");
  });
});

describe("parseFrontmatter", () => {
  it("既知フィールドを読む", () => {
    const { fields, fieldCount, error } = parseFrontmatter(detectFrontmatter(SAMPLE).raw);
    expect(error).toBeNull();
    expect(fields.title).toBe("Designing quieter software");
    expect(fields.tags).toEqual(["design", "editor"]);
    expect(fields.status).toBe("draft");
    expect(fields.created).toBe("2026-09-04");
    expect(fieldCount).toBe(5);
  });

  it("flow 記法の配列も読む", () => {
    const { fields } = parseFrontmatter("tags: [a, b]");
    expect(fields.tags).toEqual(["a", "b"]);
  });

  it("壊れた YAML はエラーを返し、値を捏造しない", () => {
    const result = parseFrontmatter("title: [unclosed");
    expect(result.error).not.toBeNull();
    expect(result.fields).toEqual({});
  });
});

describe("patchField — lossless", () => {
  it("未知キー・コメント・引用符を保持する", () => {
    const raw = detectFrontmatter(SAMPLE).raw!;
    const next = patchField(raw, "status", "published");

    expect(next).toContain("status: published");
    // 未知キーとそのコメント、引用符付きの値が残っている
    expect(next).toContain("custom:");
    expect(next).toContain("# important");
    expect(next).toContain('value: "001"');
  });

  it("キー順を変えない", () => {
    const raw = detectFrontmatter(SAMPLE).raw!;
    const next = patchField(raw, "title", "Another title");
    const keys = next
      .split("\n")
      .filter((l) => /^[A-Za-z]/.test(l))
      .map((l) => l.split(":")[0]);
    expect(keys).toEqual(["title", "tags", "status", "created", "custom"]);
  });

  it("触っていない行を 1 文字も変えない", () => {
    const raw = detectFrontmatter(SAMPLE).raw!;
    const next = patchField(raw, "status", "published");
    const before = raw.split("\n").filter((l) => !l.startsWith("status:"));
    const after = next.split("\n").filter((l) => !l.startsWith("status:"));
    expect(after).toEqual(before);
  });

  it("block 配列を block のまま更新する", () => {
    const raw = detectFrontmatter(SAMPLE).raw!;
    const next = patchField(raw, "tags", ["design", "editor", "spec"]);
    expect(next).toContain("tags:\n  - design\n  - editor\n  - spec");
  });

  it("flow 配列を flow のまま更新する", () => {
    const next = patchField("tags: [a, b]", "tags", ["a", "b", "c"]);
    expect(next).toBe("tags: [a, b, c]");
  });

  it("存在しないキーは末尾へ追加する", () => {
    const next = patchField("title: x", "status", "draft");
    expect(next).toBe("title: x\nstatus: draft");
  });

  it("引用が必要な値を安全に書く", () => {
    const next = patchField("title: x", "title", "a: b");
    expect(parseFrontmatter(next).fields.title).toBe("a: b");
  });

  it("壊れた YAML を勝手に直さない（U-017）", () => {
    const broken = "title: [unclosed";
    expect(patchField(broken, "status", "draft")).toBe(broken);
  });
});

describe("replaceFrontmatter", () => {
  it("本文へ触らずに Front Matter だけ差し替える", () => {
    const next = replaceFrontmatter(SAMPLE, "title: new");
    expect(next.startsWith("---\ntitle: new\n---\n")).toBe(true);
    expect(next).toContain("# Body");
    expect(next).not.toContain("custom:");
  });
});

describe("addFrontmatter", () => {
  it("Front Matter がない文書にだけ追加する（U-018）", () => {
    const next = addFrontmatter("# Hello\n");
    expect(next.startsWith("---\n")).toBe(true);
    expect(next).toContain("# Hello");
    // 既にある場合は何もしない
    expect(addFrontmatter(SAMPLE)).toBe(SAMPLE);
  });
});
