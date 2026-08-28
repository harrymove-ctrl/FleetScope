//! The provider ingestion boundary.
//!
//! One trait, one registry, and every provider dialect behind it. The Agent
//! Viewer and everything downstream operate on [`ViewerSession`] only, which is
//! what makes adding a provider additive rather than a change to the renderer.
//!
//! Detection is explicit and scored rather than "try each and take the first
//! that does not panic": a wrong-but-parseable guess would draw a confident
//! graph of the wrong thing, which is worse than refusing the file.

use std::path::{Path, PathBuf};

use crate::viewer::ViewerSession;

pub mod adk;

/// One candidate file, already read.
///
/// Adapters get the bytes rather than the path so detection cannot accidentally
/// depend on a filename convention that a real session does not follow.
#[derive(Clone, Debug)]
pub struct SessionSource {
    pub path: PathBuf,
    pub text: String,
}

impl SessionSource {
    pub fn read(path: &Path) -> std::io::Result<Self> {
        Ok(Self {
            path: path.to_path_buf(),
            text: std::fs::read_to_string(path)?,
        })
    }

    /// First non-empty line, which is what every line-oriented probe wants.
    pub fn first_line(&self) -> Option<&str> {
        self.text.lines().map(str::trim).find(|l| !l.is_empty())
    }
}

/// How sure an adapter is that a source is its dialect.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum Confidence {
    /// Not this dialect. The adapter is excluded.
    No,
    /// Shape-compatible but missing a discriminator. Used only when nothing
    /// claims the file outright, and reported as a guess.
    Maybe,
    /// A discriminating field was present.
    Yes,
}

#[derive(Debug)]
pub enum AdapterError {
    /// The file is this dialect but malformed. Carries the line so the
    /// developer can open it; a session viewer that says "parse error" without
    /// a location is useless on a 10,000-line log.
    Malformed {
        line: Option<usize>,
        message: String,
    },
    /// Parsed cleanly and contained no agent activity at all.
    Empty,
}

impl std::fmt::Display for AdapterError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Malformed {
                line: Some(line),
                message,
            } => write!(f, "line {line}: {message}"),
            Self::Malformed {
                line: None,
                message,
            } => write!(f, "{message}"),
            Self::Empty => write!(f, "no agent activity found"),
        }
    }
}

impl std::error::Error for AdapterError {}

pub trait SessionAdapter {
    /// Stable id recorded on the produced session, e.g. `google-adk@1`.
    fn id(&self) -> &'static str;
    /// Human name used in errors and in `inspect` output.
    fn label(&self) -> &'static str;
    fn detect(&self, source: &SessionSource) -> Confidence;
    fn parse(&self, source: &SessionSource) -> Result<ViewerSession, AdapterError>;
}

/// Every adapter compiled into this build, in preference order.
pub fn registry() -> Vec<Box<dyn SessionAdapter>> {
    vec![Box::new(adk::AdkAdapter)]
}

#[derive(Debug)]
pub struct Unsupported {
    pub path: PathBuf,
    pub tried: Vec<&'static str>,
}

impl std::fmt::Display for Unsupported {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{} is not a session format FleetScope recognises (tried: {})",
            self.path.display(),
            self.tried.join(", ")
        )
    }
}

impl std::error::Error for Unsupported {}

/// Pick the adapter for a source and parse it.
///
/// A `Yes` beats every `Maybe`. Among equals the registry order decides, which
/// is why [`registry`] is documented as preference-ordered.
pub fn parse(source: &SessionSource) -> Result<ViewerSession, Box<dyn std::error::Error>> {
    let adapters = registry();
    let mut best: Option<(Confidence, &Box<dyn SessionAdapter>)> = None;
    for adapter in &adapters {
        let confidence = adapter.detect(source);
        if confidence == Confidence::No {
            continue;
        }
        if best.as_ref().is_none_or(|(seen, _)| confidence > *seen) {
            best = Some((confidence, adapter));
        }
    }

    match best {
        Some((_, adapter)) => Ok(adapter.parse(source)?),
        None => Err(Box::new(Unsupported {
            path: source.path.clone(),
            tried: adapters.iter().map(|a| a.label()).collect(),
        })),
    }
}
