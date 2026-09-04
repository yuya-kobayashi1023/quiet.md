//! Native error contract.
//!
//! `architecture/interfaces.md` §9 で決めたコードをそのまま返す。
//! UI がフィードバックを選べるよう、文字列だけで返さない。

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "code")]
pub enum NativeError {
    #[serde(rename = "NOT_FOUND")]
    NotFound { path: String },
    #[serde(rename = "PERMISSION_DENIED")]
    PermissionDenied { path: String },
    #[serde(rename = "ALREADY_EXISTS")]
    AlreadyExists { path: String },
    #[serde(rename = "INVALID_FILENAME")]
    InvalidFilename { filename: String, reason: String },
    #[serde(rename = "CONFLICT")]
    Conflict { path: String },
    #[serde(rename = "UNSUPPORTED_ENCODING")]
    UnsupportedEncoding { path: String },
    #[serde(rename = "OUT_OF_SCOPE")]
    OutOfScope { path: String },
    #[serde(rename = "IO_ERROR")]
    IoError { message: String },
}

impl NativeError {
    /// `std::io::Error` を、パスの分かる形へ翻訳する。
    pub fn from_io(err: &std::io::Error, path: &std::path::Path) -> Self {
        let p = path.display().to_string();
        match err.kind() {
            std::io::ErrorKind::NotFound => NativeError::NotFound { path: p },
            std::io::ErrorKind::PermissionDenied => NativeError::PermissionDenied { path: p },
            std::io::ErrorKind::AlreadyExists => NativeError::AlreadyExists { path: p },
            // ログにも本文を出さない（NFR §11）。パスと種別までに留める。
            _ => NativeError::IoError {
                message: format!("{}: {}", p, err.kind()),
            },
        }
    }
}

impl std::fmt::Display for NativeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            NativeError::NotFound { path } => write!(f, "not found: {path}"),
            NativeError::PermissionDenied { path } => write!(f, "permission denied: {path}"),
            NativeError::AlreadyExists { path } => write!(f, "already exists: {path}"),
            NativeError::InvalidFilename { filename, reason } => {
                write!(f, "invalid filename {filename}: {reason}")
            }
            NativeError::Conflict { path } => write!(f, "conflict: {path}"),
            NativeError::UnsupportedEncoding { path } => write!(f, "unsupported encoding: {path}"),
            NativeError::OutOfScope { path } => write!(f, "out of workspace scope: {path}"),
            NativeError::IoError { message } => write!(f, "io error: {message}"),
        }
    }
}

impl std::error::Error for NativeError {}

pub type Result<T> = std::result::Result<T, NativeError>;
