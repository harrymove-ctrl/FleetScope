//! Google ADK / Gemini / Antigravity-style local sessions.
//!
//! # The dialect
//!
//! A Google ADK `Session` serializes as an object with an `events` array; a
//! streamed Antigravity-style log writes the same `Event` objects one per line.
//! Both are accepted, because they are the same records with a different
//! envelope, and a developer should not have to know which one their runner
//! chose.
//!
//! An ADK `Event` carries `author` (which agent spoke), `branch` (its lineage as
//! a dotted path), a `content.parts` list of text / `functionCall` /
//! `functionResponse`, and optional `errorCode` / `turnComplete` / `actions`.
//! Field names are accepted in both camelCase and snake_case: the Python SDK
//! emits either depending on whether `by_alias` was set, and both are in the
//! wild.
//!
//! # Two rules this adapter does not bend
//!
//! **Reasoning is dropped, never rendered.** A part with `thought: true` is
//! model reasoning. It is discarded here, before it can reach a label, a node,
//! or a detail panel. The `render-provenance` feature is also off in this
//! crate's manifest, so there are two independent controls and neither depends
//! on the other.
//!
//! **Terminal state is never inferred.** An agent is `Completed` or `Failed`
//! only because the session said so (`turnComplete`, `errorCode`, `escalate`).
//! Silence stays silence: a stuck agent must look stuck, not finished.

use std::collections::BTreeMap;

use chrono::{DateTime, TimeZone, Utc};
use serde::Deserialize;

use super::{AdapterError, Confidence, SessionAdapter, SessionSource};
use crate::viewer::{Payload, Terminal, ViewerAgent, ViewerEvent, ViewerSession};

pub const ADAPTER_ID: &str = "google-adk@1";

/// How many lines detection reads before deciding.
const PROBE_LINES: usize = 40;

/// Longest display text kept on a label. Beyond this a graph node stops being
/// readable and the timeline row starts wrapping.
const MAX_TEXT: usize = 160;
/// Longest rendered tool argument/result preview.
const MAX_SUMMARY: usize = 120;

pub struct AdkAdapter;

// ---------------------------------------------------------------------------
// Wire types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct AdkSessionFile {
    #[serde(default)]
    id: Option<String>,
    #[serde(default, alias = "app_name", alias = "appName")]
    app_name: Option<String>,
    events: Vec<AdkEvent>,
}

#[derive(Debug, Deserialize)]
struct AdkEvent {
    #[serde(default)]
    id: Option<String>,
    #[serde(default, alias = "invocation_id", alias = "invocationId")]
    invocation_id: Option<String>,
    author: String,
    #[serde(default)]
    branch: Option<String>,
    #[serde(default)]
    timestamp: Option<f64>,
    #[serde(default)]
    content: Option<AdkContent>,
    #[serde(default, alias = "error_code", alias = "errorCode")]
    error_code: Option<String>,
    #[serde(default, alias = "error_message", alias = "errorMessage")]
    error_message: Option<String>,
    #[serde(default)]
    partial: Option<bool>,
    #[serde(default, alias = "turn_complete", alias = "turnComplete")]
    turn_complete: Option<bool>,
    #[serde(default)]
    actions: Option<AdkActions>,
}

#[derive(Debug, Default, Deserialize)]
struct AdkActions {
    #[serde(default, alias = "transfer_to_agent", alias = "transferToAgent")]
    transfer_to_agent: Option<String>,
    #[serde(default)]
    escalate: Option<bool>,
}

#[derive(Debug, Default, Deserialize)]
struct AdkContent {
    #[serde(default)]
    role: Option<String>,
    #[serde(default)]
    parts: Vec<AdkPart>,
}

#[derive(Debug, Default, Deserialize)]
struct AdkPart {
    #[serde(default)]
    text: Option<String>,
    /// `true` marks the part as model reasoning. Dropped, always.
    #[serde(default)]
    thought: Option<bool>,
    #[serde(default, alias = "function_call", alias = "functionCall")]
    function_call: Option<AdkFunctionCall>,
    #[serde(default, alias = "function_response", alias = "functionResponse")]
    function_response: Option<AdkFunctionResponse>,
}

