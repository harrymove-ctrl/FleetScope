//! Selecting a graph node, as an operation the host can test.
//!
//! # Why this is not in the browser crate
//!
//! `agent-viewer-web` only compiles for wasm32, so anything that lives there
//! cannot be covered by `cargo test --workspace`. Selection is the interaction
//! the product is judged on, so it lives here, beside the fold, where a host
//! test can drive it against a real folded session.
//!
//! # Why the shell may not do this itself
//!
//! The graph, the camera and hit-testing belong to the renderer. A shell that
//! decided which agent was selected and then told the renderer would be a
//! second answer, and the two would drift the first time a node stopped
//! existing. Everything here reads and writes the renderer's own selection, so
//! there is exactly one answer to "what is selected".

use zoetrope::state::{App, Camera};

/// The renderer's own id for the root node.
///
/// Upstream names the main node `main` regardless of what the session calls its
/// orchestrator; only the node's TITLE is rebranded. Every other id in this
/// system is a session agent id, so the root has two names and something has to
/// translate. That happens here, in Rust, so the shell never learns that the
/// renderer has a private vocabulary.
const MAIN_NODE: &str = "main";

/// What a selection request did. Every variant is a real outcome the caller
/// must be able to tell apart; none of them is an error.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum SelectionOutcome {
    /// The agent is now selected.
    Selected(String),
    /// The agent was already selected, so activating it again cleared it.
    Deselected(String),
    /// No node carries that id. Nothing was touched.
    ///
    /// This variant exists because `Flow::select_node` CLEARS the selection
    /// for an unknown id. Forwarding an unknown id would therefore destroy a
    /// good selection and report success, so unknown ids never reach it.
    Unknown,
}

impl SelectionOutcome {
    /// Whether the renderer's selection changed.
    pub fn changed(&self) -> bool {
        !matches!(self, SelectionOutcome::Unknown)
    }

    /// The agent now selected, if any.
    pub fn selected(&self) -> Option<&str> {
        match self {
            SelectionOutcome::Selected(id) => Some(id),
            _ => None,
        }
    }
}

/// One selectable node, as the RENDERER has it.
///
/// The id is the renderer's node id, which is what makes a DOM control
/// addressable to a real graph node rather than to a row of TypeScript data.
/// No position, size or camera value crosses this boundary: layout stays in
/// Rust, and a shell that received coordinates would be tempted to lay the
/// graph out again.
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
pub struct GraphNode {
    pub id: String,
    pub selected: bool,
}

/// The renderer node id that carries `agent_id`, if the graph has one.
fn node_id_for(app: &App, root_agent_id: Option<&str>, agent_id: &str) -> Option<String> {
    if app.flow.node(agent_id).is_some() {
        return Some(agent_id.to_owned());
    }
    // The root agent is on the graph under the renderer's own id.
    if root_agent_id == Some(agent_id) && app.flow.node(MAIN_NODE).is_some() {
        return Some(MAIN_NODE.to_owned());
    }
    None
}

/// The session agent id a renderer node id stands for.
fn agent_id_for(node_id: &str, root_agent_id: Option<&str>) -> String {
    match root_agent_id {
        Some(root) if node_id == MAIN_NODE => root.to_owned(),
        _ => node_id.to_owned(),
    }
}

/// The nodes the graph currently has, in the renderer's own order, named with
/// SESSION agent ids.
///
/// Reporting the renderer's `main` here instead would leave the root agent
/// permanently unselectable from the shell, because every other identifier the
/// shell holds — the agent list, an event's `agentId` — is a session id.
pub fn graph_nodes(app: &App, root_agent_id: Option<&str>) -> Vec<GraphNode> {
    app.flow
        .nodes()
        .map(|node| GraphNode {
            id: agent_id_for(&node.id, root_agent_id),
            selected: node.selected,
        })
        .collect()
}

/// Whether the graph has a node for this agent.
pub fn has_node(app: &App, root_agent_id: Option<&str>, agent_id: &str) -> bool {
    node_id_for(app, root_agent_id, agent_id).is_some()
}

/// The selected agent, as a SESSION agent id.
///
/// `App::selected_agent_id` answers with the renderer's node id, which is
/// `main` for the root. Callers outside the renderer must never see that.
pub fn selected_agent(app: &App, root_agent_id: Option<&str>) -> Option<String> {
    app.selected_agent_id()
        .map(|node_id| agent_id_for(&node_id, root_agent_id))
}

