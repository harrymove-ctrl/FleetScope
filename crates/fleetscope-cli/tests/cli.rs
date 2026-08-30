//! The command surface: discovery, argument handling, and the headless summary.

use std::path::{Path, PathBuf};
use std::process::Command;

fn fixture_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/gemini-multi-agent")
}

fn example_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../examples/gemini-session")
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
fn the_checked_in_example_folder_is_loadable_by_cli() {
    let (ok, stdout, stderr) = run(&["inspect", example_dir().to_str().unwrap()]);
    assert!(ok, "inspect on examples/gemini-session failed: {stderr}");
    assert!(stdout.contains("adapter   google-adk@1"), "got: {stdout}");
    assert!(
        stdout.contains("flight_search [completed]"),
        "got: {stdout}"
    );
}

#[test]
fn inspect_accepts_tiny_and_does_not_size_gate() {
    // `--tiny` is a view-only override. inspect must still run in a small
    // terminal (and in CI, where there is no TTY) without exiting 2.
    let (ok, stdout, stderr) = run(&["inspect", fixture_dir().to_str().unwrap(), "--tiny"]);
    assert!(ok, "inspect --tiny failed: {stderr}");
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
    // The directory name has to be unique per process. A fixed path races when
    // two test binaries run at once: one removes the directory while the other
    // is still using it, and the failure looks like a viewer bug rather than a
    // test bug. This is why `cargo test` needed to be run sequentially.
    let empty = std::env::temp_dir().join(format!(
        "fleetscope-empty-session-{}-{}",
        std::process::id(),
        line!()
    ));
    std::fs::create_dir_all(&empty).expect("temp dir");
    let (ok, _, stderr) = run(&["inspect", empty.to_str().unwrap()]);
    let _ = std::fs::remove_dir(&empty);
    assert!(!ok);
    assert!(stderr.contains(".jsonl"), "got: {stderr}");
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
    for expected in ["pause", "follow", "--speed", "inspect", "--tiny"] {
        assert!(stdout.contains(expected), "help omits {expected:?}");
    }
    assert!(
        stdout.contains("[ / ]") || (stdout.contains('[') && stdout.contains(']')),
        "help must advertise [ / ] for step, got:\n{stdout}"
    );
    assert!(
        !stdout.contains("←/→"),
        "help must not advertise arrows as step, got:\n{stdout}"
    );
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
    if cfg!(feature = "legacy-claude") {
        assert!(stdout.contains("claude-code@1"), "got: {stdout}");
    } else {
        assert!(
            !stdout.contains("claude-code@1"),
            "the default hackathon build must not advertise the legacy Claude dialect: {stdout}"
        );
    }
}

#[test]
fn the_google_format_can_be_forced_from_the_command_line() {
    let dir = fixture_dir();
    let (ok, stdout, stderr) = run(&["inspect", dir.to_str().unwrap(), "--format", "google-adk@1"]);
    assert!(ok, "{stderr}");
    assert!(stdout.contains("google-adk@1"), "got: {stdout}");
}

#[test]
fn forcing_a_format_that_does_not_exist_fails_with_the_list() {
    let dir = fixture_dir();
    let (ok, _, stderr) = run(&["inspect", dir.to_str().unwrap(), "--format", "nope@1"]);
    assert!(!ok);
    assert!(stderr.contains("google-adk@1"), "got: {stderr}");
}

// ── `fleetscope demo` ───────────────────────────────────────────────────────

#[test]
fn demo_points_at_the_local_surfaces() {
    let (ok, stdout, stderr) = run(&["demo"]);
    assert!(ok, "{stderr}");
    for expected in ["viewer", "capability", "POST /runs", "loopback only"] {
        assert!(
            stdout.contains(expected),
            "demo omits {expected:?}:\n{stdout}"
        );
    }
}

#[test]
fn demo_says_plainly_that_it_starts_nothing() {
    // Starting a run spends model calls and performs an external read. A CLI
    // flag that silently began spending would be the wrong affordance, so the
    // command has to say what it does not do.
    let (_, stdout, _) = run(&["demo"]);
    assert!(stdout.contains("does not start a run"), "got:\n{stdout}");
}

#[test]
fn demo_refuses_to_hand_a_non_http_url_to_the_shell() {
    // Only an http(s) URL ever reaches the desktop open helper, so a crafted
    // argument cannot become a command.
    let (ok, _, stderr) = run(&["demo", "--url", "file:///etc/passwd", "--open"]);
    assert!(!ok);
    assert!(stderr.contains("non-http"), "got: {stderr}");
}

#[test]
fn demo_rejects_an_unknown_option() {
    let (ok, _, stderr) = run(&["demo", "--start-now"]);
    assert!(!ok);
    assert!(stderr.contains("unknown option"), "got: {stderr}");
}

#[test]
fn the_existing_commands_are_unchanged_by_the_demo_subcommand() {
    // `demo` is a new word in the same parser. The regression that matters is
    // an existing invocation changing meaning.
    let (ok, stdout, _) = run(&["--formats"]);
    assert!(ok);
    assert!(stdout.contains("google-adk@1"));
    if cfg!(feature = "legacy-claude") {
        assert!(stdout.contains("claude-code@1"));
    } else {
        assert!(!stdout.contains("claude-code@1"));
    }

    let dir = fixture_dir();
    let (inspect_ok, inspect_out, _) = run(&["inspect", dir.to_str().unwrap()]);
    assert!(inspect_ok);
    assert!(inspect_out.contains("adapter   google-adk@1"));
}
