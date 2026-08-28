//! Finding the session to open.
//!
//! Filesystem knowledge lives here and nowhere else, so the adapters and the
//! renderer stay IO-free and testable on their own.

use std::path::{Path, PathBuf};

use crate::adapter::{self, Confidence, SessionSource};

/// Extensions a session file can have. A session is JSON, one way or another.
const CANDIDATE_EXTENSIONS: [&str; 2] = ["jsonl", "json"];

#[derive(Debug)]
pub enum DiscoverError {
    NotFound(PathBuf),
    /// A directory with no file any adapter recognised.
    NoSession(PathBuf),
    Io(std::io::Error),
}

impl std::fmt::Display for DiscoverError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NotFound(path) => write!(f, "{} does not exist", path.display()),
            Self::NoSession(path) => write!(
                f,
                "no session file found under {} (looked for .jsonl and .json)",
                path.display()
            ),
            Self::Io(error) => write!(f, "{error}"),
        }
    }
}

impl std::error::Error for DiscoverError {}

impl From<std::io::Error> for DiscoverError {
    fn from(error: std::io::Error) -> Self {
        Self::Io(error)
    }
}

/// Resolve a user-supplied path to one session file.
///
/// A file is taken as given. A directory is searched for the most recently
/// modified file an adapter recognises, which is what "follow the latest local
/// activity" means in practice.
pub fn resolve(path: &Path) -> Result<PathBuf, DiscoverError> {
    if !path.exists() {
        return Err(DiscoverError::NotFound(path.to_path_buf()));
    }
    if path.is_file() {
        return Ok(path.to_path_buf());
    }

    let mut best: Option<(std::time::SystemTime, PathBuf)> = None;
    for candidate in walk(path)? {
        let Ok(source) = SessionSource::read(&candidate) else {
            continue;
        };
        let recognised = adapter::registry()
            .iter()
            .any(|a| a.detect(&source) != Confidence::No);
        if !recognised {
            continue;
        }
        let modified = std::fs::metadata(&candidate)
            .and_then(|meta| meta.modified())
            .unwrap_or(std::time::UNIX_EPOCH);
        if best.as_ref().is_none_or(|(seen, _)| modified > *seen) {
            best = Some((modified, candidate));
        }
    }

    best.map(|(_, path)| path)
        .ok_or_else(|| DiscoverError::NoSession(path.to_path_buf()))
}

/// Candidate files directly in a directory and one level below it.
///
/// Bounded on purpose. An unbounded walk of a path the developer typed by
/// mistake (a home directory, a repository root) would stat everything on the
/// disk before reporting that it found nothing.
fn walk(root: &Path) -> Result<Vec<PathBuf>, DiscoverError> {
    let mut found = Vec::new();
    for entry in std::fs::read_dir(root)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_file() {
            if has_candidate_extension(&path) {
                found.push(path);
            }
        } else if path.is_dir() {
            for nested in std::fs::read_dir(&path)?.flatten() {
                let nested = nested.path();
                if nested.is_file() && has_candidate_extension(&nested) {
                    found.push(nested);
                }
            }
        }
    }
    Ok(found)
}

fn has_candidate_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| CANDIDATE_EXTENSIONS.contains(&ext))
}
