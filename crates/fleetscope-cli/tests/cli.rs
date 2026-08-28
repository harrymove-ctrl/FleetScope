//! The command surface: discovery, argument handling, and the headless summary.

use std::path::{Path, PathBuf};
use std::process::Command;

fn fixture_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/gemini-multi-agent")
}

fn binary() -> PathBuf {
    // `CARGO_BIN_EXE_<name>` is set by cargo for integration tests.
    PathBuf::from(env!("CARGO_BIN_EXE_fleetscope"))
}

fn run(args: &[&str]) -> (bool, String, String) {
    let output = Command::new(binary())
        .args(args)
        .output()
        .expect("the binary runs");
    (
        output.status.success(),
        String::from_utf8_lossy(&output.stdout).into_owned(),
        String::from_utf8_lossy(&output.stderr).into_owned(),
    )
}

#[test]
fn a_directory_resolves_to_the_session_inside_it() {
    // "Point it at the folder" is the common case; the developer should not
    // have to know which file their runner wrote.
    let (ok, stdout, stderr) = run(&["inspect", fixture_dir().to_str().unwrap()]);
    assert!(ok, "inspect on a directory failed: {stderr}");
    assert!(stdout.contains("adapter   google-adk@1"), "got: {stdout}");
}

#[test]
fn inspect_reports_the_full_tree_including_depth_the_graph_flattens() {
    let (ok, stdout, _) = run(&["inspect", fixture_dir().to_str().unwrap()]);
    assert!(ok);
    for expected in [
        "coordinator [completed]",
        "flight_search [completed]",
        "hotel_search [failed]",
        "itinerary_writer [completed]",
    ] {
        assert!(
            stdout.contains(expected),
            "missing {expected:?} in:\n{stdout}"
        );
    }
}

#[test]
fn inspect_surfaces_the_stuck_call_and_the_failure() {
    // The two things a developer opens a viewer to find.
    let (_, stdout, _) = run(&["inspect", fixture_dir().to_str().unwrap()]);
    assert!(
        stdout.contains("search_hotels (fc-hotels-2) never returned"),
        "the unanswered call must be named:\n{stdout}"
    );
    assert!(
        stdout.contains("rate limit"),
        "the tool error must be shown:\n{stdout}"
    );
}

#[test]
fn a_missing_path_fails_with_the_path_in_the_message() {
    let (ok, _, stderr) = run(&["inspect", "/nonexistent/session.jsonl"]);
    assert!(!ok);
    assert!(
        stderr.contains("/nonexistent/session.jsonl"),
        "got: {stderr}"
    );
}

#[test]
fn a_directory_with_no_session_says_what_it_looked_for() {
    let empty = std::env::temp_dir().join("fleetscope-empty-session-test");
    std::fs::create_dir_all(&empty).expect("temp dir");
    let (ok, _, stderr) = run(&["inspect", empty.to_str().unwrap()]);
    assert!(!ok);
    assert!(stderr.contains(".jsonl"), "got: {stderr}");
    let _ = std::fs::remove_dir(&empty);
}

#[test]
fn an_unknown_option_is_refused_rather_than_ignored() {
    let (ok, _, stderr) = run(&["--nope", fixture_dir().to_str().unwrap()]);
    assert!(!ok);
    assert!(stderr.contains("unknown option"), "got: {stderr}");
}

#[test]
fn speed_must_be_a_positive_number() {
    for bad in ["0", "-2", "fast"] {
        let (ok, _, stderr) = run(&[fixture_dir().to_str().unwrap(), "--speed", bad]);
        assert!(!ok, "--speed {bad} was accepted");
        assert!(stderr.contains("speed"), "got: {stderr}");
    }
}

#[test]
fn help_documents_the_transport_actions_that_are_always_available() {
    // Launch options only choose the initial target and playhead; every
    // transport action stays reachable from the keyboard. The help has to say
    // so, or the flags read like modes.
    let (ok, stdout, _) = run(&["--help"]);
    assert!(ok);
    for expected in ["play/pause", "follow", "--speed", "inspect"] {
        assert!(stdout.contains(expected), "help omits {expected:?}");
    }
    assert!(
        stdout.contains("no API key"),
        "the help must state the local-only guarantee"
    );
}

#[test]
fn the_readable_formats_are_listable() {
    // "Unsupported" has to be actionable. The same list appears in the error
    // when detection refuses a file, so a developer always has a next step.
    let (ok, stdout, _) = run(&["--formats"]);
    assert!(ok);
    assert!(stdout.contains("google-adk@1"), "got: {stdout}");
    assert!(stdout.contains("claude-code@1"), "got: {stdout}");
}

#[test]
fn a_format_can_be_forced_from_the_command_line() {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/claude-code-session");
    let (ok, stdout, stderr) = run(&[
        "inspect",
        dir.to_str().unwrap(),
        "--format",
        "claude-code@1",
    ]);
    assert!(ok, "{stderr}");
    assert!(stdout.contains("claude-code@1"), "got: {stdout}");
}

#[test]
fn forcing_a_format_that_does_not_exist_fails_with_the_list() {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/claude-code-session");
    let (ok, _, stderr) = run(&["inspect", dir.to_str().unwrap(), "--format", "nope@1"]);
    assert!(!ok);
    assert!(stderr.contains("google-adk@1"), "got: {stderr}");
}