/// Select `agent_id`, or deselect it when it is already selected.
///
/// Activating the selected node again clears the selection, which is the
/// documented toggle: the rail control and the graph node are one control, and
/// a control that can only ever turn on is a trap for a keyboard user.
///
/// Selecting drops the camera to `Manual`. Follow re-selects the most recently
/// active agent on every status tick, so leaving Follow engaged would quietly
/// overwrite the operator's choice a moment after they made it.
pub fn select_agent(
    app: &mut App,
    root_agent_id: Option<&str>,
    agent_id: &str,
) -> SelectionOutcome {
    let Some(node_id) = node_id_for(app, root_agent_id, agent_id) else {
        return SelectionOutcome::Unknown;
    };

    if app.selected_agent_id().as_deref() == Some(node_id.as_str()) {
        clear_selection(app);
        return SelectionOutcome::Deselected(agent_id.to_owned());
    }

    app.flow.select_node(&node_id);
    app.detail_scroll = 0;
    app.detail_follow = true;
    app.camera = Camera::Manual;
    app.camera_glide = None;
    // Consumed by the next draw, which knows the post-split canvas width. The
    // camera moves to the node; it does not decide what is selected.
    app.pending_center = Some(node_id);
    SelectionOutcome::Selected(agent_id.to_owned())
}