#[derive(Debug, Deserialize)]
struct AdkFunctionCall {
    #[serde(default)]
    id: Option<String>,
    name: String,
    #[serde(default)]
    args: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct AdkFunctionResponse {
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    response: serde_json::Value,
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

impl SessionAdapter for AdkAdapter {
    fn id(&self) -> &'static str {
        ADAPTER_ID
    }

    fn label(&self) -> &'static str {
        "Google ADK / Gemini session"
    }

    fn detect(&self, source: &SessionSource) -> Confidence {
        // Wrapped form: an object with an `events` array of authored records.
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(source.text.trim()) {
            if let Some(events) = value.get("events").and_then(|e| e.as_array()) {
                return match events.first() {
                    Some(first) if first.get("author").is_some() => Confidence::Yes,
                    // An empty `events` array is still recognisably this format.
                    None => Confidence::Maybe,
                    Some(_) => Confidence::No,
                };
            }
        }

        // Streamed form: one event per line. Probed over a window rather
        // than on line one, because a producer may write bookkeeping first.
        let mut best = Confidence::No;
        for line in source.probe_lines(PROBE_LINES) {
            let Ok(value) = serde_json::from_str::<serde_json::Value>(line) else {
                continue;
            };
            if value.get("author").is_none() {
                continue;
            }
            // `invocationId` and `branch` are ADK's own; `content.parts` is the
            // Gemini content shape. Any one of them discriminates against a
            // generic log line that happens to carry an `author`.
            let discriminating = value.get("invocationId").is_some()
                || value.get("invocation_id").is_some()
                || value.get("branch").is_some()
                || value.get("content").and_then(|c| c.get("parts")).is_some();
            if discriminating {
                return Confidence::Yes;
            }
            best = Confidence::Maybe;
        }
        best
    }

    fn parse(&self, source: &SessionSource) -> Result<ViewerSession, AdapterError> {
        let (session_id, events) = read_events(source)?;
        Builder::new(session_id).build(events)
    }
}

/// Read either envelope into a flat event list.
fn read_events(source: &SessionSource) -> Result<(String, Vec<AdkEvent>), AdapterError> {
    let trimmed = source.text.trim();
    if trimmed.is_empty() {
        return Err(AdapterError::Empty);
    }

    if trimmed.starts_with('{') {
        if let Ok(file) = serde_json::from_str::<AdkSessionFile>(trimmed) {
            let id = file
                .id
                .or(file.app_name)
                .or_else(|| invocation_id(&file.events))
                .unwrap_or_else(|| fallback_session_id(source));
            return Ok((id, file.events));
        }
    }

    let mut events = Vec::new();
    for (offset, raw) in source.text.lines().enumerate() {
        let line = raw.trim();
        if line.is_empty() {
            continue;
        }
        match serde_json::from_str::<AdkEvent>(line) {
            Ok(event) => events.push(event),
            Err(error) => {
                return Err(AdapterError::Malformed {
                    line: Some(offset + 1),
                    message: error.to_string(),
                })
            }
        }
    }

    if events.is_empty() {
        return Err(AdapterError::Empty);
    }
    // A streamed log has no envelope to name itself with. ADK's invocation id is
    // the run's own identity and is far more useful than a filename that is
    // usually just `session`.
    let id = invocation_id(&events).unwrap_or_else(|| fallback_session_id(source));
    Ok((id, events))
}

/// The first invocation id in the stream, if the runner recorded one.
fn invocation_id(events: &[AdkEvent]) -> Option<String> {
    events
        .iter()
        .find_map(|event| event.invocation_id.clone())
        .filter(|id| !id.is_empty())
}

/// Name the session after the file when the record does not name itself.
fn fallback_session_id(source: &SessionSource) -> String {
    source
        .path
        .file_stem()
        .map(|stem| stem.to_string_lossy().into_owned())
        .unwrap_or_else(|| "session".to_string())
}

