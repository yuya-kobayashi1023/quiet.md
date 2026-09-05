//! Workspace 全体の全文検索（U-013 / ADR-011）。
//!
//! 走査は `scan.rs` の結果を再利用する。ignore 規則を二重に持たないため。
//!
//! 設計上の決めごと:
//! - 正規表現は受け付けない。ユーザーが打った文字列をそのまま探す
//! - 巨大ファイルは飛ばす。1 文書のために検索全体が止まる方が困る
//! - 上限に達したら打ち切って truncated を返す。黙って一部だけ返さない
//! - column は **UTF-16 code unit** で数える。受け取る側が JS の文字列だから

use crate::errors::Result;
use crate::filesystem::scan::{self, DocumentSummary};
use serde::{Deserialize, Serialize};
use std::path::Path;

/// 1 文書あたりの上限。これを超えた分は数えるだけで返さない。
const MAX_MATCHES_PER_FILE: usize = 50;
/// 全体の上限。
const MAX_TOTAL_MATCHES: usize = 2_000;
/// 結果を返す文書数の上限。
const MAX_FILES: usize = 300;
/// 検索対象にするファイルサイズの上限（4 MiB）。
const MAX_FILE_BYTES: u64 = 4 * 1024 * 1024;
/// preview に載せる 1 行の最大長（文字数）。
const PREVIEW_CHARS: usize = 160;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchQuery {
    pub query: String,
    /// false なら Archive 済みの文書を結果から除く（既定は true）。
    pub include_archived: bool,
    pub case_sensitive: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchMatch {
    /// ファイル先頭からの行番号（1 始まり）。Front Matter も 1 行として数える。
    pub line: u32,
    /// 行頭からの位置（1 始まり、UTF-16 code unit）。
    pub column: u32,
    /// 一致した長さ（UTF-16 code unit）。
    pub length: u32,
    /// 表示用に切り出した行。長い行は一致の周りだけを残す。
    pub preview: String,
    /// preview 内での一致開始位置（UTF-16 code unit）。
    pub preview_column: u32,
    /// preview が行頭より後ろから始まっているか。UI で省略記号を出すため。
    pub preview_truncated_start: bool,
    pub preview_truncated_end: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchFileResult {
    pub document: DocumentSummary,
    pub matches: Vec<SearchMatch>,
    /// この文書での総ヒット数。`matches.len()` より大きいことがある。
    pub match_count: usize,
    pub archived: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResults {
    pub files: Vec<SearchFileResult>,
    pub total_matches: usize,
    /// 上限で打ち切ったか。UI はこれを見て「一部のみ」と伝える。
    pub truncated: bool,
    pub scanned_files: usize,
}

fn utf16_len(s: &str) -> u32 {
    s.chars().map(|c| c.len_utf16() as u32).sum()
}

/// 1 行の中の一致をすべて拾う。
///
/// 大文字小文字を無視する場合は両方を lowercase してから探す。
/// `to_lowercase` は ß → ss のように文字数が変わることがあるため、
/// 位置は lowercase 後の文字列で数え、元の行を切り出すときにクランプする。
fn find_in_line(line: &str, needle: &str, case_sensitive: bool) -> Vec<(usize, usize)> {
    let (haystack, needle) = if case_sensitive {
        (line.to_string(), needle.to_string())
    } else {
        (line.to_lowercase(), needle.to_lowercase())
    };
    if needle.is_empty() {
        return Vec::new();
    }

    let mut spans = Vec::new();
    let mut from = 0usize;
    while let Some(found) = haystack[from..].find(&needle) {
        let start = from + found;
        spans.push((start, start + needle.len()));
        // 空でない needle なので必ず前進する。
        from = start + needle.len();
        if from > haystack.len() {
            break;
        }
    }
    spans
}

/// 一致の周りを `PREVIEW_CHARS` に収める。
///
/// 戻り値は (切り出した文字列, 一致開始位置(UTF-16), 前を削ったか, 後ろを削ったか)。
fn build_preview(line: &str, byte_start: usize, byte_end: usize) -> (String, u32, bool, bool) {
    // lowercase で位置がずれた場合に備えてクランプする。
    let byte_start = byte_start.min(line.len());
    let byte_end = byte_end.min(line.len());
    let (byte_start, byte_end) = (
        floor_char_boundary(line, byte_start),
        floor_char_boundary(line, byte_end.max(byte_start)),
    );

    let before_chars = line[..byte_start].chars().count();
    let match_chars = line[byte_start..byte_end].chars().count();

    // 一致の前に残す余白。一致自体が長いときは前を詰める。
    let lead = PREVIEW_CHARS.saturating_sub(match_chars) / 3;
    let skip = before_chars.saturating_sub(lead);

    let mut out: String = line.chars().skip(skip).take(PREVIEW_CHARS).collect();
    let truncated_start = skip > 0;
    let truncated_end = line.chars().count() > skip + out.chars().count();

    // 行頭・行末の空白は表示に不要。ただし先頭を削ると位置がずれるので、
    // 削った分を数えて preview_column に反映する。
    let trimmed = out.trim_start();
    let removed = out.chars().count() - trimmed.chars().count();
    out = trimmed.trim_end().to_string();

    let preview_column = line
        .chars()
        .skip(skip + removed)
        .take(before_chars.saturating_sub(skip + removed))
        .map(|c| c.len_utf16() as u32)
        .sum::<u32>();

    (out, preview_column, truncated_start, truncated_end)
}

fn floor_char_boundary(s: &str, mut index: usize) -> usize {
    while index > 0 && !s.is_char_boundary(index) {
        index -= 1;
    }
    index
}

pub fn search_workspace(
    root: &Path,
    archived: &[String],
    query: &SearchQuery,
) -> Result<SearchResults> {
    let needle = query.query.trim();
    if needle.is_empty() {
        return Ok(SearchResults {
            files: Vec::new(),
            total_matches: 0,
            truncated: false,
            scanned_files: 0,
        });
    }

    let snapshot = scan::scan_workspace(root)?;
    let mut files = Vec::new();
    let mut total_matches = 0usize;
    let mut scanned_files = 0usize;
    let mut truncated = snapshot.truncated;

    for document in snapshot.documents {
        let is_archived = archived.iter().any(|p| p == &document.relative_path);
        if is_archived && !query.include_archived {
            continue;
        }
        if document.size > MAX_FILE_BYTES {
            continue;
        }

        // 読めないファイルで検索全体を止めない。UTF-8 でなければ飛ばす。
        let content = match std::fs::read_to_string(&document.path) {
            Ok(text) => text,
            Err(_) => continue,
        };
        scanned_files += 1;

        let mut matches = Vec::new();
        let mut match_count = 0usize;

        for (index, line) in content.lines().enumerate() {
            for (start, end) in find_in_line(line, needle, query.case_sensitive) {
                match_count += 1;
                if matches.len() >= MAX_MATCHES_PER_FILE {
                    truncated = true;
                    continue;
                }
                let (preview, preview_column, cut_start, cut_end) =
                    build_preview(line, start, end);
                let column = utf16_len(&line[..floor_char_boundary(line, start.min(line.len()))]);
                matches.push(SearchMatch {
                    line: index as u32 + 1,
                    column: column + 1,
                    length: utf16_len(needle),
                    preview,
                    preview_column,
                    preview_truncated_start: cut_start,
                    preview_truncated_end: cut_end,
                });
            }
        }

        if match_count == 0 {
            continue;
        }

        total_matches += match_count;
        files.push(SearchFileResult {
            document,
            matches,
            match_count,
            archived: is_archived,
        });

        if files.len() >= MAX_FILES || total_matches >= MAX_TOTAL_MATCHES {
            truncated = true;
            break;
        }
    }

    // ヒット数の多い文書を先に出す。同数ならパス順（scan の並びを維持）。
    files.sort_by(|a, b| b.match_count.cmp(&a.match_count));

    Ok(SearchResults {
        files,
        total_matches,
        truncated,
        scanned_files,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn q(query: &str, case_sensitive: bool) -> SearchQuery {
        SearchQuery {
            query: query.to_string(),
            include_archived: true,
            case_sensitive,
        }
    }

    fn fixture(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(name);
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn finds_matches_case_insensitively_by_default() {
        let dir = fixture("quiet-md-test-search-basic");
        std::fs::write(dir.join("a.md"), "Hello world\nhello again\n").unwrap();

        let results = search_workspace(&dir, &[], &q("hello", false)).unwrap();
        assert_eq!(results.total_matches, 2);
        assert_eq!(results.files.len(), 1);
        assert_eq!(results.files[0].matches[0].line, 1);
        assert_eq!(results.files[0].matches[0].column, 1);
        assert_eq!(results.files[0].matches[1].line, 2);
    }

    #[test]
    fn case_sensitive_narrows_the_result() {
        let dir = fixture("quiet-md-test-search-case");
        std::fs::write(dir.join("a.md"), "Hello world\nhello again\n").unwrap();

        let results = search_workspace(&dir, &[], &q("Hello", true)).unwrap();
        assert_eq!(results.total_matches, 1);
        assert_eq!(results.files[0].matches[0].line, 1);
    }

    #[test]
    fn excludes_archived_when_asked() {
        let dir = fixture("quiet-md-test-search-archive");
        std::fs::write(dir.join("a.md"), "needle\n").unwrap();
        std::fs::write(dir.join("b.md"), "needle\n").unwrap();
        let archived = vec!["b.md".to_string()];

        let with = search_workspace(&dir, &archived, &q("needle", false)).unwrap();
        assert_eq!(with.files.len(), 2);

        let mut without = q("needle", false);
        without.include_archived = false;
        let without = search_workspace(&dir, &archived, &without).unwrap();
        assert_eq!(without.files.len(), 1);
        assert_eq!(without.files[0].document.relative_path, "a.md");
    }

    #[test]
    fn archived_flag_is_reported() {
        let dir = fixture("quiet-md-test-search-flag");
        std::fs::write(dir.join("b.md"), "needle\n").unwrap();

        let results =
            search_workspace(&dir, &["b.md".to_string()], &q("needle", false)).unwrap();
        assert!(results.files[0].archived);
    }

    #[test]
    fn column_is_counted_in_utf16_units() {
        let dir = fixture("quiet-md-test-search-utf16");
        // 絵文字は UTF-16 で 2 単位。JS 側の文字列位置と揃っている必要がある。
        std::fs::write(dir.join("a.md"), "😀x needle\n").unwrap();

        let results = search_workspace(&dir, &[], &q("needle", false)).unwrap();
        let m = &results.files[0].matches[0];
        // "😀"(2) + "x"(1) + " "(1) = 4 → 1 始まりで 5
        assert_eq!(m.column, 5);
        assert_eq!(m.length, 6);
    }

    #[test]
    fn japanese_column_is_counted_correctly() {
        let dir = fixture("quiet-md-test-search-ja");
        std::fs::write(dir.join("a.md"), "静かな設計メモ\n").unwrap();

        let results = search_workspace(&dir, &[], &q("設計", false)).unwrap();
        let m = &results.files[0].matches[0];
        assert_eq!(m.column, 4);
        assert_eq!(m.length, 2);
    }

    #[test]
    fn long_lines_are_trimmed_around_the_match() {
        let dir = fixture("quiet-md-test-search-long");
        let line = format!("{}needle{}", "a".repeat(400), "b".repeat(400));
        std::fs::write(dir.join("a.md"), line).unwrap();

        let results = search_workspace(&dir, &[], &q("needle", false)).unwrap();
        let m = &results.files[0].matches[0];
        assert!(m.preview.chars().count() <= PREVIEW_CHARS);
        assert!(m.preview.contains("needle"));
        assert!(m.preview_truncated_start);
        assert!(m.preview_truncated_end);
        // preview_column が preview の中の "needle" を指していること。
        let at = m.preview_column as usize;
        assert_eq!(&m.preview[at..at + 6], "needle");
    }

    #[test]
    fn empty_query_returns_nothing() {
        let dir = fixture("quiet-md-test-search-empty");
        std::fs::write(dir.join("a.md"), "anything\n").unwrap();

        let results = search_workspace(&dir, &[], &q("   ", false)).unwrap();
        assert_eq!(results.total_matches, 0);
        assert!(results.files.is_empty());
    }

    #[test]
    fn per_file_matches_are_capped_but_counted() {
        let dir = fixture("quiet-md-test-search-cap");
        let body = "x\n".repeat(MAX_MATCHES_PER_FILE + 10);
        std::fs::write(dir.join("a.md"), body).unwrap();

        let results = search_workspace(&dir, &[], &q("x", false)).unwrap();
        assert_eq!(results.files[0].matches.len(), MAX_MATCHES_PER_FILE);
        assert_eq!(results.files[0].match_count, MAX_MATCHES_PER_FILE + 10);
        assert!(results.truncated);
    }

    #[test]
    fn files_are_ordered_by_match_count() {
        let dir = fixture("quiet-md-test-search-order");
        std::fs::write(dir.join("few.md"), "hit\n").unwrap();
        std::fs::write(dir.join("many.md"), "hit\nhit\nhit\n").unwrap();

        let results = search_workspace(&dir, &[], &q("hit", false)).unwrap();
        assert_eq!(results.files[0].document.relative_path, "many.md");
        assert_eq!(results.files[1].document.relative_path, "few.md");
    }
}
