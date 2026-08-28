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

pub mod adapter;
pub mod discover;
pub mod follow;
pub mod inspect;
pub mod scene;
pub mod viewer;
pub mod wire;

/// Read, detect, parse and compile one session file in one step.
pub fn load(path: &std::path::Path) -> Result<Loaded, Box<dyn std::error::Error>> {
    let source = adapter::SessionSource::read(path)?;
    let session = adapter::parse(&source)?;
    let wire = wire::compile(&session);
    Ok(Loaded { session, wire })
}

pub struct Loaded {
    pub session: viewer::ViewerSession,
    pub wire: wire::WireSession,
}
