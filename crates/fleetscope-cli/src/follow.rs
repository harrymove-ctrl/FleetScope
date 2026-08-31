//! Watching a local session file for new activity.
//!
//! # Why this is not the vendored tailer
//!
//! The vendored core ships a provider-specific project tailer and parser.
//! Reusing it would make that external transcript format the domain model,
//! which is exactly what the plan forbids. This watcher owns discovery and IO;
//! the renderer only ever receives already-compiled entries.
//!
//! # Why it recompiles the whole file
//!
//! An adapter needs the whole session to resolve agent identity: a `branch`
//! seen for the first time on line 900 declares an agent whose parent was named
//! on line 3. Reading only the tail would produce orphans. Recompiling is O(n)
//! per poll, which for a local session file is nothing, and it keeps the
//! adapter contract free of incremental-parse obligations that every future
//! provider would then have to honour.
//!
//! Only the lines PAST what has already been delivered are sent, so the
//! renderer still receives an append stream.

use std::path::PathBuf;
use std::time::Duration;

use tokio::sync::mpsc;
use zoetrope::tailer::{Source, UiEvent, Update};
use zoetrope::transcript::{parse_line, SubagentMeta};

/// Poll interval. Matches the vendored tailer's cadence: fast enough that a
/// developer does not notice the lag, slow enough to be free.
pub const POLL: Duration = Duration::from_millis(200);

/// How much of a compiled session has already been handed to the renderer.
#[derive(Default)]
struct Delivered {
    main_lines: usize,
    /// `(agent_id, lines_sent)`, and the presence of an entry also records that
    /// the subagent's `meta.json` has been announced.
    subs: Vec<(String, usize)>,
}

/// Poll `path` and forward newly compiled entries until the channel closes.
pub async fn watch(path: PathBuf, tx: mpsc::Sender<UiEvent>, first_load_sent: bool) {
    let mut delivered = Delivered::default();
    let mut last_error: Option<String> = None;

    // The initial load already went to the renderer as a ReplayLoaded, so mark
    // everything currently on disk as delivered rather than sending it twice.
    if first_load_sent {
        if let Ok(loaded) = crate::load(&path).map_err(|error| error.to_string()) {
            delivered.main_lines = count_lines(&loaded.wire.main);
            delivered.subs = loaded
                .wire
                .subagents
                .iter()
                .map(|sub| (sub.agent_id.clone(), count_lines(&sub.transcript)))
                .collect();
        }
    }

    loop {
        tokio::time::sleep(POLL).await;
        if tx.is_closed() {
            return;
        }

        // The error is stringified BEFORE any await. `Box<dyn Error>` is not
        // `Send`, and holding one across an await point would make this future
        // unspawnable — a compile error whose message points at `tokio::spawn`
        // rather than at the line that actually caused it.
        let loaded = match crate::load(&path).map_err(|error| error.to_string()) {
            Ok(loaded) => loaded,
            Err(message) => {
                // A partially written line is normal while a run is in flight.
                // Report a given failure once, not sixty times a second.
                if last_error.as_deref() != Some(message.as_str()) {
                    last_error = Some(message.clone());
                    let _ = tx.send(UiEvent::Error(message)).await;
                }
                continue;
            }
        };
        last_error = None;

        let session_id = loaded.wire.session_id.clone();
        let main_now = count_lines(&loaded.wire.main);

        // The file shrank: it was truncated or rotated under us. Anything the
        // renderer holds is now about a different run.
        if main_now < delivered.main_lines {
            delivered = Delivered::default();
            let _ = tx
                .send(UiEvent::SessionReset {
                    session_id: session_id.clone(),
                })
                .await;
        }

        let mut updates: Vec<Update> = Vec::new();

        for line in tail_lines(&loaded.wire.main, delivered.main_lines) {
            if let Some(entry) = parse_line(line) {
                updates.push(Update::Entry {
                    source: Source::Main,
                    entry,
                });
            }
        }
        delivered.main_lines = main_now;

        for sub in &loaded.wire.subagents {
            let already = delivered
                .subs
                .iter()
                .find(|(id, _)| id == &sub.agent_id)
                .map(|(_, count)| *count);

            // A subagent seen for the first time must announce its sidecar
            // before its entries, or the node has no type or label to draw.
            if already.is_none() {
                if let Ok(meta) = serde_json::from_str::<SubagentMeta>(&sub.meta) {
                    updates.push(Update::SubagentMeta {
                        agent_id: sub.agent_id.clone(),
                        workflow: None,
                        meta,
                    });
                }
            }

            let sent = already.unwrap_or(0);
            for line in tail_lines(&sub.transcript, sent) {
                if let Some(entry) = parse_line(line) {
                    updates.push(Update::Entry {
                        source: Source::Sub(sub.agent_id.clone()),
                        entry,
                    });
                }
            }

            let now = count_lines(&sub.transcript);
            match delivered
                .subs
                .iter_mut()
                .find(|(id, _)| id == &sub.agent_id)
            {
                Some((_, count)) => *count = now,
                None => delivered.subs.push((sub.agent_id.clone(), now)),
            }
        }

        if !updates.is_empty() {
            // A closed channel means the UI exited. Stop rather than spin.
            if tx
                .send(UiEvent::Batch {
                    session_id,
                    updates,
                })
                .await
                .is_err()
            {
                return;
            }
        }
    }
}

fn count_lines(text: &str) -> usize {
    text.lines().filter(|line| !line.trim().is_empty()).count()
}

fn tail_lines(text: &str, skip: usize) -> impl Iterator<Item = &str> {
    text.lines()
        .filter(|line| !line.trim().is_empty())
        .skip(skip)
}
