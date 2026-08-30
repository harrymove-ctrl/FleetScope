//! The rendering proof: a viewer session folds into the graph it claims to.
//!
//! Host-testable on purpose. "The session really does render the agents and the
//! timeline FleetScope says it does" is machine-checked in an ordinary
//! `cargo test`, not discovered in a terminal or a browser.

use std::path::{Path, PathBuf};

use fleetscope_cli::scene::{self, Playhead};
use fleetscope_cli::viewer::ViewerSession;
use fleetscope_cli::wire::{self, WireSession};

fn fixture() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/gemini-multi-agent/session.jsonl")
}

fn loaded() -> (ViewerSession, WireSession) {
    let loaded = fleetscope_cli::load(&fixture()).expect("the fixture loads");
    (loaded.session, loaded.wire)
}

/// Every JSON key in the compiled output, main file and subagent files alike.
fn every_key(wire: &WireSession) -> Vec<String> {
    fn walk(value: &serde_json::Value, into: &mut Vec<String>) {
        match value {
            serde_json::Value::Object(map) => {
                for (key, nested) in map {
                    into.push(key.clone());
                    walk(nested, into);
                }
            }
            serde_json::Value::Array(items) => items.iter().for_each(|item| walk(item, into)),
            _ => {}
        }
    }

    let mut keys = Vec::new();
    let files = std::iter::once(wire.main.as_str())
        .chain(wire.subagents.iter().map(|sub| sub.transcript.as_str()))
        .chain(wire.subagents.iter().map(|sub| sub.meta.as_str()));
    for file in files {
        for line in file.lines().filter(|line| !line.trim().is_empty()) {
            let value: serde_json::Value = serde_json::from_str(line).expect("emitted valid JSON");
            walk(&value, &mut keys);
        }
    }
    keys
}

// ── What must never be emitted ──────────────────────────────────────────────

#[test]
fn no_line_carries_a_field_the_detail_panel_would_draw_as_reasoning() {
    // The renderer's panel draws `↳ prompt` and `↳ thought` rows from exactly
    // `prompt` and `thinking`. The adapter already discards reasoning parts and
    // the `render-provenance` feature is off in this crate; this asserts the
    // emitter never reintroduces them. Three independent controls, because
    // this is the one mistake that cannot be taken back once rendered.
    let (_, wire) = loaded();
    let keys = every_key(&wire);
    for forbidden in ["thinking", "thought", "prompt"] {
        assert!(
            !keys.iter().any(|key| key == forbidden),
            "the compiled session carries a {forbidden:?} field"
        );
    }
}

#[test]
fn every_emitted_line_is_valid_json() {
    let (_, wire) = loaded();
    // `every_key` parses every line and panics otherwise; calling it is the
    // assertion. The count guards against a silently empty compile.
    assert!(!every_key(&wire).is_empty());
    assert!(wire.line_count > 0);
}

// ── The join the graph depends on ───────────────────────────────────────────