// ---------------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------------

struct Builder {
    session_id: String,
    agents: BTreeMap<String, ViewerAgent>,
    events: Vec<ViewerEvent>,
    sequence: u64,
    /// Last timestamp actually observed, so events without one stay ordered
    /// after their predecessor instead of collapsing onto the epoch.
    clock: Option<DateTime<Utc>>,
}

impl Builder {
    fn new(session_id: String) -> Self {
        Self {
            session_id,
            agents: BTreeMap::new(),
            events: Vec::new(),
            sequence: 0,
            clock: None,
        }
    }

    fn build(mut self, events: Vec<AdkEvent>) -> Result<ViewerSession, AdapterError> {
        for event in &events {
            // Streaming fragments repeat text that the final event also carries.
            // Folding both would double every message on the timeline.
            if event.partial == Some(true) {
                continue;
            }
            self.push_event(event);
        }

        if self.events.is_empty() {
            return Err(AdapterError::Empty);
        }

        let agents = self.agents.into_values().collect();
        Ok(ViewerSession::from_parts(
            self.session_id,
            ADAPTER_ID.to_string(),
            agents,
            self.events,
        ))
    }

    fn push_event(&mut self, event: &AdkEvent) {
        let timestamp = self.timestamp_of(event);
        let source_id = event
            .id
            .clone()
            .or_else(|| event.invocation_id.clone())
            .unwrap_or_else(|| format!("event-{}", self.sequence));

        // A `user` author is the human driving the run, not an agent. Their
        // message belongs to the agent that received it.
        let is_user = event.author.eq_ignore_ascii_case("user");
        let agent_id = if is_user {
            self.ensure_root_for(event, timestamp)
        } else {
            self.ensure_agent(event, timestamp)
        };

        if let Some(content) = &event.content {
            for part in &content.parts {
                // Reasoning. Dropped before it can reach anything renderable.
                if part.thought == Some(true) {
                    continue;
                }

                if let Some(text) = part.text.as_ref().map(|t| clean(t, MAX_TEXT)) {
                    if !text.is_empty() {
                        let from_user = is_user || content.role.as_deref() == Some("user");
                        self.emit(
                            &agent_id,
                            timestamp,
                            &source_id,
                            Payload::Message { text, from_user },
                        );
                    }
                }

                if let Some(call) = &part.function_call {
                    let call_id = call
                        .id
                        .clone()
                        .unwrap_or_else(|| format!("{}-{}", call.name, self.sequence));
                    self.emit(
                        &agent_id,
                        timestamp,
                        &source_id,
                        Payload::ToolCall {
                            call_id,
                            tool: call.name.clone(),
                            summary: preview(&call.args),
                        },
                    );
                }

                if let Some(response) = &part.function_response {
                    let call_id = response.id.clone().unwrap_or_else(|| {
                        format!("{}-result", response.name.clone().unwrap_or_default())
                    });
                    let is_error = response_is_error(&response.response);
                    self.emit(
                        &agent_id,
                        timestamp,
                        &source_id,
                        Payload::ToolResult {
                            call_id,
                            tool: response.name.clone().unwrap_or_else(|| "tool".to_string()),
                            summary: preview(&response.response),
                            is_error,
                        },
                    );
                }
            }
        }

        // An explicit delegation. Recorded even when the target never produced
        // an event of its own, because "handed off and nothing came back" is a
        // thing the developer needs to see.
        if let Some(actions) = &event.actions {
            if let Some(target) = actions.transfer_to_agent.as_deref() {
                let child_id = child_path(&agent_id, target);
                self.ensure_declared(&child_id, target, "transferred", Some(agent_id.clone()));
                let call_id = spawn_call_id(&child_id);
                self.emit(
                    &agent_id,
                    timestamp,
                    &source_id,
                    Payload::Spawn {
                        child_agent_id: child_id,
                        call_id,
                        description: format!("transfer_to_agent {target}"),
                    },
                );
            }
        }

        // Terminal state, only ever from what the session actually recorded.
        if event.error_code.is_some() || event.error_message.is_some() {
            let detail = event
                .error_message
                .clone()
                .or_else(|| event.error_code.clone())
                .unwrap_or_else(|| "error".to_string());
            self.emit(
                &agent_id,
                timestamp,
                &source_id,
                Payload::Status {
                    terminal: Terminal::Failed,
                    detail: clean(&detail, MAX_SUMMARY),
                },
            );
        } else if event.actions.as_ref().and_then(|a| a.escalate) == Some(true) {
            self.emit(
                &agent_id,
                timestamp,
                &source_id,
                Payload::Status {
                    terminal: Terminal::Completed,
                    detail: "escalated to caller".to_string(),
                },
            );
        } else if event.turn_complete == Some(true) {
            self.emit(
                &agent_id,
                timestamp,
                &source_id,
                Payload::Status {
                    terminal: Terminal::Completed,
                    detail: "turn complete".to_string(),
                },
            );
        }
    }

