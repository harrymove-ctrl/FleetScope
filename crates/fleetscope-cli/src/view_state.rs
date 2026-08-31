//! `<session-dir>/view.json` — last-write-wins pairing between TUI and browser.
//!
//! Evidence stays in `session.jsonl`. This file is view state only.

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use agent_viewer_render::ViewState;
use zoetrope::state::App;
use zoetrope::tui::TuiHooks;

/// Who writes this sidecar from the native viewer.
pub const WRITER: &str = "tui";

/// Sidecar path: sibling of `session.jsonl`.
pub fn path_in(session_dir: &Path) -> PathBuf {
    session_dir.join("view.json")
}

/// Directory that owns `view.json` for a user-supplied path.
///
/// A directory is used as-is (the session file lives inside it). A file uses
/// its parent, so the sidecar sits next to `session.jsonl`.
pub fn session_dir(user_path: &Path, resolved: &Path) -> PathBuf {
    if user_path.is_dir() {
        user_path.to_path_buf()
    } else {
        resolved
            .parent()
            .map(Path::to_path_buf)
            .unwrap_or_else(|| user_path.to_path_buf())
    }
}

/// Read a sidecar. Missing or corrupt → `None` (unpaired / ignore once).
pub fn read(session_dir: &Path) -> Option<ViewState> {
    let bytes = std::fs::read_to_string(path_in(session_dir)).ok()?;
    ViewState::parse(&bytes)
}

/// Write a sidecar atomically. `updatedAt` is milliseconds since epoch.
pub fn write(session_dir: &Path, state: &ViewState) -> std::io::Result<()> {
    std::fs::create_dir_all(session_dir)?;
    let path = path_in(session_dir);
    let tmp = session_dir.join(".view.json.tmp");
    let json = serde_json::to_vec_pretty(state)
        .map_err(|error| std::io::Error::new(std::io::ErrorKind::InvalidData, error))?;
    std::fs::write(&tmp, json)?;
    std::fs::rename(&tmp, path)
}

pub fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or(0)
}

/// Pairing driver owned by the TUI loop.
pub struct Pairing {
    dir: PathBuf,
    manifest: agent_viewer_render::ViewerManifest,
    last_written: Option<i64>,
    last_applied: Option<i64>,
    last_poll: Option<std::time::Instant>,
}

impl Pairing {
    pub fn new(dir: PathBuf, manifest: agent_viewer_render::ViewerManifest) -> Self {
        Self {
            dir,
            manifest,
            last_written: None,
            last_applied: None,
            last_poll: None,
        }
    }
}

impl TuiHooks for Pairing {
    /// After a key/click: write. Never called on startup, so the first opener
    /// does not clobber an existing sidecar.
    fn on_input(&mut self, app: &App) {
        let updated_at = now_ms();
        let state = ViewState::capture(app, &self.manifest, WRITER, updated_at);
        if write(&self.dir, &state).is_ok() {
            self.last_written = Some(state.updated_at);
        }
    }

    /// Poll ~200ms and apply a newer remote sidecar.
    fn on_frame(&mut self, app: &mut App) {
        let now = std::time::Instant::now();
        if self
            .last_poll
            .is_some_and(|last| now.duration_since(last) < std::time::Duration::from_millis(200))
        {
            return;
        }
        self.last_poll = Some(now);
        let Some(state) = read(&self.dir) else {
            return;
        };
        if !should_apply(&state, self.last_written, self.last_applied) {
            return;
        }
        state.apply(app, &self.manifest);
        self.last_applied = Some(state.updated_at);
    }
}

/// Last `updatedAt` wins. Ignore a file older than the local copy we last
/// wrote, and ignore our own writer so a poll of our write is a no-op.
fn should_apply(state: &ViewState, last_written: Option<i64>, last_applied: Option<i64>) -> bool {
    if state.writer == WRITER {
        return false;
    }
    if last_written.is_some_and(|written| state.updated_at <= written) {
        return false;
    }
    if last_applied.is_some_and(|applied| state.updated_at <= applied) {
        return false;
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "fleetscope-view-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).expect("temp dir");
        dir
    }

    fn sample(writer: &str, updated_at: i64, playhead: u64) -> ViewState {
        ViewState {
            v: 1,
            playhead,
            paused: true,
            selected_agent: Some("ux_designer".into()),
            camera: "manual".into(),
            updated_at,
            writer: writer.into(),
        }
    }

    #[test]
    fn missing_file_is_unpaired() {
        let dir = temp_dir();
        assert!(read(&dir).is_none());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn corrupt_file_is_ignored() {
        let dir = temp_dir();
        std::fs::write(path_in(&dir), "{nope").expect("write");
        assert!(
            read(&dir).is_none(),
            "corrupt sidecar must not crash follow"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn write_then_read_roundtrips() {
        let dir = temp_dir();
        let state = sample("tui", 1_756_571_844_375, 71);
        write(&dir, &state).expect("write");
        let loaded = read(&dir).expect("reads");
        assert_eq!(loaded, state);
        let raw = std::fs::read_to_string(path_in(&dir)).unwrap();
        assert!(raw.contains("\"writer\": \"tui\""));
        assert!(raw.contains("\"playhead\": 71"));
        assert!(raw.contains("\"selectedAgent\": \"ux_designer\""));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn older_than_last_write_is_ignored() {
        let ours = sample("web", 10, 1);
        assert!(
            !should_apply(&ours, Some(20), None),
            "a file older than the local write must not clobber"
        );
        let newer = sample("web", 30, 2);
        assert!(should_apply(&newer, Some(20), None));
    }

    #[test]
    fn own_writer_is_ignored() {
        let own = sample("tui", 50, 3);
        assert!(!should_apply(&own, Some(40), None));
        let remote = sample("web", 50, 3);
        assert!(should_apply(&remote, Some(40), None));
    }

    #[test]
    fn already_applied_timestamp_is_ignored() {
        let state = sample("web", 10, 1);
        assert!(!should_apply(&state, None, Some(10)));
        assert!(should_apply(&state, None, Some(9)));
    }
}
