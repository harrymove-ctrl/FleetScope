//! The Render Manifest proof.
//!
//! The renderer's timeline and the viewer's event stream are different lists.
//! Every timeline click, every inspector open and every seek depends on the
//! mapping between them being recorded rather than guessed, so this asserts the
//! mapping against a real fold rather than against the formula that happens to
//! describe it today.

use std::path::{Path, PathBuf};

use agent_viewer_core::viewer::MAX_EVENT_WINDOW;
use agent_viewer_render::{Playhead, ViewerManifest, ViewerManifestItemKind};

fn fixture() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/gemini-multi-agent/session.jsonl")
}

fn manifest() -> (agent_viewer_core::Projection, ViewerManifest) {
    let projection = fleetscope_cli::load(&fixture()).expect("the fixture loads");
    let (_, manifest) = agent_viewer_render::build_with_manifest(
        &projection.wire,
        &projection.session,
        1.0,
        Playhead::Edge,
        None,
    );
    (projection, manifest)
}

// ── The shape of the real fold ──────────────────────────────────────────────

#[test]
fn the_fixture_records_twenty_events_and_three_sidecars() {
    let (projection, manifest) = manifest();
    assert_eq!(projection.session.events.len(), 20);
    assert_eq!(manifest.renderer_entry_count(), 23);

    let events = manifest
        .entries()
        .iter()
        .filter(|e| e.kind == ViewerManifestItemKind::Event)
        .count();
    let metas = manifest
        .entries()
        .iter()
        .filter(|e| e.kind == ViewerManifestItemKind::SubagentMeta)
        .count();
    assert_eq!((events, metas), (20, 3));
}

#[test]
fn the_sidecars_are_interleaved_not_appended() {
    // This is the whole reason a manifest exists. If the three sidecars sat at
    // the front or the back, a constant offset would map the two indexes and
    // nobody would need to record anything.
    let (_, manifest) = manifest();
    let metas: Vec<usize> = manifest
        .entries()
        .iter()
        .filter(|e| e.kind == ViewerManifestItemKind::SubagentMeta)
        .map(|e| e.renderer_entry_index)
        .collect();
    assert_eq!(metas, vec![3, 9, 16]);
}

// ── Reverse lookup ──────────────────────────────────────────────────────────

#[test]
fn a_sidecar_index_answers_with_no_event() {
    // Not the nearest event, and not the previous one. Reporting the wrong
    // event is worse than reporting none, because the inspector would then show
    // real content under a wrong heading.
    let (_, manifest) = manifest();
    for index in [3, 9, 16] {
        let entry = manifest.entry_at(index).expect("in range");
        assert_eq!(entry.kind, ViewerManifestItemKind::SubagentMeta);
        assert_eq!(manifest.sequence_at(index), None, "index {index}");
        assert!(entry.agent_id.is_some(), "a sidecar still names its agent");
    }
}

#[test]
fn the_index_after_a_sidecar_resolves_to_the_shifted_event() {
    // Renderer index 4 is viewer event 3, because one sidecar came before it.
    // An arithmetic bridge would have said event 4.
    let (_, manifest) = manifest();
    assert_eq!(manifest.sequence_at(4), Some(3));
    assert_eq!(manifest.sequence_at(0), Some(0));
    assert_eq!(manifest.sequence_at(2), Some(2));
}

#[test]
fn an_out_of_range_index_answers_none_rather_than_clamping() {
    let (_, manifest) = manifest();
    assert!(manifest.entry_at(23).is_none());
    assert_eq!(manifest.sequence_at(999), None);
}

// ── Forward lookup ──────────────────────────────────────────────────────────

#[test]
fn every_event_resolves_to_a_renderer_index() {
    let (projection, manifest) = manifest();
    for event in &projection.session.events {
        assert!(
            manifest
                .renderer_index_for_sequence(event.sequence)
                .is_some(),
            "event {} rendered nothing",
            event.sequence
        );
    }
}