    fn emit(
        &mut self,
        agent_id: &str,
        timestamp: DateTime<Utc>,
        source_id: &str,
        payload: Payload,
    ) {
        self.events.push(ViewerEvent {
            sequence: self.sequence,
            agent_id: agent_id.to_string(),
            timestamp,
            payload,
            source_id: source_id.to_string(),
        });
        self.sequence += 1;
    }

    /// Resolve (and if needed declare) the agent an event belongs to, emitting
    /// a spawn on the parent the first time a child appears.
    fn ensure_agent(&mut self, event: &AdkEvent, timestamp: DateTime<Utc>) -> String {
        let path = agent_path(&event.author, event.branch.as_deref());
        if self.agents.contains_key(&path) {
            return path;
        }

        let parent = parent_of(&path);
        // Declare every ancestor, so a branch that names a parent we never saw
        // an event from still produces a connected tree rather than an orphan.
        if let Some(parent_id) = &parent {
            if !self.agents.contains_key(parent_id) {
                let label = leaf_of(parent_id).to_string();
                self.ensure_declared(parent_id, &label, "agent", parent_of(parent_id));
            }
        }

        self.ensure_declared(&path, &event.author, "agent", parent.clone());

        if let Some(parent_id) = parent {
            let call_id = spawn_call_id(&path);
            self.emit(
                &parent_id.clone(),
                timestamp,
                &format!("spawn:{path}"),
                Payload::Spawn {
                    child_agent_id: path.clone(),
                    call_id,
                    description: event.author.clone(),
                },
            );
        }
        path
    }

    /// The agent a user message was addressed to: the existing root, or a root
    /// declared from this event if the user spoke first.
    fn ensure_root_for(&mut self, event: &AdkEvent, timestamp: DateTime<Utc>) -> String {
        if let Some(root) = self
            .agents
            .values()
            .find(|agent| agent.parent_id.is_none())
            .map(|agent| agent.id.clone())
        {
            return root;
        }
        // The user spoke before any agent did. `branch` still names the agent
        // that received it when the runner recorded one.
        let path = match event.branch.as_deref() {
            Some(branch) if !branch.is_empty() => normalize(branch),
            _ => "root".to_string(),
        };
        let label = leaf_of(&path).to_string();
        self.ensure_declared(&path, &label, "agent", None);
        let _ = timestamp;
        path
    }

    fn ensure_declared(&mut self, id: &str, label: &str, kind: &str, parent_id: Option<String>) {
        self.agents
            .entry(id.to_string())
            .or_insert_with(|| ViewerAgent {
                id: id.to_string(),
                label: label.to_string(),
                kind: kind.to_string(),
                parent_id,
            });
    }

