/**
 * 文字列を選択した状態で URL を貼ったときの、Markdown リンク化。
 *
 * `[選択文字](URL)` に組み立てる判断だけを持つ。
 * いつ介入するか（IME 中・複数カーソルなど）は `features/editor/link-paste` が決める。
 *
 * ここは CodeMirror に依存しない純粋な関数として書く（`code-fence` と同じ方針）。
 */

/**
 * 貼り付けを「1 本の URL」と見なす形。
 *
 * 空白・`<`・`>` を含むものは弾く。空白は「URL のあとに説明が続く」貼り付けを、
 * `<` `>` は `<...>` で包んだときに壊れる文字を除くため。
 */
const BARE_URL = /^https?:\/\/[^\s<>]+$/;

/**
 * 選択文字と貼り付け文字から Markdown リンクを組み立てる。
 *
 * リンク化しない場合は null を返し、通常の貼り付けに任せる。
 *
 * @param selected 選択されていた文字列
 * @param pasted   クリップボードの text/plain
 */
export function linkForPaste(selected: string, pasted: string): string | null {
  // 複数行の選択は「何をリンク文字にしたいか」が決められない。
  if (selected.trim() === "" || selected.includes("\n")) return null;

  const url = pasted.trim();
  if (!BARE_URL.test(url)) return null;

  // 対になっていない [ ] はリンク文字として解釈されない（CommonMark）。
  const text = selected.replace(/[[\]]/g, "\\$&");
  // 括弧を含む URL は対応が取れないと途中で閉じたと読まれる。<...> で包めば無条件に通る。
  const destination = /[()]/.test(url) ? `<${url}>` : url;
  return `[${text}](${destination})`;
}
