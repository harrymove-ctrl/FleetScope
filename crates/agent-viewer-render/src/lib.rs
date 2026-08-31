//! Folding a compiled session into the rendering substrate.
//!
//! Thin on purpose: the fold, the timeline engine, the graph projection and the
//! camera belong to the vendored core and stay unmodified, so its upstream tests
//! keep their meaning. What lives here is which artifacts make up a scene and
//! how the playhead is parked when the viewer opens.
//!
//! # Why this is a crate and not a module
//!
//! Both frontends need this fold, and neither can depend on the other: the
//! terminal frontend pulls an async runtime and the filesystem, the browser
//! frontend can only be compiled for wasm32. Putting the fold here means there
//! is one of it. It depends on the substrate's PORTABLE core, so it builds for
//! the host and for wasm32 alike.

use zoetrope::state::{App, Camera, Mode};
use zoetrope::tailer::{replay_from_session, DemoSubagent, UiEvent};
use zoetrope::ui::brand::{set_branding, Branding};

use agent_viewer_core::viewer::ViewerSession;
use agent_viewer_core::wire::WireSession;

pub mod manifest;
pub mod selection;
pub mod view_state;
pub use manifest::{ViewerManifest, ViewerManifestEntry, ViewerManifestItemKind};
pub use selection::{
    clear_selection, graph_nodes, has_node, reveal_agent, select_agent, selected_agent, GraphNode,
    SelectionOutcome,
};
pub use view_state::ViewState;

/// The wordmark the renderer draws in the status bar and help overlay.
const PRODUCT: &str = "FleetScope";

/// Set the process-wide product wordmark without putting session identity in
/// process-global state. The main-agent value is only a fallback; each built
/// app receives its own recorded root label below.
fn product_branding() -> Branding {
    Branding {
        product: PRODUCT,
        main_agent: "root",
    }
}

/// How the viewer opens.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Playhead {
    /// Park at the live edge. A finished recording opens showing its outcome.
    Edge,
    /// Start at the beginning and play forward at `speed`.
    Start,
}

/// Build the renderer app and the manifest that explains its timeline.
///
/// `root_label` names the main node. Pass the root agent's own label so the
/// graph calls it what the session called it.
///
/// The manifest is recorded from the SAME fold the app is built from, so the
/// two can never describe different timelines. Building it from a second fold
/// would reintroduce exactly the drift it exists to remove.
pub fn build_with_manifest(
    wire: &WireSession,
    session: &ViewerSession,
    speed: f64,
    playhead: Playhead,
    root_label: Option<&str>,
) -> (App, ViewerManifest) {
    // Idempotent (`OnceLock` behind the scenes). Only the product wordmark is
    // global; the root agent belongs to the session being loaded.
    set_branding(product_branding());

    let subagents: Vec<DemoSubagent<'_>> = wire
        .subagents
        .iter()
        .map(|sub| DemoSubagent {
            agent_id: &sub.agent_id,
            meta: &sub.meta,
            transcript: &sub.transcript,
            workflow: None,
            journal: false,
        })
        .collect();

    let (items, info) = replay_from_session(&wire.main, &subagents);
    // Recorded before `items` is handed to the app, which consumes it.
    let manifest = ViewerManifest::build(&items, session);

    let mut app = App::new(wire.session_id.clone(), Mode::Replay);
    app.handle_ui_event(UiEvent::ReplayLoaded {
        session_id: wire.session_id.clone(),
        items,
        speed,
        info,
    });

    if let Some(label) = root_label.filter(|label| !label.is_empty()) {
        if let Some(main) = app
            .session
            .agents
            .get_mut(zoetrope::state::session::MAIN_ID)
        {
            main.agent_type = Some(label.to_owned());
        }
        if let Some(node) = app.flow.node_content_mut(zoetrope::state::session::MAIN_ID) {
            node.title = label.to_owned();
        }
    }

    if playhead == Playhead::Edge {
        app.go_live();
        // `--follow` narrates: the first frame's Follow tick centers the last
        // agent and opens the inspector. Do not select here — build-time
        // selection would make every test start with a panel already open.
        app.camera = Camera::Follow;
        app.follow_inspector = true;
    }
    (app, manifest)
}

/// The app alone, for callers that never address an event by identity.
///
/// The terminal frontend is one: it drives the graph through the renderer's own
/// keyboard handling and has no need to name an event.
pub fn build(
    wire: &WireSession,
    session: &ViewerSession,
    speed: f64,
    playhead: Playhead,
    root_label: Option<&str>,
) -> App {
    build_with_manifest(wire, session, speed, playhead, root_label).0
}

/// How many renderer entries the timeline folded.
///
/// Not the same number as [`WireSession::line_count`]: the renderer merges a
/// tool call and its result into one timeline item, so this is the authority on
/// what the scrubber actually traverses.
pub fn folded_len(app: &App) -> usize {
    app.timeline.items.len()
}

/// Where the playhead sits and what that means, in the substrate's own units.
///
/// Transport is DERIVED from the playhead and the live edge, never stored. A
/// mode flag captured at launch is the thing that produces a viewer you cannot
/// get out of, so there is no such flag to capture.
#[derive(Clone, Debug, PartialEq, serde::Serialize)]
pub struct ViewerSnapshot {
    #[serde(rename = "entryIndex")]
    pub entry_index: usize,
    #[serde(rename = "entryCount")]
    pub entry_count: usize,
    #[serde(rename = "atEdge")]
    pub at_edge: bool,
    pub transport: &'static str,
    /// The renderer's own selection, always present.
    ///
    /// Serialized even when absent, as an explicit `null`. Omitting the field
    /// would make "nothing is selected" indistinguishable from "this build does
    /// not report selection", and a shell cannot tell those apart.
    #[serde(rename = "selectedAgentId")]
    pub selected_agent_id: Option<String>,
    /// Explicit pause flag. Transport already distinguishes paused/history/live;
    /// pairing needs the boolean itself so a sidecar can set pause without
    /// toggling.
    pub paused: bool,
    /// The viewer event the playhead rests on, resolved through the manifest.
    ///
    /// `None` is a real answer: the playhead may be sitting on a sub-agent
    /// sidecar, which is renderer state that came from no event. Callers must
    /// show "no event here" rather than the nearest one, and there is
    /// deliberately no second identifier alongside this: `sequence` is the only
    /// event key in the system.
    pub sequence: Option<u64>,
}

pub fn snapshot(app: &App, manifest: &ViewerManifest) -> ViewerSnapshot {
    use zoetrope::state::Transport;
    // `fold_target` is a COUNT of folded items; the index of the last one is
    // that count minus one.
    let entry_index = app.timeline.fold_target().saturating_sub(1);
    ViewerSnapshot {
        sequence: manifest.sequence_at(entry_index),
        entry_index,
        entry_count: app.timeline.items.len(),
        at_edge: app.timeline.at_edge(),
        paused: app.is_paused,
        transport: match app.transport() {
            Transport::Live => "live",
            Transport::Playing => "playing",
            Transport::Paused => "paused",
            Transport::History => "history",
            Transport::Idle => "idle",
        },
        // The SESSION agent id, not the renderer's node id: the root node is
        // called `main` inside the renderer and nothing outside it knows that.
        selected_agent_id: selection::selected_agent(app, manifest.root_agent_id()),
    }
}