    /// Event time, preferring what the session recorded.
    ///
    /// When a record carries no timestamp the previous one is advanced by a
    /// millisecond rather than reused: equal timestamps would leave the merge
    /// order to sort stability across files, which is not something the
    /// timeline should depend on.
    fn timestamp_of(&mut self, event: &AdkEvent) -> DateTime<Utc> {
        let resolved = event
            .timestamp
            .and_then(|seconds| {
                let whole = seconds.trunc() as i64;
                let nanos = ((seconds - seconds.trunc()) * 1e9).round() as u32;
                Utc.timestamp_opt(whole, nanos.min(999_999_999)).single()
            })
            .unwrap_or_else(|| {
                self.clock
                    .map(|last| last + chrono::Duration::milliseconds(1))
                    .unwrap_or_else(Utc::now)
            });
        self.clock = Some(resolved);
        resolved
    }
}

// ---------------------------------------------------------------------------
// Naming and display helpers
// ---------------------------------------------------------------------------

/// Session-unique agent id.
///
/// `branch` is ADK's lineage path. It sometimes includes the current agent and
/// sometimes stops at its parent, so the author is appended only when the path
/// does not already end in it. Two sub-agents with the same author under
/// different parents therefore stay distinct nodes.
fn agent_path(author: &str, branch: Option<&str>) -> String {
    match branch.map(str::trim).filter(|b| !b.is_empty()) {
        None => author.to_string(),
        Some(branch) => {
            let path = normalize(branch);
            if leaf_of(&path) == author {
                path
            } else {
                format!("{path}/{author}")
            }
        }
    }
}

fn normalize(branch: &str) -> String {
    branch
        .split(['.', '/'])
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>()
        .join("/")
}

fn parent_of(path: &str) -> Option<String> {
    path.rsplit_once('/').map(|(head, _)| head.to_string())
}

fn leaf_of(path: &str) -> &str {
    path.rsplit_once('/').map_or(path, |(_, tail)| tail)
}

fn child_path(parent: &str, child: &str) -> String {
    format!("{parent}/{child}")
}

/// Deterministic correlation id for a spawn, so the child node attaches to the
/// parent's chip on every load rather than to whichever id was generated first.
fn spawn_call_id(child_path: &str) -> String {
    format!("spawn-{}", child_path.replace('/', "-"))
}

/// Collapse whitespace and bound the length, keeping whole characters.
fn clean(text: &str, limit: usize) -> String {
    let collapsed = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if collapsed.chars().count() <= limit {
        return collapsed;
    }
    let kept: String = collapsed.chars().take(limit.saturating_sub(1)).collect();
    format!("{kept}…")
}

/// A compact, bounded rendering of a JSON payload.
///
/// Objects become `key=value` pairs rather than raw JSON: the graph shows what
/// a tool was asked for without pasting a blob into a node label.
fn preview(value: &serde_json::Value) -> String {
    let rendered = match value {
        serde_json::Value::Null => String::new(),
        serde_json::Value::Object(map) => map
            .iter()
            .map(|(key, val)| format!("{key}={}", scalar(val)))
            .collect::<Vec<_>>()
            .join(" "),
        other => scalar(other),
    };
    clean(&rendered, MAX_SUMMARY)
}

fn scalar(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::String(text) => text.clone(),
        serde_json::Value::Null => "null".to_string(),
        serde_json::Value::Array(items) => format!("[{} items]", items.len()),
        serde_json::Value::Object(map) => format!("{{{} keys}}", map.len()),
        other => other.to_string(),
    }
}

/// Whether a `functionResponse` recorded a failure.
///
/// ADK has no dedicated error flag on a response, so this reads the keys tools
/// conventionally set. It is deliberately conservative: an unrecognised shape
/// is a success, because drawing a healthy call as failed is the more
/// misleading of the two mistakes.
fn response_is_error(value: &serde_json::Value) -> bool {
    let Some(map) = value.as_object() else {
        return false;
    };
    if map.contains_key("error") && !map["error"].is_null() {
        return true;
    }
    match map.get("status").and_then(|s| s.as_str()) {
        Some(status) => {
            status.eq_ignore_ascii_case("error") || status.eq_ignore_ascii_case("failed")
        }
        None => false,
    }
}
