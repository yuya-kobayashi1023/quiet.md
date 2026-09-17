/**
 * クリップボードから貼り付けた画像のファイル名（AUTO-050）。
 *
 * 名前はタイトルを含めず、ローカル時刻だけで組む。タイトルは空白や日本語を含みうるが、
 * 素の時刻なら Markdown に書く相対パスがそのまま読める。
 * 同名の衝突は Rust 側（ディスクを見られる唯一の場所）が連番で解決する。
 */

/** 受け付ける MIME type と拡張子の対応。ここにないものは既定の貼り付けへ譲る。 */
const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

const pad2 = (n: number) => String(n).padStart(2, "0");

/** `image-YYYYMMDD-HHMMSS.<ext>`。扱わない MIME type なら null。 */
export function pastedImageFilename(now: Date, mime: string): string | null {
  const ext = EXTENSIONS[mime];
  if (!ext) return null;
  const date = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
  const time = `${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
  return `image-${date}-${time}.${ext}`;
}
