//! The ingestion proof: a local Gemini/ADK session becomes a viewer session.
//!
//! These run on the host with no terminal, no network and no API key, which is
//! the same claim the CLI makes to its user.

use std::path::{Path, PathBuf};

use fleetscope_cli::adapter::{self, Confidence, SessionAdapter, SessionSource};
use fleetscope_cli::viewer::{Payload, Terminal};

fn fixture_path() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/gemini-multi-agent/session.jsonl")
}

fn source() -> SessionSource {
    SessionSource::read(&fixture_path()).expect("fixture is readable")
}

fn session() -> fleetscope_cli::viewer::ViewerSession {
    adapter::parse(&source()).expect("the fixture parses")
}

// ── Detection ───────────────────────────────────────────────────────────────

#[test]
fn the_adk_dialect_is_recognised_outright() {
    // `branch` / `invocationId` / `content.parts` are ADK's own. Recognising the
    // file on a discriminating field rather than on shape is what stops a
    // different provider's log being drawn as a confident, wrong graph.
    assert_eq!(adapter::adk::AdkAdapter.detect(&source()), Confidence::Yes);
}

#[test]
fn an_unrelated_json_log_is_refused_rather_than_guessed_at() {
    let unrelated = SessionSource {
        path: PathBuf::from("app.log.jsonl"),
        text: "{\"level\":\"info\",\"msg\":\"listening on 8080\"}\n".to_string(),
    };
    assert_eq!(adapter::adk::AdkAdapter.detect(&unrelated), Confidence::No);
    let error = adapter::parse(&unrelated).expect_err("must not be parsed");
    assert!(
        error.to_string().contains("not a session format"),
        "the error must name the problem, got: {error}"
    );
}

#[test]
fn both_envelopes_produce_the_same_session() {
    // A Google ADK `Session` dump wraps the events in an object; a streamed
    // Antigravity-style log writes them one per line. They are the same records
    // and a developer should not need to know which their runner chose.
    let streamed = session();

    let events: Vec<serde_json::Value> = source()
        .text
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| serde_json::from_str(line).unwrap())
        .collect();
    let wrapped = SessionSource {
        path: PathBuf::from("wrapped.json"),
        text: serde_json::json!({ "id": "inv-1", "events": events }).to_string(),
    };

    let wrapped = adapter::parse(&wrapped).expect("the wrapped envelope parses");
    assert_eq!(wrapped.agents, streamed.agents);
    assert_eq!(wrapped.events, streamed.events);
}

#[test]
fn snake_case_field_names_are_accepted() {
    // The Python SDK emits camelCase or snake_case depending on `by_alias`.
    // Both are in the wild, so both must load.
    let snake = SessionSource {
        path: PathBuf::from("snake.jsonl"),
        text: concat!(
            r#"{"id":"a","invocation_id":"inv-9","author":"root","timestamp":1787907600.0,"#,
            r#""content":{"role":"model","parts":[{"function_call":{"id":"c1","name":"lookup","args":{}}}]}}"#,
            "\n",
            r#"{"id":"b","invocation_id":"inv-9","author":"root","branch":"root.child","#,
            r#""timestamp":1787907601.0,"turn_complete":true,"#,
            r#""content":{"role":"model","parts":[{"text":"done"}]}}"#,
        )
        .to_string(),
    };
    let parsed = adapter::parse(&snake).expect("snake_case parses");
    assert_eq!(parsed.session_id, "inv-9");
    assert!(
        parsed.agent("root/child").is_some(),
        "branch built the child"
    );
}

// ── The agent tree ──────────────────────────────────────────────────────────

#[test]
fn the_branch_path_builds_the_agent_tree() {
    let session = session();
    assert_eq!(session.agents.len(), 4);

    let root = session.root().expect("a root agent");
    assert_eq!(root.id, "coordinator");

    let mut children: Vec<&str> = session
        .children_of("coordinator")
        .map(|agent| agent.id.as_str())
        .collect();
    children.sort_unstable();
    assert_eq!(
        children,
        [
            "coordinator/flight_search",
            "coordinator/hotel_search",
            "coordinator/itinerary_writer"
        ]
    );
}

#[test]
fn the_same_author_under_two_parents_stays_two_nodes() {
    // Identity is the branch path, not the author. Collapsing these would merge
    // two independent agents into one node and average their state.
    let text = [
        r#"{"id":"1","invocationId":"i","author":"root","timestamp":1.0,"content":{"role":"model","parts":[{"text":"go"}]}}"#,
        r#"{"id":"2","invocationId":"i","author":"search","branch":"root.alpha.search","timestamp":2.0,"content":{"role":"model","parts":[{"text":"a"}]}}"#,
        r#"{"id":"3","invocationId":"i","author":"search","branch":"root.beta.search","timestamp":3.0,"content":{"role":"model","parts":[{"text":"b"}]}}"#,
    ]
    .join("\n");
    let parsed = adapter::parse(&SessionSource {
        path: PathBuf::from("two.jsonl"),
        text,
    })
    .expect("parses");

    assert!(parsed.agent("root/alpha/search").is_some());
    assert!(parsed.agent("root/beta/search").is_some());
    // Ancestors named only by a branch are declared too, so the tree connects.
    assert!(parsed.agent("root/alpha").is_some());
    assert!(parsed.agent("root/beta").is_some());
}