/// Clear any selection. Returns whether there was one to clear.
///
/// Also drops a not-yet-consumed centre request: gliding towards a node the
/// operator just deselected would say the selection was still there.
pub fn clear_selection(app: &mut App) -> bool {
    let had = app.selected_agent_id().is_some();
    app.flow.clear_selection();
    app.detail_scroll = 0;
    app.detail_follow = true;
    app.pending_center = None;
    had
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{build_with_manifest, Playhead};
    use agent_viewer_core::adapter::SessionSource;
    use agent_viewer_core::project;
    use zoetrope::state::App;

    const FIXTURE: &str =
        include_str!("../../fleetscope-cli/tests/fixtures/gemini-multi-agent/session.jsonl");

    /// The same fixture the demo and the browser QA use, so a test here and an
    /// assertion there cannot describe different sessions.
    fn app() -> App {
        built().0
    }

    /// The app and its manifest, from the same fold.
    fn built() -> (App, crate::ViewerManifest) {
        let source = SessionSource::new(
            std::path::PathBuf::from("gemini-multi-agent/session.jsonl"),
            FIXTURE.to_owned(),
        );
        let projection = project(&source).expect("fixture projects");
        let root = projection.session.root().map(|agent| agent.label.clone());
        build_with_manifest(
            &projection.wire,
            &projection.session,
            1.0,
            Playhead::Edge,
            root.as_deref(),
        )
    }

    /// The session's own root agent id, which the renderer draws as `main`.
    const ROOT: &str = "coordinator";

    /// The graph node the browser QA drives. Named once, here, so the Rust and
    /// browser layers agree on which node the product is judged on.
    const TARGET: &str = "coordinator/hotel_search";

    #[test]
    fn the_graph_has_the_node_the_browser_test_drives() {
        let app = app();
        let nodes = graph_nodes(&app, Some(ROOT));
        assert!(
            nodes.iter().any(|node| node.id == TARGET),
            "fixture must contain {TARGET}, found {:?}",
            nodes.iter().map(|n| &n.id).collect::<Vec<_>>()
        );
    }

    /// The renderer calls the root node `main`. The rest of the system calls it
    /// by the session's own agent id, and a browser check that only ever drove
    /// a sub-agent would never have noticed the difference: the root agent's
    /// rail control was disabled and its 8 events unreachable.
    #[test]
    fn the_root_agent_is_a_selectable_node_under_its_session_id() {
        let mut app = app();
        assert!(
            has_node(&app, Some(ROOT), ROOT),
            "the root agent must be selectable by its session id"
        );
        assert_eq!(
            select_agent(&mut app, Some(ROOT), ROOT),
            SelectionOutcome::Selected(ROOT.to_owned())
        );
    }

    #[test]
    fn the_selected_root_reports_its_session_id_not_the_renderer_node_id() {
        let mut app = app();
        select_agent(&mut app, Some(ROOT), ROOT);
        // The renderer's own answer is its private id...
        assert_eq!(app.selected_agent_id().as_deref(), Some("main"));
        // ...and every caller outside the renderer sees the session's id.
        assert_eq!(selected_agent(&app, Some(ROOT)).as_deref(), Some(ROOT));
    }

    #[test]
    fn the_node_list_names_the_root_by_its_session_id() {
        let app = app();
        let ids: Vec<String> = graph_nodes(&app, Some(ROOT))
            .into_iter()
            .map(|node| node.id)
            .collect();
        assert!(ids.contains(&ROOT.to_owned()), "found {ids:?}");
        assert!(!ids.contains(&"main".to_owned()), "found {ids:?}");
    }

    #[test]
    fn the_root_node_toggles_off_like_any_other() {
        let mut app = app();
        select_agent(&mut app, Some(ROOT), ROOT);
        assert_eq!(
            select_agent(&mut app, Some(ROOT), ROOT),
            SelectionOutcome::Deselected(ROOT.to_owned())
        );
        assert!(selected_agent(&app, Some(ROOT)).is_none());
    }

    /// Without a root id there is nothing to translate, so `main` stays `main`
    /// rather than being renamed to a guess.
    #[test]
    fn no_root_id_means_no_translation() {
        let app = app();
        let ids: Vec<String> = graph_nodes(&app, None).into_iter().map(|n| n.id).collect();
        assert!(ids.contains(&"main".to_owned()), "found {ids:?}");
    }

    #[test]
    fn the_snapshot_reports_the_root_by_its_session_id() {
        let (mut app, manifest) = built();
        assert_eq!(manifest.root_agent_id(), Some(ROOT));
        select_agent(&mut app, manifest.root_agent_id(), ROOT);
        assert_eq!(
            crate::snapshot(&app, &manifest)
                .selected_agent_id
                .as_deref(),
            Some(ROOT)
        );
    }

    #[test]
    fn selecting_a_known_agent_changes_the_selection() {
        let mut app = app();
        assert_eq!(
            select_agent(&mut app, Some(ROOT), TARGET),
            SelectionOutcome::Selected(TARGET.to_owned())
        );
        assert_eq!(app.selected_agent_id().as_deref(), Some(TARGET));
    }

    #[test]
    fn exactly_one_node_reports_selected() {
        let mut app = app();
        select_agent(&mut app, Some(ROOT), TARGET);
        let selected: Vec<_> = graph_nodes(&app, Some(ROOT))
            .into_iter()
            .filter(|node| node.selected)
            .map(|node| node.id)
            .collect();
        assert_eq!(selected, vec![TARGET.to_owned()]);
    }

    #[test]
    fn selecting_an_unknown_agent_invents_no_selection() {
        let mut app = app();
        assert_eq!(
            select_agent(&mut app, Some(ROOT), "coordinator/not_an_agent"),
            SelectionOutcome::Unknown
        );
        assert!(app.selected_agent_id().is_none());
    }

    /// `Flow::select_node` clears the selection for an unknown id. If an
    /// unknown id ever reached it, a good selection would silently vanish and
    /// the caller would be told nothing happened.
    #[test]
    fn an_unknown_agent_does_not_destroy_a_good_selection() {
        let mut app = app();
        select_agent(&mut app, Some(ROOT), TARGET);
        assert_eq!(
            select_agent(&mut app, Some(ROOT), "coordinator/not_an_agent"),
            SelectionOutcome::Unknown
        );
        assert_eq!(app.selected_agent_id().as_deref(), Some(TARGET));
    }

    #[test]
    fn selecting_the_selected_agent_deselects_it() {
        let mut app = app();
        select_agent(&mut app, Some(ROOT), TARGET);
        assert_eq!(
            select_agent(&mut app, Some(ROOT), TARGET),
            SelectionOutcome::Deselected(TARGET.to_owned())
        );
        assert!(app.selected_agent_id().is_none());
    }

    #[test]
    fn clearing_reports_whether_there_was_a_selection() {
        let mut app = app();
        assert!(!clear_selection(&mut app), "nothing selected yet");
        select_agent(&mut app, Some(ROOT), TARGET);
        assert!(clear_selection(&mut app));
        assert!(app.selected_agent_id().is_none());
    }

    #[test]
    fn selecting_drops_follow_so_the_choice_is_not_overwritten() {
        let mut app = app();
        app.camera = Camera::Follow;
        select_agent(&mut app, Some(ROOT), TARGET);
        assert_eq!(app.camera, Camera::Manual);
        // A status tick is what would re-select the most recently active agent.
        app.status_tick();
        assert_eq!(app.selected_agent_id().as_deref(), Some(TARGET));
    }

    #[test]
    fn deselecting_drops_a_pending_centre() {
        let mut app = app();
        select_agent(&mut app, Some(ROOT), TARGET);
        assert_eq!(app.pending_center.as_deref(), Some(TARGET));
        select_agent(&mut app, Some(ROOT), TARGET);
        assert!(app.pending_center.is_none());
    }

    #[test]
    fn selection_does_not_move_the_playhead() {
        let mut app = app();
        let before = app.timeline.fold_target();
        let at_edge = app.timeline.at_edge();
        select_agent(&mut app, Some(ROOT), TARGET);
        clear_selection(&mut app);
        assert_eq!(app.timeline.fold_target(), before);
        assert_eq!(app.timeline.at_edge(), at_edge);
    }

    #[test]
    fn the_signal_reports_the_selected_agent_and_its_manifest_sequence() {
        let source = SessionSource::new(
            std::path::PathBuf::from("gemini-multi-agent/session.jsonl"),
            FIXTURE.to_owned(),
        );
        let projection = project(&source).expect("fixture projects");
        let root = projection.session.root().map(|agent| agent.label.clone());
        let (mut app, manifest) = build_with_manifest(
            &projection.wire,
            &projection.session,
            1.0,
            Playhead::Edge,
            root.as_deref(),
        );

        select_agent(&mut app, Some(ROOT), TARGET);
        let signal = crate::snapshot(&app, &manifest);
        assert_eq!(signal.selected_agent_id.as_deref(), Some(TARGET));
        // Whatever the playhead rests on, the sequence is the manifest's answer
        // for that entry, including an explicit `None` for a sidecar.
        assert_eq!(signal.sequence, manifest.sequence_at(signal.entry_index));

        clear_selection(&mut app);
        let cleared = crate::snapshot(&app, &manifest);
        assert!(cleared.selected_agent_id.is_none());
    }
}
