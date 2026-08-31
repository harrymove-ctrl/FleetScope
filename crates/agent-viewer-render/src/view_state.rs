//! Shared playhead sidecar (`view.json`) applied by both the TUI and WASM.
//!
//! File IO lives in `fleetscope-cli`. This module is the parse/apply core so
//! native and browser cannot drift.

use zoetrope::state::{App, Camera};
use zoetrope::tailer::Update;

use crate::manifest::sequence_of;
use crate::selection::{clear_selection, reveal_agent, selected_agent};
use crate::ViewerManifest;

/// Sidecar schema version this build writes and accepts.
pub const VIEW_STATE_VERSION: u32 = 1;

/// `<session-dir>/view.json` — playhead, pause, selection, camera.
#[derive(Clone, Debug, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct ViewState {
    pub v: u32,
    /// Viewer event sequence (manifest `sequence`), not a timestamp.
    pub playhead: u64,
    pub paused: bool,
    #[serde(rename = "selectedAgent", default)]
    pub selected_agent: Option<String>,
    pub camera: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
    pub writer: String,
}

impl ViewState {
    /// Parse a sidecar body. Corrupt / wrong version → `None` (ignore once).
    pub fn parse(json: &str) -> Option<Self> {
        let state: Self = serde_json::from_str(json).ok()?;
        (state.v == VIEW_STATE_VERSION).then_some(state)
    }

    /// Capture the current viewer as a sidecar payload.
    pub fn capture(app: &App, manifest: &ViewerManifest, writer: &str, updated_at: i64) -> Self {
        Self {
            v: VIEW_STATE_VERSION,
            playhead: playhead_sequence(app, manifest).unwrap_or(0),
            paused: app.is_paused,
            selected_agent: selected_agent(app, manifest.root_agent_id()),
            camera: camera_name(app.camera).to_string(),
            updated_at,
            writer: writer.to_string(),
        }
    }

    /// Apply this sidecar to a live app. Seek is omitted when the playhead
    /// sequence is unknown locally (sidecar entry) and clamped to the live
    /// edge when it is past the local event count.
    pub fn apply(&self, app: &mut App, manifest: &ViewerManifest) {
        match fraction_for_playhead(app, manifest, self.playhead) {
            Some(fraction) => app.seek_to_fraction(fraction),
            None => app.seek_to_fraction(1.0),
        }
        app.set_paused(self.paused);
        match self.selected_agent.as_deref().filter(|id| !id.is_empty()) {
            Some(id) => {
                let _ = reveal_agent(app, manifest.root_agent_id(), id);
            }
            None => {
                clear_selection(app);
            }
        }
        apply_camera(app, &self.camera);
    }
}

fn camera_name(camera: Camera) -> &'static str {
    match camera {
        Camera::Overview => "overview",
        Camera::Follow => "follow",
        Camera::Manual => "manual",
    }
}

fn apply_camera(app: &mut App, camera: &str) {
    match camera {
        "overview" => {
            app.camera = Camera::Overview;
            app.camera_glide = None;
            app.flow.request_fit_view();
        }
        "follow" => {
            app.camera = Camera::Follow;
            app.follow_inspector = true;
            app.track_activity();
        }
        "manual" => {
            app.camera = Camera::Manual;
        }
        _ => {}
    }
}

/// Sequence the playhead rests on, walking backward past sidecar items.
pub fn playhead_sequence(app: &App, manifest: &ViewerManifest) -> Option<u64> {
    let idx = app.timeline.fold_target().saturating_sub(1);
    for i in (0..=idx).rev() {
        if let Some(sequence) = manifest.sequence_at(i).or_else(|| item_sequence(app, i)) {
            return Some(sequence);
        }
    }
    None
}

fn item_sequence(app: &App, renderer_index: usize) -> Option<u64> {
    match &app.timeline.items.get(renderer_index)?.update {
        Update::Entry { entry, .. } => sequence_of(entry),
        Update::SubagentMeta { .. } => None,
    }
}

/// Scrubber fraction for a viewer sequence. `None` if that event is not in
/// the local timeline (the other viewer is ahead).
pub fn fraction_for_playhead(app: &App, manifest: &ViewerManifest, sequence: u64) -> Option<f64> {
    if let Some(fraction) = manifest.fraction_for_sequence(sequence) {
        return Some(fraction);
    }
    let len = app.timeline.items.len();
    if len == 0 {
        return None;
    }
    for (index, item) in app.timeline.items.iter().enumerate() {
        let Update::Entry { entry, .. } = &item.update else {
            continue;
        };
        if sequence_of(entry) == Some(sequence) {
            if len == 1 {
                return Some(0.0);
            }
            return Some(index as f64 / (len - 1) as f64);
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{build_with_manifest, Playhead};
    use agent_viewer_core::adapter::SessionSource;
    use agent_viewer_core::project;

    const FIXTURE: &str =
        include_str!("../../fleetscope-cli/tests/fixtures/gemini-multi-agent/session.jsonl");

    fn built() -> (App, ViewerManifest) {
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

    #[test]
    fn parse_rejects_corrupt_and_wrong_version() {
        assert!(ViewState::parse("not json").is_none());
        assert!(ViewState::parse(
            r#"{"v":2,"playhead":0,"paused":false,"camera":"manual","updatedAt":1,"writer":"tui"}"#
        )
        .is_none());
    }

    #[test]
    fn capture_roundtrip_json_matches_the_sidecar_shape() {
        let (app, manifest) = built();
        let state = ViewState::capture(&app, &manifest, "tui", 1_756_571_844_375);
        let json = serde_json::to_value(&state).expect("serializes");
        assert_eq!(json["v"], 1);
        assert_eq!(json["writer"], "tui");
        assert_eq!(json["paused"], false);
        assert!(json["playhead"].is_number());
        assert!(json.get("selectedAgent").is_some());
        assert!(matches!(
            json["camera"].as_str(),
            Some("overview" | "follow" | "manual")
        ));
    }

    #[test]
    fn apply_seeks_pauses_and_selects() {
        let (mut app, manifest) = built();
        app.go_live();
        let sequence = playhead_sequence(&app, &manifest).expect("edge has a sequence");
        let state = ViewState {
            v: 1,
            playhead: sequence,
            paused: true,
            selected_agent: Some("coordinator/hotel_search".into()),
            camera: "manual".into(),
            updated_at: 10,
            writer: "web".into(),
        };
        state.apply(&mut app, &manifest);
        assert!(app.is_paused);
        assert_eq!(app.camera, Camera::Manual);
        assert_eq!(
            selected_agent(&app, manifest.root_agent_id()).as_deref(),
            Some("coordinator/hotel_search")
        );
    }

    #[test]
    fn apply_clamps_an_unknown_playhead_to_the_live_edge() {
        let (mut app, manifest) = built();
        app.seek_to_fraction(0.0);
        assert!(!app.timeline.at_edge());
        let state = ViewState {
            v: 1,
            playhead: 9_999_999,
            paused: true,
            selected_agent: None,
            camera: "overview".into(),
            updated_at: 10,
            writer: "web".into(),
        };
        state.apply(&mut app, &manifest);
        assert!(
            app.timeline.at_edge(),
            "past-the-end playhead clamps to edge"
        );
        assert!(app.is_paused, "clamp must not unpause");
    }
}
