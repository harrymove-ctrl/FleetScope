//! The second provider, and the proof that the ingestion boundary is real.
//!
//! Nothing outside `adapter/` changed to gain this format: the viewer model,
//! the wire emitter, `inspect` and both frontends are the same code the ADK
//! adapter feeds. These tests assert the behaviours that are easy to lose when
//! a second dialect arrives.

use std::path::{Path, PathBuf};

use fleetscope_cli::adapter::{self, Confidence, SessionAdapter, SessionSource};
use fleetscope_cli::discover;
use fleetscope_cli::viewer::{Payload, Terminal};

fn dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/claude-code-session")
}

fn main_file() -> PathBuf {
    dir().join("session-demo.jsonl")
}

fn source() -> SessionSource {
    discover::read_source(&main_file()).expect("fixture is readable")
}

fn projection() -> fleetscope_cli::Projection {
    fleetscope_cli::load(&main_file()).expect("the fixture projects")
}

// ── Detection is mutually exclusive ─────────────────────────────────────────

#[test]
fn the_dialect_is_recognised_and_the_other_adapter_declines_it() {
    // Two adapters that both said "maybe" would make the choice depend on
    // registry order, which is not a property anyone should have to reason
    // about. Each declines the other outright.
    assert_eq!(
        adapter::claude_code::ClaudeCodeAdapter.detect(&source()),
        Confidence::Yes
    );
    assert_eq!(
        adapter::adk::AdkAdapter.detect(&source()),
        Confidence::No,
        "the ADK adapter must not claim this dialect"
    );

    let adk = discover::read_source(
        &Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("tests/fixtures/gemini-multi-agent/session.jsonl"),
    )
    .unwrap();
    assert_eq!(
        adapter::claude_code::ClaudeCodeAdapter.detect(&adk),
        Confidence::No,
        "this adapter must not claim an ADK session"
    );
}

#[test]
fn the_producer_version_is_reported() {
    // A session written by a newer producer should be visible as such, rather
    // than surfacing later as an unexplained parse difference.
    let selection = adapter::select(&source()).expect("recognised");
    assert_eq!(selection.version.as_deref(), Some("2.0.14"));
    assert_eq!(selection.confidence, Confidence::Yes);
}

// ── Companion files ─────────────────────────────────────────────────────────

#[test]
fn the_sub_agent_tree_beside_the_transcript_is_read() {
    // The format writes one main file plus a directory of per-agent files. A
    // reader that only opened the main file would show the spawn and none of
    // the work it did.
    let source = source();
    assert!(
        source
            .companions
            .iter()
            .any(|c| c.name.ends_with("agent-aa11.jsonl")),
        "the companion transcript was not collected: {:?}",
        source
            .companions
            .iter()
            .map(|c| &c.name)
            .collect::<Vec<_>>()
    );

    let session = projection().session;
    // Keyed by the in-file `agentId`, not by the `agent-` filename prefix.
    let sub = session.agent("aa11").expect("the sub-agent is in the tree");
    // The label comes from the sidecar, not from the id.
    assert_eq!(sub.label, "security-reviewer");
    assert_eq!(sub.parent_id.as_deref(), Some("main"));
    assert_eq!(session.events_for("aa11").count(), 4);
}

// ── Ground truth over inference ─────────────────────────────────────────────

#[test]
fn a_sub_agent_completes_because_its_spawn_was_answered() {
    // The terminal fact is the `tool_result` that answered the spawn, recorded
    // in the main transcript. Not a timeout, not "it stopped producing lines".
    assert_eq!(
        projection().session.terminal_for("aa11"),
        Some(Terminal::Completed)
    );
}

#[test]
fn the_root_reads_as_unknown_because_the_session_never_said_it_finished() {
    let session = projection().session;
    assert_eq!(session.terminal_for("main"), None);

    let text = fleetscope_cli::inspect::summary(&projection());
    assert!(
        text.contains("main [no terminal event recorded]"),
        "silence must be reported as silence:\n{text}"
    );
}

#[test]
fn a_failed_result_names_the_tool_that_failed() {
    // A `tool_result` does not repeat the tool's name, but the call did.
    // Reporting a failed `Edit` as a failed "tool" throws away the one detail
    // that makes it actionable.
    let text = fleetscope_cli::inspect::summary(&projection());
    assert!(
        text.contains("✗ Edit:"),
        "the failing tool must be named:\n{text}"
    );
}

// ── What must never be rendered ─────────────────────────────────────────────

#[test]
fn reasoning_is_dropped_from_both_the_main_and_the_sub_agent_transcript() {
    let session = projection().session;
    let messages: Vec<&str> = session
        .events
        .iter()
        .filter_map(|event| match &event.payload {
            Payload::Message { text, .. } => Some(text.as_str()),
            _ => None,
        })
        .collect();
    for leaked in ["The user probably means", "that is where timing bugs live"] {
        assert!(
            !messages.iter().any(|text| text.contains(leaked)),
            "a thinking block reached the viewer: {leaked:?}"
        );
    }
}

#[test]
fn a_spawn_prompt_is_never_carried_into_the_projection() {
    // The spawn's `input.prompt` is a prompt. The detail panel would draw it.
    let projection = projection();
    let forbidden = "You are a security reviewer";

    assert!(
        !projection.wire.main.contains(forbidden),
        "the spawn prompt reached the compiled main transcript"
    );
    for sub in &projection.wire.subagents {
        assert!(!sub.transcript.contains(forbidden) && !sub.meta.contains(forbidden));
    }
    // The description is kept: it says what the agent was for, not what it was told.
    assert!(projection.wire.main.contains("Audit packages/auth"));
}