#[test]
fn the_recorded_mapping_agrees_with_the_offset_oracle() {
    // The formula is `event index + sidecars before it`. It lives HERE, as a
    // check, and nowhere in the runtime. If a future emitter breaks the 1:1
    // relationship this test fails and the manifest keeps working, which is the
    // whole point of recording rather than computing.
    let (projection, manifest) = manifest();
    let meta_positions: Vec<usize> = manifest
        .entries()
        .iter()
        .filter(|e| e.kind == ViewerManifestItemKind::SubagentMeta)
        .map(|e| e.renderer_entry_index)
        .collect();

    for (event_index, event) in projection.session.events.iter().enumerate() {
        let recorded = manifest
            .renderer_index_for_sequence(event.sequence)
            .expect("recorded");
        let metas_before = meta_positions.iter().filter(|m| **m <= recorded).count();
        assert_eq!(
            recorded,
            event_index + metas_before,
            "sequence {} disagrees with the oracle",
            event.sequence
        );
    }
}

#[test]
fn the_manifest_carries_the_agent_each_event_belonged_to() {
    let (projection, manifest) = manifest();
    for event in &projection.session.events {
        let index = manifest
            .renderer_index_for_sequence(event.sequence)
            .expect("recorded");
        assert_eq!(
            manifest.entry_at(index).unwrap().agent_id.as_deref(),
            Some(event.agent_id.as_str())
        );
    }
}

#[test]
fn the_manifest_is_internally_consistent() {
    let (projection, manifest) = manifest();
    assert_eq!(manifest.validate(&projection.session), Vec::<String>::new());
}

#[test]
fn fractions_are_monotonic_in_sequence() {
    // The scrubber's own input. Identity never comes from one, but the
    // ordering still has to be right or dragging jumps backwards.
    let (projection, manifest) = manifest();
    let mut previous = -1.0_f64;
    for event in &projection.session.events {
        let fraction = manifest
            .fraction_for_sequence(event.sequence)
            .expect("recorded");
        assert!(fraction >= previous, "fraction went backwards");
        assert!((0.0..=1.0).contains(&fraction));
        previous = fraction;
    }
}

// ── The bounded event window ────────────────────────────────────────────────

#[test]
fn a_window_reports_what_it_actually_returned() {
    let (projection, _) = manifest();
    let window = projection.session.event_window(0, 5);
    assert_eq!(window.items.len(), 5);
    assert_eq!(window.total_count, 20);
    assert_eq!(window.offset, 0);
    assert!(window.has_more);

    let tail = projection.session.event_window(18, 50);
    assert_eq!(tail.items.len(), 2);
    assert!(!tail.has_more, "the last page must say so");
}

#[test]
fn paging_past_the_end_is_an_empty_window_not_an_error() {
    let (projection, _) = manifest();
    let window = projection.session.event_window(500, 10);
    assert!(window.items.is_empty());
    assert_eq!(window.offset, 20);
    assert!(!window.has_more);
}

#[test]
fn a_large_session_is_never_returned_whole() {
    // A real session measured here holds 3581 events. The cap is the contract:
    // a caller that asks for everything gets one page and is told there is more.
    let big = build_large_session(5_000);
    assert_eq!(big.events.len(), 5_000);

    let window = big.event_window(0, u32::MAX as usize);
    assert_eq!(window.items.len(), MAX_EVENT_WINDOW);
    assert_eq!(window.total_count, 5_000);
    assert!(window.has_more);

    // And the whole stream is still reachable by paging.
    let mut seen = 0usize;
    let mut offset = 0usize;
    loop {
        let page = big.event_window(offset, MAX_EVENT_WINDOW);
        seen += page.items.len();
        offset += page.items.len();
        if !page.has_more {
            break;
        }
    }
    assert_eq!(seen, 5_000);
}

/// A synthetic session large enough to exercise the cap.
fn build_large_session(count: u64) -> agent_viewer_core::viewer::ViewerSession {
    use agent_viewer_core::viewer::{Payload, ViewerAgent, ViewerEvent, ViewerSession};
    use chrono::{TimeZone, Utc};

    let agents = vec![ViewerAgent {
        id: "root".to_string(),
        label: "root".to_string(),
        kind: "agent".to_string(),
        parent_id: None,
    }];
    let events = (0..count)
        .map(|sequence| ViewerEvent {
            sequence,
            agent_id: "root".to_string(),
            timestamp: Utc
                .timestamp_opt(1_787_907_600 + sequence as i64, 0)
                .unwrap(),
            payload: Payload::Message {
                text: format!("event {sequence}"),
                from_user: false,
            },
            source_id: format!("e{sequence}"),
        })
        .collect();
    ViewerSession::from_parts("big".to_string(), "test".to_string(), agents, events)
}
