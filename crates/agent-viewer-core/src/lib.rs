//! FleetScope Agent Viewer — the portable projection core.
//!
//! ```text
//!   adapter::*        provider dialect → ViewerSession
//!        │
//!        ▼
//!   wire::compile     ViewerSession → renderer input
//!        │
//!        ├─► a frontend folds it into a graph
//!        └─► inspect::summary renders it as text
//! ```
//!
//! # Why this is its own crate
//!
//! The native command and the browser build must produce the SAME projection
//! from the same session. The cheap way to claim that is to write it twice and
//! test that the two agree; the honest way is to have one implementation and
//! give both frontends no other option. That is this crate.
//!
//! It therefore has no renderer dependency, no async runtime and no filesystem
//! access, so it compiles for the host and for `wasm32-unknown-unknown` alike.
//! Anything that needs IO lives in a frontend: `fleetscope-cli` owns discovery
//! and tailing, the browser crate owns file input.
//!
//! It is also NOT FleetScope's enterprise Canonical Event schema. That schema
//! describes a governed multi-week Case and lives in `packages/event-schema`.
//! The two meet at the platform boundary, not here.

pub mod adapter;
pub mod inspect;
pub mod viewer;
pub mod wire;

/// Detect, parse and compile one already-read session in one step.
///
/// The single entry point both frontends call. Takes text rather than a path
/// because this crate cannot read files, which is the point.
pub fn project(source: &adapter::SessionSource) -> Result<Projection, ProjectionError> {
    let selection = adapter::select(source).map_err(|error| ProjectionError(error.to_string()))?;
    project_as(source, selection.adapter_id)
}

/// Project with a named adapter, bypassing detection.
pub fn project_as(
    source: &adapter::SessionSource,
    adapter_id: &str,
) -> Result<Projection, ProjectionError> {
    let session = adapter::parse_as(source, adapter_id)
        .map_err(|error| ProjectionError(error.to_string()))?;
    let selection = adapter::select(source).ok();
    let wire = wire::compile(&session);
    Ok(Projection {
        session,
        wire,
        selection,
    })
}

/// A session and its compiled renderer input.
#[derive(Debug)]
pub struct Projection {
    pub session: viewer::ViewerSession,
    pub wire: wire::WireSession,
    /// What detection concluded, when it ran. `None` only when an adapter was
    /// named explicitly and detection would have refused the file.
    pub selection: Option<adapter::Selection>,
}

impl Projection {
    /// A stable fingerprint of the compiled output.
    ///
    /// Two builds that produce the same fingerprint from the same session are
    /// showing the same thing. Used to assert native/browser parity without
    /// needing a browser in the loop.
    pub fn fingerprint(&self) -> String {
        let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
        let mut absorb = |bytes: &[u8]| {
            for byte in bytes {
                hash ^= u64::from(*byte);
                hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
            }
        };
        absorb(self.wire.main.as_bytes());
        for sub in &self.wire.subagents {
            absorb(sub.agent_id.as_bytes());
            absorb(sub.meta.as_bytes());
            absorb(sub.transcript.as_bytes());
        }
        format!("{hash:016x}")
    }
}

/// Why a session could not be projected. A flat string because this crate has
/// no error-reporting opinion: each frontend presents it its own way.
#[derive(Debug)]
pub struct ProjectionError(pub String);

impl std::fmt::Display for ProjectionError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for ProjectionError {}