// ── The boundary is additive ────────────────────────────────────────────────

#[test]
fn both_providers_project_through_the_same_core() {
    // Different dialects, different adapter ids, one projection pipeline. This
    // is the whole claim of the ingestion boundary.
    let adk = fleetscope_cli::load(
        &Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("tests/fixtures/gemini-multi-agent/session.jsonl"),
    )
    .expect("adk projects");
    let native = projection();

    assert_eq!(adk.session.adapter_id, "google-adk@1");
    assert_eq!(native.session.adapter_id, "claude-code@1");
    // Both produce a renderable scene, and the fingerprints differ because the
    // sessions differ, not because the pipeline does.
    assert!(adk.wire.line_count > 0 && native.wire.line_count > 0);
    assert_ne!(adk.fingerprint(), native.fingerprint());
}

// ── Explicit format selection ───────────────────────────────────────────────

#[test]
fn a_format_can_be_forced_when_detection_would_refuse() {
    // The escape hatch: better a developer can say what a file is than that the
    // viewer refuses one it could have read.
    let ambiguous = SessionSource::new(
        PathBuf::from("odd.jsonl"),
        r#"{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"hi"}]}}"#
            .to_string(),
    );
    let forced = agent_viewer_core::project_as(&ambiguous, "claude-code@1")
        .expect("the named adapter is used regardless of detection");
    assert_eq!(forced.session.adapter_id, "claude-code@1");
}

#[test]
fn an_unknown_format_lists_the_ones_that_exist() {
    let error = agent_viewer_core::project_as(&source(), "nope@1")
        .expect_err("an unknown format must fail");
    let message = error.to_string();
    assert!(message.contains("nope@1"), "got: {message}");
    for (id, _) in adapter::known_formats() {
        assert!(message.contains(id), "the error must list {id}: {message}");
    }
}

// ── Regressions found by pointing the viewer at real sessions ───────────────
//
// Every one of these passed against a fixture written to match the parser and
// failed against a real session on disk. They are kept as tests because the
// fixture alone would not have caught any of them.

#[test]
fn detection_survives_a_file_that_opens_with_bookkeeping_lines() {
    // A real transcript began with two `queue-operation` lines and two
    // `attachment` lines before the first message. Probing only line one
    // concluded "unrecognised" on a file that reads perfectly.
    let noisy = SessionSource::new(
        PathBuf::from("noisy.jsonl"),
        [
            r#"{"type":"queue-operation","sessionId":"s1","operation":"enqueue"}"#,
            r#"{"type":"attachment","uuid":"x1","parentUuid":null,"sessionId":"s1"}"#,
            r#"{"type":"user","uuid":"u1","parentUuid":"x1","sessionId":"s1","timestamp":"2026-08-28T09:00:00Z","message":{"role":"user","content":"go"}}"#,
        ]
        .join("\n"),
    );
    assert_eq!(
        adapter::claude_code::ClaudeCodeAdapter.detect(&noisy),
        Confidence::Yes,
        "detection must read a window, not the first line"
    );
}

#[test]
fn nested_workflow_and_tool_result_files_are_not_mistaken_for_agents() {
    // The companion tree also holds `subagents/workflows/<id>/…`,
    // `tool-results/…` and `workflows/…`. Treating every `.jsonl` under it as a
    // sub-agent turned a two-agent real session into an 82-agent one.
    let source = source();
    assert!(
        source
            .companions
            .iter()
            .any(|c| c.name.contains("workflows/wf_demo")),
        "the fixture must actually contain the trap"
    );

    let session = projection().session;
    assert_eq!(
        session.agents.len(),
        2,
        "expected main + one sub-agent, got {:?}",
        session.agents.iter().map(|a| &a.id).collect::<Vec<_>>()
    );
}

#[test]
fn the_filename_prefix_is_stripped_so_the_in_file_join_key_matches() {
    // Files are named `agent-<id>.jsonl` but every line inside carries
    // `agentId: "<id>"` without the prefix, and that field is the join key.
    // Keeping the prefix orphaned every event in the file — silently, because
    // both the graph and `inspect` walk down from the root.
    let session = projection().session;
    assert!(
        session.agent("aa11").is_some(),
        "the sub-agent must be keyed by its in-file agentId"
    );

    let attributed: usize = session
        .agents
        .iter()
        .map(|agent| session.events_for(&agent.id).count())
        .sum();
    assert_eq!(
        attributed,
        session.events.len(),
        "every event must belong to a declared agent; the difference is work that would not be drawn"
    );
}

#[test]
fn an_event_for_an_undeclared_agent_still_surfaces() {
    // The safety net. A join that does not line up must produce an extra node,
    // which someone notices and reports, rather than missing activity.
    let orphan = SessionSource::new(
        PathBuf::from("orphan.jsonl"),
        [
            r#"{"type":"user","uuid":"u1","parentUuid":null,"sessionId":"s1","timestamp":"2026-08-28T09:00:00Z","message":{"role":"user","content":"go"}}"#,
            r#"{"type":"assistant","uuid":"a1","parentUuid":"u1","agentId":"never-declared","sessionId":"s1","timestamp":"2026-08-28T09:00:01Z","message":{"role":"assistant","content":[{"type":"text","text":"work nobody declared"}]}}"#,
        ]
        .join("\n"),
    );
    let session = adapter::parse(&orphan).expect("parses");
    assert!(
        session.agent("never-declared").is_some(),
        "an undeclared agent must be surfaced, not dropped"
    );
    let attributed: usize = session
        .agents
        .iter()
        .map(|agent| session.events_for(&agent.id).count())
        .sum();
    assert_eq!(attributed, session.events.len());
}
