//! Filesystem layer.
//!
//! Frontend は任意 Path へ直接触らない（`architecture/architecture.md` §2）。
//! 読み書き・改行コード・BOM・hash の扱いはすべてここに閉じる。

pub mod atomic;
pub mod paths;
pub mod scan;

use crate::errors::{NativeError, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;

/// ディスク上の版。競合判定に使う（U-028）。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DiskRevision {
    pub modified_at: u64,
    pub size: u64,
    pub content_hash: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum LineEnding {
    Lf,
    Crlf,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentContent {
    pub path: String,
    pub filename: String,
    pub content: String,
    pub encoding: &'static str,
    pub has_bom: bool,
    pub line_ending: LineEnding,
    pub revision: DiskRevision,
}

const BOM: [u8; 3] = [0xEF, 0xBB, 0xBF];

pub fn hash_bytes(bytes: &[u8]) -> String {
    blake3::hash(bytes).to_hex().to_string()
}

fn modified_at(meta: &std::fs::Metadata) -> u64 {
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// 改行コードを判定する。CRLF が 1 つでもあれば CRLF 扱い。
///
/// 混在ファイルは保存時に元の主流へ寄せず、CRLF を保つ（データを勝手に変えない）。
fn detect_line_ending(text: &str) -> LineEnding {
    if text.contains("\r\n") {
        LineEnding::Crlf
    } else {
        LineEnding::Lf
    }
}

/// ファイルを読む。
///
/// UTF-8 のみ正式サポート（`domain/document-model.md` §11）。
/// 不正なバイト列は握りつぶさず `UNSUPPORTED_ENCODING` を返す。
pub fn read_document(path: &Path) -> Result<DocumentContent> {
    let bytes = std::fs::read(path).map_err(|e| NativeError::from_io(&e, path))?;
    let meta = std::fs::metadata(path).map_err(|e| NativeError::from_io(&e, path))?;

    let has_bom = bytes.starts_with(&BOM);
    let body = if has_bom { &bytes[3..] } else { &bytes[..] };

    let text = String::from_utf8(body.to_vec()).map_err(|_| NativeError::UnsupportedEncoding {
        path: path.display().to_string(),
    })?;

    let line_ending = detect_line_ending(&text);

    Ok(DocumentContent {
        path: path.display().to_string(),
        filename: path
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default(),
        // メモリ上は常に LF で扱い、保存時に元の改行コードへ戻す。
        content: text.replace("\r\n", "\n"),
        encoding: "utf-8",
        has_bom,
        line_ending,
        revision: DiskRevision {
            modified_at: modified_at(&meta),
            size: meta.len(),
            content_hash: hash_bytes(&bytes),
        },
    })
}

/// 保存するバイト列を組み立てる。
///
/// メモリ上の LF を、そのファイルの改行コードへ戻す。BOM も元の有無を保つ。
pub fn serialize(content: &str, line_ending: LineEnding, has_bom: bool) -> Vec<u8> {
    let text = match line_ending {
        LineEnding::Lf => content.replace("\r\n", "\n"),
        LineEnding::Crlf => content.replace("\r\n", "\n").replace('\n', "\r\n"),
    };
    let mut out = Vec::with_capacity(text.len() + 3);
    if has_bom {
        out.extend_from_slice(&BOM);
    }
    out.extend_from_slice(text.as_bytes());
    out
}

pub fn current_revision(path: &Path) -> Result<DiskRevision> {
    let bytes = std::fs::read(path).map_err(|e| NativeError::from_io(&e, path))?;
    let meta = std::fs::metadata(path).map_err(|e| NativeError::from_io(&e, path))?;
    Ok(DiskRevision {
        modified_at: modified_at(&meta),
        size: meta.len(),
        content_hash: hash_bytes(&bytes),
    })
}

/// `expected` と現在のディスク内容が一致するか。
///
/// mtime と size は環境によって当てにならないため、最終的な判定は content hash で行う（U-028）。
pub fn matches_revision(path: &Path, expected: &DiskRevision) -> Result<bool> {
    match current_revision(path) {
        Ok(actual) => Ok(actual.content_hash == expected.content_hash),
        Err(NativeError::NotFound { .. }) => Ok(false),
        Err(e) => Err(e),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_crlf_on_roundtrip() {
        let bytes = serialize("a\nb\n", LineEnding::Crlf, false);
        assert_eq!(bytes, b"a\r\nb\r\n");
    }

    #[test]
    fn keeps_lf_on_roundtrip() {
        let bytes = serialize("a\nb\n", LineEnding::Lf, false);
        assert_eq!(bytes, b"a\nb\n");
    }

    #[test]
    fn does_not_double_convert_crlf() {
        let bytes = serialize("a\r\nb", LineEnding::Crlf, false);
        assert_eq!(bytes, b"a\r\nb");
    }

    #[test]
    fn keeps_bom() {
        let bytes = serialize("a", LineEnding::Lf, true);
        assert_eq!(bytes, [0xEF, 0xBB, 0xBF, b'a']);
    }

    #[test]
    fn detects_line_ending() {
        assert_eq!(detect_line_ending("a\nb"), LineEnding::Lf);
        assert_eq!(detect_line_ending("a\r\nb"), LineEnding::Crlf);
        assert_eq!(detect_line_ending("a\nb\r\nc"), LineEnding::Crlf);
    }
}
