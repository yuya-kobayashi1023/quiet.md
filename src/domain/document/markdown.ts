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
 * - 画面専用の印（`data-source-line`、コードのコピーボタン）は option で付け、既定では出さない
 */

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";
import { SKIP, visit } from "unist-util-visit";
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
  /**
   * コードブロックへコピーボタンを付ける。
   *
   * 画面で押すためだけの部品なので、紙面（PDF）と書き出し HTML では付けない。既定は false。
   */
  copyButtons?: boolean;
}

export interface RenderResult {
  html: string;
  headings: Heading[];
}

const EXTERNAL = /^(https?:)?\/\//i;
const PROTOCOL = /^[a-z][a-z0-9+.-]*:/i;

/**
 * CJK と見なす範囲。
 *
 * 日本語の本文で改行を挟みうる文字はこの中に収まる。範囲は順に:
 *
 * - U+2E80–U+303F  CJK 部首補助・康熙部首・記号と句読点（「」。、 など）
 * - U+3040–U+30FF  ひらがな・カタカナ
 * - U+3400–U+4DBF  漢字 拡張 A
 * - U+4E00–U+9FFF  漢字
 * - U+F900–U+FAFF  互換漢字
 * - U+FF00–U+FFEF  半角・全角形（＃ ｜ など）
 */
const CJK =
  /[⺀-〿぀-ヿ㐀-䶿一-鿿豈-﫿＀-￯]/;

/** 文字を拾うためだけの、mdast の構造の当たり。 */
interface TextLike {
  type: string;
  value?: string;
  children?: TextLike[];
}

/** その節点が描画する最後の 1 文字。持たなければ undefined。 */
function lastCharOf(node: TextLike | undefined): string | undefined {
  if (!node || node.type === "break") return undefined;
  if (typeof node.value === "string") return node.value.slice(-1) || undefined;
  const children = node.children;
  if (!children) return undefined;
  for (let i = children.length - 1; i >= 0; i--) {
    const char = lastCharOf(children[i]);
    if (char) return char;
  }
  return undefined;
}

/** その節点が描画する最初の 1 文字。持たなければ undefined。 */
function firstCharOf(node: TextLike | undefined): string | undefined {
  if (!node || node.type === "break") return undefined;
  if (typeof node.value === "string") return node.value.slice(0, 1) || undefined;
  const children = node.children;
  if (!children) return undefined;
  for (const child of children) {
    const char = firstCharOf(child);
    if (char) return char;
  }
  return undefined;
}

/**
 * CJK 同士に挟まれた soft break を、空白を残さずに詰める（ADR-017）。
 *
 * Markdown では段落内の改行は空白 1 つとして描画される。英文ではそれが語の区切りとして
 * 正しいが、日本語では語の間に不要な空きが入る。「1 文 1 行」で書くと表示が崩れるので、
 * 日本語では 1 段落を 1 行の長文で書くしかなくなり、書き方の選択肢が 1 つ潰れていた。
 *
 * **これは Markdown 方言の追加ではなく、描画時の CJK 組版**として入れている。
 * ファイルの中身は CommonMark のまま一切変えない（principles.md §5）。
 * 両側が CJK のときだけ詰めるので、英文の語間の空白はそのまま残る。
 *
 * 行末が inline 要素で切れている場合（`日本語\n**強調**` など）も同じ扱いにするため、
 * 節点をまたいで前後の 1 文字を見る。
 */
function compactCjkLineBreaks() {
  return (tree: MdastRoot) => {
    visit(tree, (node) => {
      const children = (node as unknown as TextLike).children;
      if (!children) return;

      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (!child || child.type !== "text" || typeof child.value !== "string") continue;
        if (!child.value.includes("\n")) continue;

        // 節点の端に来た改行は、隣の節点の文字と突き合わせる。
        const beforeNode = lastCharOf(children[i - 1]);
        const afterNode = firstCharOf(children[i + 1]);

        child.value = child.value.replace(/\n/g, (_match, offset: number, whole: string) => {
          const left = offset > 0 ? whole[offset - 1] : beforeNode;
          const right = offset + 1 < whole.length ? whole[offset + 1] : afterNode;
          if (!left || !right) return "\n";
          return CJK.test(left) && CJK.test(right) ? "" : "\n";
        });
      }
    });
  };
}

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

/**
 * `baseDir` からの相対パスを絶対パスにする。
 *
 * `..` はここで畳む。asset protocol は `..` を含むパスをスコープ外として弾くので、
 * サブフォルダのノートから `../assets/x.png` を参照したときに表示されなくなる。
 */
function joinPath(baseDir: string, relative: string): string {
  const sep = baseDir.includes("\\") ? "\\" : "/";
  const segments = baseDir.replace(/[\\/]$/, "").split(/[\\/]/);
  for (const part of relative.split("/")) {
    if (part === "..") {
      if (segments.length > 1) segments.pop();
    } else if (part !== "." && part !== "") {
      segments.push(part);
    }
  }
  return segments.join(sep);
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

/**
 * タスクリストのチェックボックスへ、そのリスト項目の行番号を振り、`disabled` を外す。
 *
 * Preview のクリックで本文の `[ ]` を反転させるために、どの行を書き換えるかを DOM に持たせる。
 * `data-source-line` と分けているのは、scroll 同期があの属性をトップレベルの対応表として
 * 総なめするため（ADR-012）。入れ子の li にまで振ると対応表が汚れる。
 * 書き出し HTML に残っても害はないので、sourceLines の指定に関わらず常に付ける。
 */
export const TASK_LINE_ATTR = "data-task-line";

/**
 * remark-gfm はチェックボックスを li の先頭か、li の先頭の p の先頭に置く。
 * loose なリストでは p の前に改行の text が挟まるので、空白だけの text は読み飛ばす。
 */
function taskCheckboxOf(li: Element): Element | undefined {
  const head = li.children.find(
    (child) => !(child.type === "text" && child.value.trim() === ""),
  );
  if (head?.type !== "element") return undefined;
  if (head.tagName === "p") return taskCheckboxOf(head);
  return head.tagName === "input" && head.properties?.type === "checkbox" ? head : undefined;
}

function markTaskLines() {
  return (tree: HastRoot) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "li") return;
      const line = node.position?.start.line;
      const input = taskCheckboxOf(node);
      if (line == null || !input) return;
      const { disabled: _drop, ...rest } = input.properties ?? {};
      input.properties = { ...rest, dataTaskLine: String(line) };
    });
  };
}

