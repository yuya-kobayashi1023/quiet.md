/** Native error を UI が扱える形へ揃える（interfaces.md §9）。 */

export type NativeErrorCode =
  | "NOT_FOUND"
  | "PERMISSION_DENIED"
  | "ALREADY_EXISTS"
  | "INVALID_FILENAME"
  | "CONFLICT"
  | "UNSUPPORTED_ENCODING"
  | "OUT_OF_SCOPE"
  | "IO_ERROR";

export class NativeError extends Error {
  readonly code: NativeErrorCode;
  readonly detail: Record<string, unknown>;

  constructor(code: NativeErrorCode, detail: Record<string, unknown> = {}) {
    super(messageFor(code, detail));
    this.name = "NativeError";
    this.code = code;
    this.detail = detail;
  }
}

/** ユーザーに見せる文言。色だけに頼らず、何が起きたかを書く（principles §9）。 */
function messageFor(code: NativeErrorCode, detail: Record<string, unknown>): string {
  const path = typeof detail.path === "string" ? detail.path : "";
  switch (code) {
    case "NOT_FOUND":
      return "ファイルが見つかりません。";
    case "PERMISSION_DENIED":
      return "ファイルへの書き込みが拒否されました。他のアプリが開いている可能性があります。";
    case "ALREADY_EXISTS":
      return "同じ名前のファイルが既にあります。";
    case "INVALID_FILENAME":
      return typeof detail.reason === "string"
        ? `この名前は使えません（${detail.reason}）。`
        : "この名前は使えません。";
    case "CONFLICT":
      return "このファイルはエディタの外で変更されています。";
    case "UNSUPPORTED_ENCODING":
      return "UTF-8 として読めないファイルです。";
    case "OUT_OF_SCOPE":
      return "Workspace の外にあるため操作できません。";
    case "IO_ERROR":
    default:
      return path ? `読み書きに失敗しました: ${path}` : "読み書きに失敗しました。";
  }
}

const CODES: NativeErrorCode[] = [
  "NOT_FOUND",
  "PERMISSION_DENIED",
  "ALREADY_EXISTS",
  "INVALID_FILENAME",
  "CONFLICT",
  "UNSUPPORTED_ENCODING",
  "OUT_OF_SCOPE",
  "IO_ERROR",
];

export function toNativeError(raw: unknown): NativeError {
  if (raw instanceof NativeError) return raw;
  if (raw && typeof raw === "object" && "code" in raw) {
    const record = raw as Record<string, unknown>;
    const code = record.code;
    if (typeof code === "string" && (CODES as string[]).includes(code)) {
      return new NativeError(code as NativeErrorCode, record);
    }
  }
  return new NativeError("IO_ERROR", {
    message: raw instanceof Error ? raw.message : String(raw),
  });
}
