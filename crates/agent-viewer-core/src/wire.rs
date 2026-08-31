//! Emitting a [`ViewerSession`] in the shape the vendored renderer parses.
//!
//! Speaking the renderer's existing wire format is what lets FleetScope reuse
//! its fold, its timeline engine, its graph layout and its upstream test suite
//! unmodified. The alternative is forking the parser, which is the one thing the
//! vendoring strategy exists to avoid.
//!
//! # Only the fields the renderer reads
//!
//! There is deliberately no `thinking` block builder and no `prompt` field on a
//! spawn. `vendor/zoetrope/src/ui/panel.rs` renders `↳ prompt` and `↳ thought`
//! rows from exactly those two, and model reasoning must not be somewhere a
//! renderer can draw it. The adapter already discards reasoning parts; this is
//! the second control.
//!
//! # The one-level constraint
//!
//! The renderer's agent graph is one level deep: a subagent's parent is the main
//! node or a workflow group (`vendor/zoetrope/src/state/session.rs`, `parent:
//! Option<String>`). A session whose tree is deeper is therefore FLATTENED here
//! — every non-root agent becomes a child of main — and its true lineage is
//! preserved in the node label. `fleetscope inspect` prints the real tree, so
//! the depth is never lost, only un-drawn. See [`flatten_note`].

use crate::viewer::{Payload, ViewerEvent, ViewerSession};

/// The renderer treats a tool named `Agent` as a spawn. The name is load-bearing.
pub const SPAWN_TOOL: &str = "Agent";

/// Fractional-second digits used to force a strict global timeline order.
const NANO_DIGITS: usize = 6;

/// One compiled subagent file plus its `meta.json` sidecar.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SubagentFile {
    pub agent_id: String,
    pub meta: String,
    pub transcript: String,
}

/// A session compiled into renderer input.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct WireSession {
    pub session_id: String,
    pub main: String,
    pub subagents: Vec<SubagentFile>,
    /// Renderer lines emitted, which is what the timeline will fold.
    pub line_count: usize,
    /// True when the source tree was deeper than the renderer can draw.
    pub flattened: bool,
}

/// Human-readable explanation of the flattening, or `None` when the tree fit.
pub fn flatten_note(session: &WireSession) -> Option<String> {
    session.flattened.then(|| {
        "the session nests agents more than one level deep; the graph draws them all under the root and keeps the full path in each label".to_string()
    })
}

/// Stamp a line with a timestamp strictly greater than every line before it,
/// without moving it out of its source second.
///
/// The renderer sorts timeline items by timestamp. Several events legitimately
/// share a source time, and a subagent's lines live in a different file from the
/// main transcript, so copying the source time would leave the merge order up to
/// sort stability across files. Appending the global emission index as
/// sub-millisecond precision makes the order total and explicit.
fn ordered_timestamp(event: &ViewerEvent, global_index: usize) -> String {
    debug_assert!(global_index < 10usize.pow(NANO_DIGITS as u32));
    let base = event.timestamp.format("%Y-%m-%dT%H:%M:%S").to_string();
    let millis = event.timestamp.timestamp_subsec_millis();
    format!(
        "{base}.{millis:03}{index:0width$}Z",
        index = global_index % 10usize.pow(NANO_DIGITS as u32),
        width = NANO_DIGITS
    )
}

/// Accumulates the lines of one transcript file, threading `parentUuid`.
#[derive(Default)]
struct FileBuilder {
    lines: Vec<String>,
    previous_uuid: Option<String>,
}

impl FileBuilder {
    fn push(&mut self, uuid: String, body: serde_json::Value) {
        let mut object = match body {
            serde_json::Value::Object(map) => map,
            other => {
                let mut map = serde_json::Map::new();
                map.insert("value".to_string(), other);
                map
            }
        };
        object.insert("uuid".to_string(), serde_json::Value::String(uuid.clone()));
        object.insert(
            "parentUuid".to_string(),
            match &self.previous_uuid {
                Some(previous) => serde_json::Value::String(previous.clone()),
                None => serde_json::Value::Null,
            },
        );
        self.previous_uuid = Some(uuid);
        self.lines
            .push(serde_json::Value::Object(object).to_string());
    }