/**
 * fence の言語を `<pre data-language>` に写す。
 *
 * 紙面（print.css）がコードブロックの隅に言語名を出すのに使う（ADR-021）。
 * 値は sanitize が通した `language-*` クラスから取るので、書き手の入力そのままではない。
 */
function markCodeLanguage() {
  return (tree: HastRoot) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "pre") return;
      const code = node.children.find(
        (child): child is Element => child.type === "element" && child.tagName === "code",
      );
      const classes = code?.properties?.className;
      const language = (Array.isArray(classes) ? classes : [])
        .map(String)
        .find((name) => name.startsWith("language-"))
        ?.slice("language-".length);
      if (!language) return;
      node.properties = { ...node.properties, dataLanguage: language };
    });
  };
}

/** コードブロックを包む要素の class。ボタンはこの中で絶対配置する。 */
export const CODE_BLOCK_CLASS = "code-block";
/** コピーボタンの class。Preview の click ハンドラがこれで拾う。 */
export const COPY_BUTTON_CLASS = "code-copy";

/** 16px 格子の線画。形は icons.tsx の CopyIcon / CheckIcon と同じ。 */
function icon(name: "copy" | "check", shapes: Element[]): Element {
  return {
    type: "element",
    tagName: "svg",
    properties: { viewBox: "0 0 16 16", ariaHidden: "true", dataIcon: name },
    children: shapes,
  };
}

function copyIcon(): Element {
  return icon("copy", [
    {
      type: "element",
      tagName: "rect",
      properties: { x: "5.5", y: "5.5", width: "8", height: "8", rx: "1" },
      children: [],
    },
    { type: "element", tagName: "path", properties: { d: "M3.5 10.5v-7h7" }, children: [] },
  ]);
}

function checkIcon(): Element {
  return icon("check", [
    { type: "element", tagName: "path", properties: { d: "m3.5 8.5 3 3 6-7" }, children: [] },
  ]);
}

/**
 * `<pre><code>` を `<div class="code-block">` で包み、末尾にコピーボタンを置く。
 *
 * ボタンを `pre` の中に置かないのは、`pre` が横スクロールする箱だから。
 * 中に置くと絶対配置でも内容と一緒に流れて、長い行では右上から消える。
 * 包む側に置けば、`pre` がどれだけスクロールしても隅に留まる。
 *
 * sanitize の**後**に走らせる。書き手の HTML に同じ形があっても、ここで作るものだけが
 * ボタンになり、逆に sanitize がボタンを剥がすこともない。
 */
function addCopyButtons() {
  return (tree: HastRoot) => {
    visit(tree, "element", (node: Element, index, parent) => {
      if (node.tagName !== "pre" || index == null || !parent) return;
      const hasCode = node.children.some(
        (child) => child.type === "element" && child.tagName === "code",
      );
      if (!hasCode) return;

      const button: Element = {
        type: "element",
        tagName: "button",
        properties: { type: "button", className: [COPY_BUTTON_CLASS], ariaLabel: "コードをコピー" },
        children: [copyIcon(), checkIcon()],
      };
      parent.children[index] = {
        type: "element",
        tagName: "div",
        properties: { className: [CODE_BLOCK_CLASS] },
        children: [node, button],
      };
      return SKIP;
    });
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
    // dataTaskLine の値は数字だけ（markTaskLines が付ける）。
    input: [...(defaultSchema.attributes?.input ?? []), "checked", "type", "dataTaskLine"],
  },
  required: {
    ...defaultSchema.required,
    // 既定は input へ disabled を必ず付け直す。Preview でクリックさせるので外す。
    input: { type: "checkbox" },
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
    // HTML へ変換する前に、mdast の段階で改行を詰める（ADR-017）。
    .use(compactCjkLineBreaks)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(addHeadingIds)
    .use(decorateLinksAndImages, options)
    .use(markTaskLines);

  if (options.sourceLines) processor.use(addSourceLines);

  processor
    .use(rehypeSanitize, schema)
    // Sanitize の**後**に走らせる。highlight が読むのは sanitize 済みの text だけになり、
    // 生成される span も自前のものだけになる。
    .use(rehypeHighlight, {
      // 言語指定のない fence は推定しない。外すと散文や擬似コードにも色が付く。
      detect: false,
      // 未登録の言語は素のまま出す（例外にしない）。
      plainText: ["text", "plain", "txt"],
    })
    .use(markCodeLanguage);

  if (options.copyButtons) processor.use(addCopyButtons);

  const file = processor.use(rehypeStringify).processSync(body);

  return { html: String(file), headings: extractHeadings(body) };
}