// ── What must never be rendered ─────────────────────────────────────────────

#[test]
fn model_reasoning_never_reaches_the_viewer() {
    // The fixture's coordinator emits a `thought: true` part. It is dropped at
    // ingestion, before it can reach a label, a node or a detail panel.
    let session = session();
    let leaked: Vec<&str> = session
        .events
        .iter()
        .filter_map(|event| match &event.payload {
            Payload::Message { text, .. } => Some(text.as_str()),
            _ => None,
        })
        .filter(|text| text.contains("I should fan out"))
        .collect();
    assert!(
        leaked.is_empty(),
        "a thought part reached the viewer: {leaked:?}"
    );
}

// ── Ground truth over inference ─────────────────────────────────────────────

#[test]
fn terminal_state_comes_only_from_what_the_session_recorded() {
    let session = session();
    assert_eq!(
        session.terminal_for("coordinator/flight_search"),
        Some(Terminal::Completed),
        "turnComplete is an explicit completion"
    );
    assert_eq!(
        session.terminal_for("coordinator/hotel_search"),
        Some(Terminal::Failed),
        "errorCode is an explicit failure"
    );
}

#[test]
fn an_agent_that_never_reported_reads_as_unknown_not_as_success() {
    let text = [
        r#"{"id":"1","invocationId":"i","author":"root","timestamp":1.0,"content":{"role":"model","parts":[{"text":"start"}]}}"#,
        r#"{"id":"2","invocationId":"i","author":"worker","branch":"root.worker","timestamp":2.0,"content":{"role":"model","parts":[{"functionCall":{"id":"c1","name":"fetch","args":{}}}]}}"#,
    ]
    .join("\n");
    let parsed = adapter::parse(&SessionSource {
        path: PathBuf::from("stuck.jsonl"),
        text,
    })
    .expect("parses");

    assert_eq!(
        parsed.terminal_for("root/worker"),
        None,
        "silence must stay silence"
    );
    assert_eq!(parsed.unanswered_calls("root/worker").len(), 1);
}

#[test]
fn a_tool_call_with_no_result_is_reported_as_unanswered() {
    // The fixture's second hotel search never returns. That is what a stuck
    // agent looks like and it must be visible, not smoothed over.
    let session = session();
    let unanswered = session.unanswered_calls("coordinator/hotel_search");
    assert_eq!(unanswered.len(), 1);
    match &unanswered[0].payload {
        Payload::ToolCall { call_id, tool, .. } => {
            assert_eq!(call_id, "fc-hotels-2");
            assert_eq!(tool, "search_hotels");
        }
        other => panic!("expected a tool call, got {other:?}"),
    }
}

#[test]
fn a_conventional_error_response_is_recognised() {
    let session = session();
    assert_eq!(session.error_count("coordinator/hotel_search"), 2);
    assert_eq!(session.error_count("coordinator/flight_search"), 0);
}

#[test]
fn an_unrecognised_response_shape_is_a_success_not_a_failure() {
    // Drawing a healthy call as failed is the more misleading of the two
    // mistakes, so the error probe is deliberately conservative.
    let text = concat!(
        r#"{"id":"1","invocationId":"i","author":"root","timestamp":1.0,"#,
        r#""content":{"role":"model","parts":[{"functionCall":{"id":"c1","name":"f","args":{}}}]}}"#,
        "\n",
        r#"{"id":"2","invocationId":"i","author":"root","timestamp":2.0,"#,
        r#""content":{"role":"user","parts":[{"functionResponse":{"id":"c1","name":"f","response":{"rows":3}}}]}}"#,
    );
    let parsed = adapter::parse(&SessionSource {
        path: PathBuf::from("ok.jsonl"),
        text: text.to_string(),
    })
    .expect("parses");
    assert_eq!(parsed.error_count("root"), 0);
}

#[test]
fn streaming_fragments_are_not_folded_twice() {
    // `partial: true` events repeat text the final event also carries.
    let text = [
        r#"{"id":"1","invocationId":"i","author":"root","timestamp":1.0,"partial":true,"content":{"role":"model","parts":[{"text":"hel"}]}}"#,
        r#"{"id":"2","invocationId":"i","author":"root","timestamp":2.0,"content":{"role":"model","parts":[{"text":"hello"}]}}"#,
    ]
    .join("\n");
    let parsed = adapter::parse(&SessionSource {
        path: PathBuf::from("partial.jsonl"),
        text,
    })
    .expect("parses");
    assert_eq!(parsed.events.len(), 1);
}

#[test]
fn a_malformed_line_names_its_line_number() {
    let text = "{\"author\":\"root\",\"branch\":\"root\"}\nnot json\n";
    let error = adapter::adk::AdkAdapter
        .parse(&SessionSource {
            path: PathBuf::from("bad.jsonl"),
            text: text.to_string(),
        })
        .expect_err("must fail");
    assert!(
        error.to_string().starts_with("line 2:"),
        "a viewer that says only \"parse error\" is useless on a long log, got: {error}"
    );
}