    fn finish(self) -> String {
        if self.lines.is_empty() {
            String::new()
        } else {
            format!("{}\n", self.lines.join("\n"))
        }
    }
}

/// Compile a session into renderer input.
pub fn compile(session: &ViewerSession) -> WireSession {
    let session_id = session.session_id.clone();
    let root_id = session
        .root()
        .map(|agent| agent.id.clone())
        .unwrap_or_else(|| "root".to_string());

    let flattened = session
        .agents
        .iter()
        .any(|agent| agent.id.matches('/').count() > 1);

    let mut main = FileBuilder::default();
    let mut subs: Vec<(String, FileBuilder)> = Vec::new();
    let mut metas: Vec<(String, String)> = Vec::new();
    let mut emitted = 0usize;

    for agent in &session.agents {
        if agent.id == root_id {
            continue;
        }
        // Every non-root agent is declared as a child of main, because that is
        // the only parentage the renderer's graph has.
        metas.push((
            agent.id.clone(),
            serde_json::json!({
                "agentType": agent.kind,
                "description": agent.label,
                "toolUseId": spawn_call_id(&agent.id),
            })
            .to_string(),
        ));
        subs.push((agent.id.clone(), FileBuilder::default()));
    }

    for event in &session.events {
        let timestamp = ordered_timestamp(event, emitted);
        let uuid = format!("fs-{}", event.sequence);
        let in_main = event.agent_id == root_id;

        // A spawn is always written into the MAIN transcript. Its `tool_use` id
        // is the join key the subagent's `meta.json` points back at, and the
        // renderer only resolves that link against the main node.
        if let Payload::Spawn {
            child_agent_id,
            description,
            ..
        } = &event.payload
        {
            main.push(
                uuid,
                assistant_line(
                    &session_id,
                    &timestamp,
                    None,
                    vec![serde_json::json!({
                        "type": "tool_use",
                        "id": spawn_call_id(child_agent_id),
                        "name": SPAWN_TOOL,
                        // `description` and `subagent_type` only. No `prompt`:
                        // the panel would render it as a `↳ prompt` row.
                        "input": {
                            "description": description,
                            "subagent_type": leaf_of(child_agent_id),
                        },
                    })],
                ),
            );
            emitted += 1;
            continue;
        }

        // A terminal fact has to land on the MAIN transcript as a
        // `<task-notification>`: that is the only signal the renderer treats
        // as Failed/Done + terminal. An assistant `[failed]` line on the
        // child's file is visible as text and is ignored by liveness, which
        // is why inspect could say `failed` while the graph said `running`.
        if let Payload::Status { terminal, detail } = &event.payload {
            let status = match terminal {
                crate::viewer::Terminal::Completed => "completed",
                crate::viewer::Terminal::Failed => "failed",
            };
            // The root node is `main` inside the renderer, not the session id.
            let task_id = if in_main {
                "main"
            } else {
                event.agent_id.as_str()
            };
            let summary = detail.replace(['<', '>'], "");
            let text = format!(
                "<task-notification>\n<task-id>{task_id}</task-id>\n<status>{status}</status>\n<summary>{summary}</summary>\n</task-notification>"
            );
            main.push(uuid, user_notification_line(&session_id, &timestamp, &text));
            emitted += 1;
            continue;
        }

        let target: &mut FileBuilder = if in_main {
            &mut main
        } else {
            match subs.iter_mut().find(|(id, _)| id == &event.agent_id) {
                Some((_, builder)) => builder,
                // An event for an agent that was never declared. Rather than
                // drop it (silently losing activity), it goes to main.
                None => &mut main,
            }
        };
        let agent_tag = (!in_main).then(|| event.agent_id.clone());

        match &event.payload {
            Payload::Spawn { .. } => unreachable!("handled above"),
            Payload::Message { text, from_user } => {
                let body = if *from_user {
                    user_text_line(&session_id, &timestamp, agent_tag.as_deref(), text)
                } else {
                    assistant_line(
                        &session_id,
                        &timestamp,
                        agent_tag.as_deref(),
                        vec![serde_json::json!({ "type": "text", "text": text })],
                    )
                };
                target.push(uuid, body);
            }
            Payload::ToolCall {
                call_id,
                tool,
                summary,
            } => target.push(
                uuid,
                assistant_line(
                    &session_id,
                    &timestamp,
                    agent_tag.as_deref(),
                    vec![serde_json::json!({
                        "type": "tool_use",
                        "id": call_id,
                        "name": tool,
                        "input": { "summary": summary },
                    })],
                ),
            ),
            Payload::ToolResult {
                call_id,
                summary,
                is_error,
                ..
            } => target.push(
                uuid,
                user_result_line(
                    &session_id,
                    &timestamp,
                    agent_tag.as_deref(),
                    call_id,
                    summary,
                    *is_error,
                ),
            ),
            Payload::Status { .. } => unreachable!("handled above"),
        }
        emitted += 1;
    }

    let subagents = subs
        .into_iter()
        .map(|(agent_id, builder)| {
            let meta = metas
                .iter()
                .find(|(id, _)| id == &agent_id)
                .map(|(_, meta)| meta.clone())
                .unwrap_or_default();
            SubagentFile {
                agent_id,
                meta,
                transcript: builder.finish(),
            }
        })
        .collect();

    WireSession {
        session_id,
        main: main.finish(),
        subagents,
        line_count: emitted,
        flattened,
    }
}

