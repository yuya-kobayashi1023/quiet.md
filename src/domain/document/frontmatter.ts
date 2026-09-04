/**
 * YAML Front Matter。
 *
 * .specs/domain/frontmatter.md の lossless 要件（§6）が最優先。
 * Fields を触っただけで、未知キー・キー順・コメント・引用符を失ってはいけない。
 *
 * そのため、Fields 編集は「Document 全体の再 serialize」ではなく
 * **対象ノードの範囲だけを文字列置換する**方式で実装している（§7）。
 */

import { parseDocument, isMap, isSeq, isScalar, stringify } from "yaml";
import type { Node, Pair } from "yaml";

export const KNOWN_FIELDS = ["title", "tags", "status", "created"] as const;
export type KnownField = (typeof KNOWN_FIELDS)[number];

export interface FrontmatterSlice {
  /** Front Matter がある場合、フェンスの内側の YAML。 */
  raw: string | null;
  /** 本文（Front Matter を除いた Markdown）。 */
  body: string;
  /** 本文が全文のどこから始まるか。 */
  bodyOffset: number;
}

export interface FrontmatterFields {
  title?: string;
  tags?: string[];
  status?: string;
  created?: string;
}

export interface ParsedFrontmatter {
  fields: FrontmatterFields;
  /** 既知キーを含む、全キーの数。summary の `N fields` に使う。 */
  fieldCount: number;
  /** parse に失敗した場合のメッセージ。null なら valid。 */
  error: string | null;
}

const FENCE = /^---[ \t]*\r?\n/;

/**
 * Front Matter を検出する。
 *
 * 1 行目が厳密に `---` の場合だけ開始とみなす（§2）。
 * 終端は `---` または `...`。
 */
export function detectFrontmatter(text: string): FrontmatterSlice {
  if (!FENCE.test(text)) {
    return { raw: null, body: text, bodyOffset: 0 };
  }

  const firstBreak = text.indexOf("\n");
  const lines = text.slice(firstBreak + 1).split("\n");

  let consumed = firstBreak + 1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const trimmed = line.replace(/\r$/, "");
    if (trimmed === "---" || trimmed === "...") {
      const raw = lines.slice(0, i).join("\n").replace(/\r$/, "");
      const bodyOffset = consumed + line.length + 1;
      return {
        raw,
        body: text.slice(Math.min(bodyOffset, text.length)),
        bodyOffset,
      };
    }
    consumed += line.length + 1;
  }

  // 閉じフェンスがない。Front Matter とみなさず、全体を本文として扱う。
  return { raw: null, body: text, bodyOffset: 0 };
}

function scalarString(node: unknown): string | undefined {
  if (isScalar(node)) {
    const v = node.value;
    if (v == null) return "";
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return String(v);
  }
  return undefined;
}

export function parseFrontmatter(raw: string | null): ParsedFrontmatter {
  if (raw == null) {
    return { fields: {}, fieldCount: 0, error: null };
  }

  const doc = parseDocument(raw, { keepSourceTokens: true });
  if (doc.errors.length > 0) {
    return {
      fields: {},
      fieldCount: 0,
      error: doc.errors[0]?.message ?? "YAML を解析できません",
    };
  }

  const contents = doc.contents;
  if (!isMap(contents)) {
    // スカラーや配列だけの Front Matter。壊れてはいないが Fields には出せない。
    return { fields: {}, fieldCount: 0, error: null };
  }

  const fields: FrontmatterFields = {};
  for (const item of contents.items as Pair<Node, Node>[]) {
    const key = scalarString(item.key);
    if (!key) continue;

    if (key === "tags") {
      if (isSeq(item.value)) {
        fields.tags = item.value.items
          .map((n) => scalarString(n))
          .filter((v): v is string => v != null && v !== "");
      } else {
        const single = scalarString(item.value);
        fields.tags = single ? [single] : [];
      }
      continue;
    }

    if (key === "title" || key === "status" || key === "created") {
      const value = scalarString(item.value);
      if (value !== undefined) fields[key] = value;
    }
  }

  return { fields, fieldCount: contents.items.length, error: null };
}

/** 1 行の中で、そのオフセットが属する行のインデント量を返す。 */
function indentAt(raw: string, offset: number): number {
  const lineStart = raw.lastIndexOf("\n", offset - 1) + 1;
  return offset - lineStart;
}

function serializeScalar(value: string): string {
  // yaml に任せる。引用が要るかどうかの判断を自前で書かない。
  return stringify(value).replace(/\n$/, "");
}

function serializeTags(values: string[], flow: boolean, indent: number): string {
  if (values.length === 0) return "[]";
  if (flow) {
    return `[${values.map((v) => serializeScalar(v)).join(", ")}]`;
  }
  const pad = " ".repeat(indent);
  return values.map((v, i) => `${i === 0 ? "" : pad}- ${serializeScalar(v)}`).join("\n");
}

/**
 * 1 つのキーの値だけを差し替える。
 *
 * 他のキー・コメント・空行・引用符には一切触れない。
 */
export function patchField(
  raw: string | null,
  key: string,
  value: string | string[],
): string {
  const source = raw ?? "";
  const doc = parseDocument(source, { keepSourceTokens: true });

  if (doc.errors.length > 0 || !isMap(doc.contents)) {
    // 壊れた YAML を勝手に直さない（§8）。追記もしない。
    return source;
  }

  const pair = (doc.contents.items as Pair<Node, Node>[]).find(
    (item) => scalarString(item.key) === key,
  );

  // 既存キーがない場合は末尾へ 1 行足す。既存の行には触れない。
  if (!pair || !pair.value) {
    const serialized = Array.isArray(value)
      ? serializeTags(value, false, 2)
      : serializeScalar(value);
    const line = Array.isArray(value)
      ? `${key}:\n  ${serialized.split("\n").join("\n  ")}`
      : `${key}: ${serialized}`;
    if (source.length === 0) return line;
    return source.endsWith("\n") ? `${source}${line}` : `${source}\n${line}`;
  }

  const range = (pair.value as { range?: [number, number, number] }).range;
  if (!range) return source;

  const [start, end] = range;
  const isFlow = isSeq(pair.value) ? Boolean((pair.value as { flow?: boolean }).flow) : false;
  const replacement = Array.isArray(value)
    ? serializeTags(value, isFlow, indentAt(source, start))
    : serializeScalar(value);

  return source.slice(0, start) + replacement + source.slice(end);
}

/** Front Matter を差し替えた全文を返す。本文には触れない。 */
export function replaceFrontmatter(text: string, nextRaw: string): string {
  const slice = detectFrontmatter(text);
  if (slice.raw == null) {
    return `---\n${nextRaw}\n---\n\n${text}`;
  }
  return `---\n${nextRaw}\n---\n${text.slice(slice.bodyOffset)}`;
}

/** Front Matter を持たない文書へ Metadata を追加する（U-018 の `Add metadata`）。 */
export function addFrontmatter(text: string): string {
  const slice = detectFrontmatter(text);
  if (slice.raw != null) return text;
  const today = new Date().toISOString().slice(0, 10);
  return `---\ntags: []\nstatus: draft\ncreated: ${today}\n---\n\n${text}`;
}
