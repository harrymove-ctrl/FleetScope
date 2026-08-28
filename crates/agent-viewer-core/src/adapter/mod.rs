//! The provider ingestion boundary.
//!
//! One trait, one registry, and every provider dialect behind it. The Agent
//! Viewer and everything downstream operate on [`ViewerSession`] only, which is
//! what makes adding a provider additive rather than a change to the renderer.
//!
//! Detection is explicit and scored rather than "try each and take the first
//! that does not panic": a wrong-but-parseable guess would draw a confident
//! graph of the wrong thing, which is worse than refusing the file.

use std::path::PathBuf;

use crate::viewer::ViewerSession;

pub mod adk;
pub mod claude_code;

/// A file that sits alongside the main transcript.
///
/// Some providers write one file per session; others write a main transcript
/// plus a tree of per-agent files. The frontend reads them (this crate cannot)
/// and the adapter decides what they mean, so a provider that needs companions
/// does not force a new contract on every provider that does not.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Companion {
    /// Path relative to the companion root, e.g. `subagents/agent-a1b2.jsonl`.
    pub name: String,
    pub text: String,
}

/// One candidate session, already read.
///
/// Adapters get the bytes rather than the path so detection cannot accidentally
/// depend on a filename convention that a real session does not follow.
#[derive(Clone, Debug)]
pub struct SessionSource {
    pub path: PathBuf,
    pub text: String,
    pub companions: Vec<Companion>,
}

impl SessionSource {
    /// Build a source from text a frontend has already read.
    pub fn new(path: PathBuf, text: String) -> Self {
        Self {
            path,
            text,
            companions: Vec::new(),
        }
    }

    pub fn with_companions(mut self, companions: Vec<Companion>) -> Self {
        self.companions = companions;
        self
    }

    /// First non-empty line.
    pub fn first_line(&self) -> Option<&str> {
        self.text.lines().map(str::trim).find(|l| !l.is_empty())
    }

    /// The first `max` non-empty lines.
    ///
    /// Detection probes a WINDOW, not line one. Real transcripts open with
    /// whatever bookkeeping the producer wrote first — queued operations,
    /// attachments, a title — and a probe that reads only the first line
    /// concludes "unrecognised" on a file it can read perfectly well. That was
    /// a real bug, found by pointing the viewer at a real session rather than
    /// at the fixture written to match the parser.
    pub fn probe_lines(&self, max: usize) -> impl Iterator<Item = &str> {
        self.text
            .lines()
            .map(str::trim)
            .filter(|line| !line.is_empty())
            .take(max)
    }

    /// Companions whose relative name ends with `suffix`.
    pub fn companions_ending<'a>(
        &'a self,
        suffix: &'a str,
    ) -> impl Iterator<Item = &'a Companion> + 'a {
        self.companions
            .iter()
            .filter(move |companion| companion.name.ends_with(suffix))
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
    /// The producer version the session records, when it records one.
    fn detected_version(&self, _source: &SessionSource) -> Option<String> {
        None
    }
}

pub trait SessionAdapterExt {
    /// The dialect version the adapter read out of the session, when the format
    /// records one. Reported by `inspect` so a session written by a newer
    /// producer is visible as such rather than as a mystery parse difference.
    fn detected_version(&self, source: &SessionSource) -> Option<String>;
}

/// Every adapter compiled into this build, in preference order.
pub fn registry() -> Vec<Box<dyn SessionAdapter>> {
    vec![
        Box::new(adk::AdkAdapter),
        Box::new(claude_code::ClaudeCodeAdapter),
    ]
}

/// The ids `--format` accepts, for help text and error messages.
pub fn known_formats() -> Vec<(&'static str, &'static str)> {
    registry()
        .iter()
        .map(|adapter| (adapter.id(), adapter.label()))
        .collect()
}

/// Which adapter claimed a source, and how sure it was.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Selection {
    pub adapter_id: &'static str,
    pub label: &'static str,
    pub confidence: Confidence,
    pub version: Option<String>,
}

/// Choose an adapter without parsing.
///
/// Separated from [`parse`] so a frontend can report what it recognised even
/// when parsing then fails, which is the difference between "we do not support
/// this file" and "we support it and it is malformed".
pub fn select(source: &SessionSource) -> Result<Selection, Unsupported> {
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
        Some((confidence, adapter)) => Ok(Selection {
            adapter_id: adapter.id(),
            label: adapter.label(),
            confidence,
            version: adapter.detected_version(source),
        }),
        None => Err(Unsupported {
            path: source.path.clone(),
            tried: adapters.iter().map(|a| a.label()).collect(),
        }),
    }
}

/// Parse with a named adapter, bypassing detection.
///
/// The escape hatch for a session detection cannot place: better a developer
/// can say what it is than that the viewer refuses a file it could have read.
pub fn parse_as(
    source: &SessionSource,
    adapter_id: &str,
) -> Result<ViewerSession, Box<dyn std::error::Error>> {
    let adapters = registry();
    let adapter = adapters
        .iter()
        .find(|adapter| adapter.id() == adapter_id)
        .ok_or_else(|| {
            let known = known_formats()
                .iter()
                .map(|(id, _)| *id)
                .collect::<Vec<_>>()
                .join(", ");
            Box::new(Unknown {
                requested: adapter_id.to_string(),
                known,
            })
        })?;
    Ok(adapter.parse(source)?)
}

#[derive(Debug)]
pub struct Unknown {
    pub requested: String,
    pub known: String,
}

impl std::fmt::Display for Unknown {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "unknown format {:?} (known formats: {})",
            self.requested, self.known
        )
    }
}

impl std::error::Error for Unknown {}

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
    let selection = select(source)?;
    parse_as(source, selection.adapter_id)
}