fn assistant_line(
    session_id: &str,
    timestamp: &str,
    agent_id: Option<&str>,
    content: Vec<serde_json::Value>,
) -> serde_json::Value {
    let mut line = serde_json::json!({
        "type": "assistant",
        "timestamp": timestamp,
        "sessionId": session_id,
        "message": { "role": "assistant", "content": content },
    });
    tag_sidechain(&mut line, agent_id);
    line
}

fn user_notification_line(session_id: &str, timestamp: &str, text: &str) -> serde_json::Value {
    serde_json::json!({
        "type": "user",
        "timestamp": timestamp,
        "sessionId": session_id,
        "origin": { "kind": "task-notification" },
        "message": { "role": "user", "content": text },
    })
}

fn user_text_line(
    session_id: &str,
    timestamp: &str,
    agent_id: Option<&str>,
    text: &str,
) -> serde_json::Value {
    let mut line = serde_json::json!({
        "type": "user",
        "timestamp": timestamp,
        "sessionId": session_id,
        // `origin.kind = human` is the renderer's authoritative discriminator
        // between a typed prompt and a system-injected line.
        "origin": { "kind": "human" },
        "message": { "role": "user", "content": text },
    });
    tag_sidechain(&mut line, agent_id);
    line
}

fn user_result_line(
    session_id: &str,
    timestamp: &str,
    agent_id: Option<&str>,
    tool_use_id: &str,
    summary: &str,
    is_error: bool,
) -> serde_json::Value {
    let mut line = serde_json::json!({
        "type": "user",
        "timestamp": timestamp,
        "sessionId": session_id,
        "message": {
            "role": "user",
            "content": [{
                "type": "tool_result",
                "tool_use_id": tool_use_id,
                "content": summary,
                "is_error": is_error,
            }],
        },
    });
    tag_sidechain(&mut line, agent_id);
    line
}

/// Mark a line as belonging to a subagent file. `agentId` is the join key.
fn tag_sidechain(line: &mut serde_json::Value, agent_id: Option<&str>) {
    if let (Some(object), Some(agent_id)) = (line.as_object_mut(), agent_id) {
        object.insert(
            "agentId".to_string(),
            serde_json::Value::String(agent_id.to_string()),
        );
        object.insert("isSidechain".to_string(), serde_json::Value::Bool(true));
    }
}

/// Must match `adapter::adk::spawn_call_id`: the subagent's `meta.json` and the
/// main transcript's spawn `tool_use` have to agree on this id or the child node
/// never attaches to its parent.
pub fn spawn_call_id(child_path: &str) -> String {
    format!("spawn-{}", child_path.replace('/', "-"))
}

fn leaf_of(path: &str) -> &str {
    path.rsplit_once('/').map_or(path, |(_, tail)| tail)
}