#[test]
fn each_subagent_meta_points_at_a_spawn_in_the_main_transcript() {
    // The child node attaches to its parent through this id alone. If the two
    // sides ever disagree the graph silently loses a branch, so it is checked
    // rather than assumed.
    let (_, wire) = loaded();

    let spawn_ids: Vec<String> = wire
        .main
        .lines()
        .filter(|line| !line.trim().is_empty())
        .filter_map(|line| serde_json::from_str::<serde_json::Value>(line).ok())
        .flat_map(|line| {
            line["message"]["content"]
                .as_array()
                .map(|blocks| {
                    blocks
                        .iter()
                        .filter(|block| block["name"] == wire::SPAWN_TOOL)
                        .filter_map(|block| block["id"].as_str().map(str::to_string))
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default()
        })
        .collect();

    assert_eq!(
        spawn_ids.len(),
        wire.subagents.len(),
        "one spawn per subagent"
    );

    for sub in &wire.subagents {
        let meta: serde_json::Value = serde_json::from_str(&sub.meta).expect("meta is JSON");
        let tool_use_id = meta["toolUseId"].as_str().expect("meta names a spawn");
        assert!(
            spawn_ids.iter().any(|id| id == tool_use_id),
            "{} points at {tool_use_id}, which no spawn in the main transcript declares",
            sub.agent_id
        );
    }
}

#[test]
fn subagent_lines_are_tagged_with_their_agent() {
    // `agentId` is the renderer's join key for a subagent file. An untagged
    // line would be folded into the main node instead.
    let (_, wire) = loaded();
    for sub in &wire.subagents {
        for line in sub.transcript.lines().filter(|l| !l.trim().is_empty()) {
            let value: serde_json::Value = serde_json::from_str(line).unwrap();
            assert_eq!(value["agentId"], sub.agent_id.as_str());
            assert_eq!(value["isSidechain"], true);
        }
    }
}

#[test]
fn line_timestamps_are_strictly_increasing_across_files() {
    // Several events legitimately share a source second, and a subagent's lines
    // live in a different file from the main transcript. Without the ordering
    // suffix the merge order would be left to sort stability across files.
    let (_, wire) = loaded();
    let mut stamps: Vec<String> = std::iter::once(wire.main.as_str())
        .chain(wire.subagents.iter().map(|s| s.transcript.as_str()))
        .flat_map(|file| {
            file.lines()
                .filter(|l| !l.trim().is_empty())
                .map(|line| {
                    serde_json::from_str::<serde_json::Value>(line).unwrap()["timestamp"]
                        .as_str()
                        .unwrap()
                        .to_string()
                })
                .collect::<Vec<_>>()
        })
        .collect();
    let before = stamps.len();
    stamps.sort();
    stamps.dedup();
    assert_eq!(before, stamps.len(), "two lines share a timestamp");
}

// ── The fold ────────────────────────────────────────────────────────────────

#[test]
fn the_session_folds_into_the_renderer_with_every_agent_present() {
    let (session, wire) = loaded();
    let app = scene::build(&wire, &session, 1.0, Playhead::Edge, None);

    assert!(
        scene::folded_len(&app) > 0,
        "the timeline folded nothing at all"
    );

    // Every non-root agent must exist as a node. The renderer keys them by the
    // same id the adapter assigned.
    for agent in &session.agents {
        if agent.is_root() {
            continue;
        }
        assert!(
            app.session.agent(&agent.id).is_some(),
            "{} is missing from the rendered graph",
            agent.id
        );
    }
}

#[test]
fn a_finished_session_opens_parked_at_its_outcome() {
    let (session, wire) = loaded();
    let app = scene::build(&wire, &session, 1.0, Playhead::Edge, None);
    assert!(
        app.timeline.at_edge(),
        "a recording opened with --follow must show the end, not the beginning"
    );
}

#[test]
fn seeking_moves_the_playhead_off_the_edge_and_returning_puts_it_back() {
    // Transport state is derived from the playhead and the live edge rather
    // than from a mode flag, so this is the whole pause/seek/return contract.
    let (session, wire) = loaded();
    let mut app = scene::build(&wire, &session, 1.0, Playhead::Edge, None);

    app.seek_to_fraction(0.0);
    assert!(
        !app.timeline.at_edge(),
        "seeking to the start left the edge"
    );

    app.go_live();
    assert!(
        app.timeline.at_edge(),
        "returning to live re-parked at the edge"
    );
}

#[test]
fn a_session_that_fits_the_graph_is_not_reported_as_flattened() {
    // The fixture is root plus three children, which is exactly the depth the
    // renderer draws. Reporting a flatten here would be a false warning.
    let (_, wire) = loaded();
    assert!(!wire.flattened);
    assert_eq!(wire::flatten_note(&wire), None);
}

#[test]
fn a_deeper_tree_is_flattened_and_says_so() {
    // The renderer's graph is one level deep: a subagent's parent is the main
    // node. A deeper session still loads, still shows every agent, and keeps
    // its real path in the label — but the viewer must admit what it did.
    let deep = fleetscope_cli::adapter::parse(&fleetscope_cli::adapter::SessionSource::new(
        PathBuf::from("deep.jsonl"),
        [
            r#"{"id":"1","invocationId":"i","author":"root","timestamp":1.0,"content":{"role":"model","parts":[{"text":"go"}]}}"#,
            r#"{"id":"2","invocationId":"i","author":"leaf","branch":"root.mid.leaf","timestamp":2.0,"content":{"role":"model","parts":[{"text":"deep"}]}}"#,
        ]
        .join("\n"),
    ))
    .expect("parses");

    let wire = wire::compile(&deep);
    assert!(wire.flattened);
    let note = wire::flatten_note(&wire).expect("a flattened session explains itself");
    assert!(note.contains("one level deep"), "got: {note}");

    // Flattened, but not lost: the node is still there and still named by path.
    let app = scene::build(&wire, &deep, 1.0, Playhead::Edge, None);
    assert!(app.session.agent("root/mid/leaf").is_some());
}

// ── Native / browser parity ─────────────────────────────────────────────────

#[test]
fn the_fixture_projects_to_a_stable_fingerprint() {
    // The browser frontend compiles the same core to wasm and prints this same
    // value for this same session. Pinning it here means a change that would
    // make the two frontends disagree fails in `cargo test`, on a laptop,
    // instead of being noticed in a browser or not at all.
    //
    // If this value changes, the projection changed. That is allowed — update
    // it deliberately, and know that every frontend now shows something new.
    let projection = fleetscope_cli::load(&fixture()).expect("loads");
    assert_eq!(projection.fingerprint(), "2850b12b0760257f");
}

#[test]
fn the_fingerprint_follows_the_session_and_not_the_run() {
    // Same input, same value, every time: otherwise it proves nothing.
    let first = fleetscope_cli::load(&fixture())
        .expect("loads")
        .fingerprint();
    let second = fleetscope_cli::load(&fixture())
        .expect("loads")
        .fingerprint();
    assert_eq!(first, second);
}
