/**
 * Markdown → Preview HTML と TOC。
 *
 * .specs/product/requirements.md §3.3 / U-023 / U-020。
 *
 * - CommonMark + GFM（table / task list / strikethrough）
 * - 本文の `#` は H1 のまま。降格しない（U-020）
 * - raw HTML は sanitize（U-023）
 * - Fenced code block は言語が明示されているときだけ highlight する（ADR-009）
 * - 外部リンクは WebView 内で遷移させない。クリックは UI 側で捌けるよう印を付ける
 * - 相対画像は asset URL へ変換する
 */

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";
import { visit } from "unist-util-visit";
import { toString as mdastToString } from "mdast-util-to-string";
import type { Root as MdastRoot } from "mdast";
import type { Root as HastRoot, Element } from "hast";

export interface Heading {
  /** 1–6。本文の見出しレベルそのまま。 */
  level: number;
  text: string;
  id: string;
  /** 本文（Front Matter を除いた文字列）内での開始オフセット。 */
  offset: number;
}

export interface RenderOptions {
  /** 相対パスの解決に使うディレクトリ。指定がなければ画像を変換しない。 */
  baseDir?: string;
  /** 相対パスを表示可能な URL へ変換する。Tauri では convertFileSrc。 */
  resolveAsset?: (absolutePath: string) => string;
  /**
   * トップレベルの要素へ `data-source-line` を振る（ADR-012）。
   *
   * Split の scroll 同期がこれを行の対応表として使う。
   * 画面表示のためだけの印なので、書き出し HTML では付けない。既定は false。
   */
  sourceLines?: boolean;
}

export interface RenderResult {
  html: string;
  headings: Heading[];
}

const EXTERNAL = /^(https?:)?\/\//i;
const PROTOCOL = /^[a-z][a-z0-9+.-]*:/i;

/** 見出しテキストから id を作る。重複時は連番を足す。 */
function slugger() {
  const seen = new Map<string, number>();
  return (text: string): string => {
    const base =
      text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, "")
        .trim()
        .replace(/\s+/g, "-") || "section";
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
  };
}

/** 見出しを AST から拾う。TOC はこれを使う。 */
export function extractHeadings(body: string): Heading[] {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(body) as MdastRoot;
  const slug = slugger();
  const headings: Heading[] = [];

  visit(tree, "heading", (node) => {
    const text = mdastToString(node).trim();
    if (!text) return;
    headings.push({
      level: node.depth,
      text,
      id: slug(text),
      offset: node.position?.start.offset ?? 0,
    });
  });

  return headings;
}

function joinPath(baseDir: string, relative: string): string {
  const sep = baseDir.includes("\\") ? "\\" : "/";
  const normalized = relative.replace(/\//g, sep);
  return `${baseDir.replace(/[\\/]$/, "")}${sep}${normalized}`;
}

/**
 * リンクと画像へ印を付ける。
 *
 * ここでは遷移させない。href は残したまま data 属性で種別を伝え、
 * 実際の挙動は Preview コンポーネントの click ハンドラが決める（U-023）。
 */
function decorateLinksAndImages(options: RenderOptions) {
  return (tree: HastRoot) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName === "a") {
        const href = typeof node.properties?.href === "string" ? node.properties.href : "";
        if (!href) return;
        if (EXTERNAL.test(href) || /^mailto:/i.test(href)) {
          node.properties = { ...node.properties, dataLink: "external" };
        } else if (PROTOCOL.test(href)) {
          // file: など。開かない（U-023）。
          node.properties = { ...node.properties, dataLink: "blocked" };
        } else if (/\.(md|markdown)(#.*)?$/i.test(href)) {
          node.properties = { ...node.properties, dataLink: "document" };
        } else if (href.startsWith("#")) {
          node.properties = { ...node.properties, dataLink: "anchor" };
        } else {
          node.properties = { ...node.properties, dataLink: "blocked" };
        }
        return;
      }

      if (node.tagName === "img") {
        const src = typeof node.properties?.src === "string" ? node.properties.src : "";
        if (!src) return;
        if (EXTERNAL.test(src) || PROTOCOL.test(src)) {
          // 外部画像は読み込まない（U-023）。src を落として alt を残す。
          const { src: _drop, ...rest } = node.properties ?? {};
          node.properties = { ...rest, dataImage: "blocked" };
          return;
        }
        if (options.baseDir && options.resolveAsset) {
          node.properties = {
            ...node.properties,
            src: options.resolveAsset(joinPath(options.baseDir, src)),
          };
        }
      }
    });
  };
}

/**
 * トップレベルの要素へ、対応する本文の行番号を振る（ADR-012）。
 *
 * 入れ子まで振らないのは、scroll 同期に必要なのが「画面の縦位置と行の対応」だけで、
 * 段落の内側の行まで分かっても精度が上がらないため。属性も少なくて済む。
 */
export const SOURCE_LINE_ATTR = "data-source-line";

function addSourceLines() {
  return (tree: HastRoot) => {
    for (const node of tree.children) {
      if (node.type !== "element") continue;
      const line = node.position?.start.line;
      if (line == null) continue;
      node.properties = { ...node.properties, dataSourceLine: String(line) };
    }
  };
}

/** 見出しへ id を振る。TOC からの移動に使う。 */
function addHeadingIds() {
  return (tree: HastRoot) => {
    const slug = slugger();
    visit(tree, "element", (node: Element) => {
      if (!/^h[1-6]$/.test(node.tagName)) return;
      const text = hastText(node).trim();
      if (!text) return;
      node.properties = { ...node.properties, id: slug(text) };
    });
  };
}

function hastText(node: Element): string {
  let out = "";
  visit(node, "text", (t: { value: string }) => {
    out += t.value;
  });
  return out;
}

// sanitize schema。GitHub 相当に、見出し id とコードの言語クラス、
// リンク種別の data 属性を足す。script と on* は既定で落ちる。
const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    "*": [
      ...(defaultSchema.attributes?.["*"] ?? []),
      "id",
      "className",
      // ADR-012。値は数字だけ（addSourceLines が付ける）。
      "dataSourceLine",
    ],
    a: [...(defaultSchema.attributes?.a ?? []), "dataLink"],
    img: [...(defaultSchema.attributes?.img ?? []), "dataImage"],
    input: [...(defaultSchema.attributes?.input ?? []), "checked", "disabled", "type"],
  },
  protocols: {
    ...defaultSchema.protocols,
    // Tauri の asset protocol。Windows では http://asset.localhost へ解決される。
    src: [...(defaultSchema.protocols?.src ?? []), "asset"],
  },
};

/**
 * sanitize が付ける id の prefix。
 *
 * DOM clobbering 対策として既定のまま残す。TOC から見出しへ飛ぶときは
 * この prefix を付けて参照する。
 */
export const HEADING_ID_PREFIX = "user-content-";

export function renderMarkdown(body: string, options: RenderOptions = {}): RenderResult {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(addHeadingIds)
    .use(decorateLinksAndImages, options);

  if (options.sourceLines) processor.use(addSourceLines);

  const file = processor
    .use(rehypeSanitize, schema)
    // Sanitize の**後**に走らせる。highlight が読むのは sanitize 済みの text だけになり、
    // 生成される span も自前のものだけになる。
    .use(rehypeHighlight, {
      // 言語指定のない fence は推定しない。外すと散文や擬似コードにも色が付く。
      detect: false,
      // 未登録の言語は素のまま出す（例外にしない）。
      plainText: ["text", "plain", "txt"],
    })
    .use(rehypeStringify)
    .processSync(body);

  return { html: String(file), headings: extractHeadings(body) };
}
