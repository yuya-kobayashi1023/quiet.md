/**
 * クリップボードの画像を貼り付けたら、保存して `![](...)` を挿入する（AUTO-050）。
 *
 * 保存はアプリ側（native bridge を持つ App）の仕事なので、ここは `ImageSaver` を
 * 受け取って呼ぶだけ。テキストの貼り付けには介入せず、既定の貼り付けへ譲る。
 */

import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

/** 画像を保存し、ノートから見た相対パスを返す。保存できなければ null。 */
export type ImageSaver = (file: File) => Promise<string | null>;

const isImage = (file: File) => file.type.startsWith("image/");

/** クリップボードの中の最初の画像ファイル。無ければ null。 */
export function imageFileIn(data: DataTransfer | null): File | null {
  if (!data) return null;
  const direct = Array.from(data.files).find(isImage);
  if (direct) return direct;
  for (const item of Array.from(data.items)) {
    if (item.kind === "file" && item.type.startsWith("image/")) return item.getAsFile();
  }
  return null;
}

/**
 * テストから直接叩くための入口。
 *
 * `paste` の DOM イベントは jsdom で組みにくいので、ファイルを受け取った後の
 * 「保存して挿入する」部分をここへ切り出してある。挿入したら true。
 */
export async function handleImagePaste(
  view: EditorView,
  file: File,
  saver: ImageSaver,
): Promise<boolean> {
  if (!isImage(file)) return false;
  // IME の変換中は横取りしない。確定前の文字列を壊す。
  if (view.composing) return false;

  const path = await saver(file);
  if (path === null) return false;

  const { from, to } = view.state.selection.main;
  const insert = `![](${path})`;
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + insert.length },
    scrollIntoView: true,
    userEvent: "input.paste",
  });
  return true;
}

/**
 * `save` は呼ぶたびに最新の saver を返す。App の callback は ref 経由で差し替わるため、
 * 拡張を作った時点の関数を握らない。
 */
export function imagePaste(save: () => ImageSaver | undefined): Extension {
  return EditorView.domEventHandlers({
    paste(event, view) {
      const file = imageFileIn(event.clipboardData);
      if (!file || view.composing) return false;
      const saver = save();
      if (!saver) return false;
      event.preventDefault();
      void handleImagePaste(view, file, saver);
      return true;
    },
  });
}
