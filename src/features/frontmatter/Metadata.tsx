/**
 * Metadata（YAML Front Matter）。
 *
 * ADR-002 / frontmatter.md:
 * - 通常は `Metadata · N fields` の 1 行だけ
 * - Expand で Fields / Raw を切替
 * - 独立 Card にしない。強い背景面を作らない
 * - Front Matter がなければ summary 自体を出さない（U-018）
 * - Invalid YAML でも入力を消さない。Fields sync だけ止める（U-017）
 *
 * `title` は Metadata の 1 項目にすぎない。画面上部の Title UI とは連動しない（U-020）。
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  detectFrontmatter,
  parseFrontmatter,
  patchField,
  replaceFrontmatter,
} from "@/domain/document/frontmatter";
import { ChevronDownIcon } from "@/ui/components/icons";
import "./metadata.css";

interface MetadataProps {
  /** 文書全文。 */
  text: string;
  onChange: (nextText: string) => void;
}

type Mode = "fields" | "raw";

export function Metadata({ text, onChange }: MetadataProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("fields");
  const rawRef = useRef<HTMLTextAreaElement>(null);

  const slice = useMemo(() => detectFrontmatter(text), [text]);
  const parsed = useMemo(() => parseFrontmatter(slice.raw), [slice.raw]);

  // Fields は最後に valid だった値を出す（frontmatter.md §8）。
  const lastValid = useRef(parsed);
  if (!parsed.error) lastValid.current = parsed;
  const fields = parsed.error ? lastValid.current.fields : parsed.fields;

  useEffect(() => {
    if (mode !== "raw") return;
    const el = rawRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [mode, slice.raw]);

  // Front Matter がない文書では何も描かない（U-018）。
  if (slice.raw == null) return null;

  const setField = (key: string, value: string | string[]) => {
    const nextRaw = patchField(slice.raw, key, value);
    if (nextRaw === slice.raw) return;
    onChange(replaceFrontmatter(text, nextRaw));
  };

  const setRaw = (nextRaw: string) => {
    onChange(replaceFrontmatter(text, nextRaw));
  };

  return (
    <section className={`metadata${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="metadata-summary"
        aria-expanded={open}
        aria-controls="metadata-panel"
        onClick={() => setOpen((v) => !v)}
      >
        <span>
          Metadata<span className="metadata-count"> · {parsed.error ? "—" : `${lastValid.current.fieldCount} fields`}</span>
        </span>
        {parsed.error ? <span className="metadata-invalid">YAML エラー</span> : null}
        <ChevronDownIcon className="metadata-chevron" />
      </button>

      {open ? (
        <div className="metadata-panel" id="metadata-panel">
          <div className="metadata-modes" role="tablist" aria-label="Front matter view">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "fields"}
              className={mode === "fields" ? "is-active" : ""}
              onClick={() => setMode("fields")}
            >
              Fields
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "raw"}
              className={mode === "raw" ? "is-active" : ""}
              onClick={() => setMode("raw")}
            >
              Raw
            </button>
          </div>

          {mode === "fields" ? (
            <div className="metadata-fields">
              {parsed.error ? (
                <p className="metadata-error">
                  YAML を解析できないため、Fields の同期を止めています。Raw で修正してください。
                </p>
              ) : null}
              <label className="metadata-field">
                <span className="metadata-key">title</span>
                <input
                  className="metadata-input"
                  value={fields.title ?? ""}
                  disabled={Boolean(parsed.error)}
                  onChange={(e) => setField("title", e.target.value)}
                />
              </label>
              <label className="metadata-field">
                <span className="metadata-key">tags</span>
                <input
                  className="metadata-input"
                  value={(fields.tags ?? []).join(", ")}
                  disabled={Boolean(parsed.error)}
                  onChange={(e) =>
                    setField(
                      "tags",
                      e.target.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </label>
              <label className="metadata-field">
                <span className="metadata-key">status</span>
                <input
                  className="metadata-input"
                  value={fields.status ?? ""}
                  disabled={Boolean(parsed.error)}
                  onChange={(e) => setField("status", e.target.value)}
                />
              </label>
              <label className="metadata-field">
                <span className="metadata-key">created</span>
                <input
                  className="metadata-input"
                  value={fields.created ?? ""}
                  disabled={Boolean(parsed.error)}
                  onChange={(e) => setField("created", e.target.value)}
                />
              </label>
            </div>
          ) : (
            <div className="metadata-raw">
              <textarea
                ref={rawRef}
                className="metadata-raw-input"
                spellCheck={false}
                aria-label="YAML front matter"
                value={slice.raw}
                onChange={(e) => setRaw(e.target.value)}
              />
              {parsed.error ? (
                <p className="metadata-error">{parsed.error}</p>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
