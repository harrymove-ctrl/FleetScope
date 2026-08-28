//! FleetScope Agent Viewer — the local, CLI-first core.
//!
//! # Shape
//!
//! ```text
//! local session file
//!        │
//!        ▼
//!   adapter::*        provider dialect → ViewerSession   (IO-free)
//!        │
//!        ▼
//!   wire::compile     ViewerSession → renderer input     (IO-free)
//!        │
//!        ├─► scene::build   → the TUI / browser graph
//!        └─► inspect::summary → headless text
//! ```
//!
//! `discover` and `follow` are the only modules that touch the filesystem, and
//! `scene` is the only one that touches the renderer. Everything between them is
//! pure, which is what lets the same projection serve the native terminal and,
//! in phase 2, the browser build.

// The projection itself lives in `agent-viewer-core`, which has no renderer,
// no runtime and no filesystem so the browser build can compile the identical
// code. Re-exported here so this crate reads as one viewer rather than two.
pub use agent_viewer_core::{adapter, inspect, viewer, wire};
pub use agent_viewer_core::{Projection, ProjectionError};

/// The fold into the rendering substrate, shared with the browser build.
pub use agent_viewer_render as scene;

pub mod discover;
pub mod follow;

/// Read a session file from disk and project it.
///
/// The only thing this adds over [`agent_viewer_core::project`] is the read:
/// filesystem access is a frontend responsibility, and this is the frontend.
pub fn load(path: &std::path::Path) -> Result<Loaded, Box<dyn std::error::Error>> {
    let source = discover::read_source(path)?;
    Ok(agent_viewer_core::project(&source)?)
}

/// Kept as an alias so call sites read as "loaded from disk" rather than
/// "projected", which is what they mean here.
pub type Loaded = Projection;
