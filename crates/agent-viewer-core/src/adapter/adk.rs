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

use std::collections::{BTreeMap, BTreeSet};

use chrono::{DateTime, Duration, TimeZone, Utc};
use serde::{Deserialize, Serialize};

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

#[derive(Clone, Debug, Deserialize, Serialize)]
struct AdkSessionFile {
    #[serde(default)]
    id: Option<String>,
    #[serde(default, alias = "app_name", alias = "appName")]
    app_name: Option<String>,
    events: Vec<AdkEvent>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
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
    #[serde(default, alias = "model_version", alias = "modelVersion")]
    model_version: Option<String>,
    #[serde(default, alias = "custom_metadata", alias = "customMetadata")]
    custom_metadata: Option<AdkCustomMetadata>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
struct AdkCustomMetadata {
    #[serde(default)]
    fleetscope: Option<FleetScopeMetadata>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
struct FleetScopeMetadata {
    #[serde(default)]
    framework: Option<String>,
    #[serde(default, alias = "framework_version", alias = "frameworkVersion")]
    framework_version: Option<String>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
struct AdkActions {
    #[serde(default, alias = "transfer_to_agent", alias = "transferToAgent")]
    transfer_to_agent: Option<String>,
    #[serde(default)]
    escalate: Option<bool>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
struct AdkContent {
    #[serde(default)]
    role: Option<String>,
    #[serde(default)]
    parts: Vec<AdkPart>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
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

#[derive(Clone, Debug, Deserialize, Serialize)]
struct AdkFunctionCall {
    #[serde(default)]
    id: Option<String>,
    name: String,
    #[serde(default)]
    args: serde_json::Value,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
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

    fn detected_version(&self, source: &SessionSource) -> Option<String> {
        let (_, events) = read_events(source).ok()?;
        producer_stamp(&events)
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

/// Report only producer-owned execution evidence.
///
/// FleetScope's recorder also stores `configuredModel` under custom metadata,
/// but configuration is not proof that a provider executed that model. The
/// model label therefore comes exclusively from ADK's top-level `modelVersion`.
fn producer_stamp(events: &[AdkEvent]) -> Option<String> {
    let metadata = events.iter().find_map(|event| {
        event
            .custom_metadata
            .as_ref()
            .and_then(|custom| custom.fleetscope.as_ref())
    });
    let framework_version = metadata
        .and_then(|value| value.framework_version.as_deref())
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let framework = metadata
        .and_then(|value| value.framework.as_deref())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("google-adk");
    let model = events
        .iter()
        .filter_map(|event| event.model_version.as_deref())
        .map(str::trim)
        .find(|value| !value.is_empty());

    match (framework_version, model) {
        (Some(version), Some(model)) => Some(format!("{framework} {version} · model {model}")),
        (Some(version), None) => Some(format!("{framework} {version}")),
        (None, Some(model)) => Some(format!("model {model}")),
        (None, None) => None,
    }
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

#[derive(Clone)]
struct PreparedEvent {
    event: AdkEvent,
    timestamp: DateTime<Utc>,
    /// A stable identity plus content digest. Exact duplicate records collapse
    /// before projection; records that reuse an id with different content stay
    /// visible and sort deterministically.
    key: String,
}

struct PendingEvent {
    timestamp: DateTime<Utc>,
    /// Spawns sort before the event evidence at the same timestamp. The rank
    /// is part of the projection contract, not renderer-specific ordering.
    rank: u8,
    order_key: String,
    agent_id: String,
    source_id: String,
    payload: Payload,
}

/// Canonicalize an ADK stream before it reaches the state builder.
///
/// The producer is append-only, but live delivery, file merges and retries can
/// expose records in a different order or more than once. A projection that
/// creates graph edges while walking input is therefore order-dependent. This
/// pass removes exact duplicates, gives every record a stable sort key, and
/// assigns deterministic timestamps to records that did not carry one.
fn prepare_events(events: Vec<AdkEvent>) -> Vec<PreparedEvent> {
    let mut unique = BTreeMap::<String, AdkEvent>::new();
    for event in events {
        // Streaming fragments repeat text that the final event also carries.
        // Folding both would double every message on the timeline.
        if event.partial == Some(true) {
            continue;
        }
        let key = stable_event_key(&event);
        unique.entry(key).or_insert(event);
    }

    let mut recorded = Vec::new();
    let mut missing = Vec::new();
    for (key, event) in unique {
        let timestamp = recorded_timestamp(event.timestamp);
        let item = (key, event, timestamp);
        if timestamp.is_some() {
            recorded.push(item);
        } else {
            missing.push(item);
        }
    }

    let fallback_base = recorded
        .iter()
        .filter_map(|(_, _, timestamp)| *timestamp)
        .max()
        .unwrap_or_else(|| {
            Utc.timestamp_opt(0, 0)
                .single()
                .expect("unix epoch is valid")
        });

    // Missing timestamps are explicitly placed after timestamped evidence and
    // ordered by stable identity. They are not assigned wall-clock time, so a
    // replay cannot change merely because it ran later.
    missing.sort_by(|left, right| left.0.cmp(&right.0));
    let mut prepared = recorded
        .into_iter()
        .filter_map(|(key, event, timestamp)| {
            Some(PreparedEvent {
                event,
                timestamp: timestamp?,
                key,
            })
        })
        .collect::<Vec<_>>();
    for (offset, (key, event, _)) in missing.into_iter().enumerate() {
        prepared.push(PreparedEvent {
            event,
            timestamp: add_millis(fallback_base, offset + 1),
            key,
        });
    }

    // Timestamps are producer evidence; the stable key only breaks ties. The
    // resulting order is independent of filesystem/arrival order.
    prepared.sort_by(|left, right| {
        left.timestamp
            .cmp(&right.timestamp)
            .then_with(|| left.key.cmp(&right.key))
    });
    prepared
}

fn recorded_timestamp(seconds: Option<f64>) -> Option<DateTime<Utc>> {
    let seconds = seconds?;
    if !seconds.is_finite() {
        return None;
    }
    let whole = seconds.floor();
    if whole < i64::MIN as f64 || whole > i64::MAX as f64 {
        return None;
    }
    let mut whole = whole as i64;
    let nanos = ((seconds - whole as f64) * 1e9).round() as i64;
    let nanos = if nanos >= 1_000_000_000 {
        whole = whole.checked_add(1)?;
        0
    } else {
        nanos
    };
    Utc.timestamp_opt(whole, nanos as u32).single()
}

fn add_millis(base: DateTime<Utc>, offset: usize) -> DateTime<Utc> {
    let offset = i64::try_from(offset).unwrap_or(i64::MAX);
    base.checked_add_signed(Duration::milliseconds(offset))
        .unwrap_or(base)
}

fn stable_event_key(event: &AdkEvent) -> String {
    let canonical = serde_json::to_string(event).expect("ADK wire types are serializable");
    let digest = stable_digest(&canonical);
    match event.id.as_deref().filter(|id| !id.trim().is_empty()) {
        Some(id) => format!("id:{id}:{digest:016x}"),
        None => format!("event:{digest:016x}"),
    }
}

fn stable_digest(value: &str) -> u64 {
    let mut hash = 0xcbf2_9ce4_8422_2325_u64;
    for byte in value.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
    }
    hash
}

struct Builder {
    session_id: String,
    agents: BTreeMap<String, ViewerAgent>,
    pending: Vec<PendingEvent>,
    root_id: String,
}

impl Builder {
    fn new(session_id: String) -> Self {
        Self {
            session_id,
            agents: BTreeMap::new(),
            pending: Vec::new(),
            root_id: "root".to_string(),
        }
    }

    fn build(mut self, events: Vec<AdkEvent>) -> Result<ViewerSession, AdapterError> {
        let events = prepare_events(events);
        if events.is_empty() {
            return Err(AdapterError::Empty);
        }

        self.declare_agents(&events);
        for event in &events {
            self.push_event(event);
        }

        if self.pending.is_empty() {
            return Err(AdapterError::Empty);
        }

        self.pending.sort_by(|left, right| {
            left.timestamp
                .cmp(&right.timestamp)
                .then_with(|| left.rank.cmp(&right.rank))
                .then_with(|| left.order_key.cmp(&right.order_key))
        });
        let rendered = self
            .pending
            .into_iter()
            .enumerate()
            .map(|(sequence, event)| ViewerEvent {
                sequence: sequence as u64,
                agent_id: event.agent_id,
                timestamp: event.timestamp,
                payload: event.payload,
                source_id: event.source_id,
            })
            .collect();

        let agents = self.agents.into_values().collect();
        Ok(ViewerSession::from_parts(
            self.session_id,
            ADAPTER_ID.to_string(),
            agents,
            rendered,
        ))
    }

    /// Discover every agent before emitting events. This makes a spawn a
    /// function of the complete event set, rather than of whichever record was
    /// encountered first.
    fn declare_agents(&mut self, events: &[PreparedEvent]) {
        let mut root_candidates = BTreeSet::new();
        for prepared in events {
            let event = &prepared.event;
            if event.author.eq_ignore_ascii_case("user") {
                if let Some(root) = branch_root(event.branch.as_deref()) {
                    root_candidates.insert(root.clone());
                    self.ensure_path(&root, &root, "agent");
                }
                continue;
            }

            let path = agent_path(&event.author, event.branch.as_deref());
            self.ensure_path(&path, &event.author, "agent");
            if parent_of(&path).is_none() {
                root_candidates.insert(path);
            }
        }

        self.root_id = root_candidates
            .into_iter()
            .next()
            .or_else(|| {
                self.agents
                    .values()
                    .find(|agent| agent.parent_id.is_none())
                    .map(|agent| agent.id.clone())
            })
            .unwrap_or_else(|| "root".to_string());
        self.ensure_path(&self.root_id.clone(), &self.root_id.clone(), "agent");

        // Transfers can declare a child that never emits an event of its own.
        // Add those paths after the root is stable, so user-authored transfers
        // cannot create a second competing root.
        for prepared in events {
            let event = &prepared.event;
            let parent = self.event_agent_id(event);
            if let Some(target) = event
                .actions
                .as_ref()
                .and_then(|actions| actions.transfer_to_agent.as_deref())
            {
                self.ensure_path(&child_path(&parent, target), target, "transferred");
            }
        }

        // Exactly one spawn per non-root agent, at the earliest evidence that
        // names that agent or one of its descendants.
        for agent in self.agents.values() {
            let Some(parent_id) = agent.parent_id.as_deref() else {
                continue;
            };
            let id = agent.id.clone();
            let evidence = events
                .iter()
                .filter_map(|prepared| {
                    let event = &prepared.event;
                    let event_agent = self.event_agent_id(event);
                    let names_agent =
                        event_agent == id || event_agent.starts_with(&format!("{id}/"));
                    let transfer_agent = event
                        .actions
                        .as_ref()
                        .and_then(|actions| actions.transfer_to_agent.as_deref())
                        .map(|target| child_path(&event_agent, target) == id)
                        .unwrap_or(false);
                    (names_agent || transfer_agent)
                        .then_some((prepared.timestamp, prepared.key.clone()))
                })
                .min_by(|left, right| left.cmp(right));
            let timestamp = evidence.map(|(timestamp, _)| timestamp).unwrap_or_else(|| {
                Utc.timestamp_opt(0, 0)
                    .single()
                    .expect("unix epoch is valid")
            });
            self.pending.push(PendingEvent {
                timestamp,
                rank: 0,
                order_key: format!("spawn:{id}"),
                agent_id: parent_id.to_string(),
                source_id: format!("spawn:{id}"),
                payload: Payload::Spawn {
                    child_agent_id: id,
                    call_id: spawn_call_id(&agent.id),
                    description: agent.label.clone(),
                },
            });
        }
    }

    fn push_event(&mut self, prepared: &PreparedEvent) {
        let event = &prepared.event;
        let source_id = source_id(event, &prepared.key);
        let is_user = event.author.eq_ignore_ascii_case("user");
        let agent_id = self.event_agent_id(event);
        let mut part_index = 0usize;

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
                            prepared,
                            part_index,
                            &agent_id,
                            &source_id,
                            Payload::Message { text, from_user },
                        );
                        part_index += 1;
                    }
                }

                if let Some(call) = &part.function_call {
                    let call_id = call
                        .id
                        .clone()
                        .unwrap_or_else(|| format!("{}-{}", call.name, prepared.key));
                    self.emit(
                        prepared,
                        part_index,
                        &agent_id,
                        &source_id,
                        Payload::ToolCall {
                            call_id,
                            tool: call.name.clone(),
                            summary: preview(&call.args),
                        },
                    );
                    part_index += 1;
                }

                if let Some(response) = &part.function_response {
                    let call_id = response.id.clone().unwrap_or_else(|| {
                        format!(
                            "{}-result-{}",
                            response.name.clone().unwrap_or_default(),
                            prepared.key
                        )
                    });
                    let is_error = response_is_error(&response.response);
                    self.emit(
                        prepared,
                        part_index,
                        &agent_id,
                        &source_id,
                        Payload::ToolResult {
                            call_id,
                            tool: response.name.clone().unwrap_or_else(|| "tool".to_string()),
                            summary: preview(&response.response),
                            is_error,
                        },
                    );
                    part_index += 1;
                }
            }
        }

        // Spawn evidence is emitted once during the declaration pass. Keeping
        // it out of this event walk is what makes shuffled input converge.

        // Terminal state, only ever from what the session actually recorded.
        if event.error_code.is_some() || event.error_message.is_some() {
            let detail = event
                .error_message
                .clone()
                .or_else(|| event.error_code.clone())
                .unwrap_or_else(|| "error".to_string());
            self.emit(
                prepared,
                part_index,
                &agent_id,
                &source_id,
                Payload::Status {
                    terminal: Terminal::Failed,
                    detail: clean(&detail, MAX_SUMMARY),
                },
            );
        } else if event.actions.as_ref().and_then(|a| a.escalate) == Some(true) {
            self.emit(
                prepared,
                part_index,
                &agent_id,
                &source_id,
                Payload::Status {
                    terminal: Terminal::Completed,
                    detail: "escalated to caller".to_string(),
                },
            );
        } else if event.turn_complete == Some(true) {
            self.emit(
                prepared,
                part_index,
                &agent_id,
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
        prepared: &PreparedEvent,
        part_index: usize,
        agent_id: &str,
        source_id: &str,
        payload: Payload,
    ) {
        self.pending.push(PendingEvent {
            timestamp: prepared.timestamp,
            rank: 1,
            order_key: format!("{}:{part_index:04}", prepared.key),
            agent_id: agent_id.to_string(),
            source_id: source_id.to_string(),
            payload,
        });
    }

    fn event_agent_id(&self, event: &AdkEvent) -> String {
        if event.author.eq_ignore_ascii_case("user") {
            branch_root(event.branch.as_deref())
                .filter(|id| self.agents.contains_key(id))
                .unwrap_or_else(|| self.root_id.clone())
        } else {
            agent_path(&event.author, event.branch.as_deref())
        }
    }

    fn ensure_path(&mut self, id: &str, label: &str, kind: &str) {
        let mut current = String::new();
        let segments = id
            .split('/')
            .filter(|segment| !segment.is_empty())
            .collect::<Vec<_>>();
        for (index, segment) in segments.iter().enumerate() {
            if !current.is_empty() {
                current.push('/');
            }
            current.push_str(segment);
            let is_leaf = index + 1 == segments.len();
            let node_label = if is_leaf { label } else { segment };
            let node_kind = if is_leaf { kind } else { "agent" };
            let parent_id = parent_of(&current);
            self.agents
                .entry(current.clone())
                .or_insert_with(|| ViewerAgent {
                    id: current.clone(),
                    label: node_label.to_string(),
                    kind: node_kind.to_string(),
                    parent_id,
                });
        }
    }
}

fn source_id(event: &AdkEvent, key: &str) -> String {
    event
        .id
        .clone()
        .filter(|id| !id.trim().is_empty())
        .or_else(|| {
            event
                .invocation_id
                .clone()
                .filter(|id| !id.trim().is_empty())
        })
        .unwrap_or_else(|| format!("event-{}", key.rsplit(':').next().unwrap_or(key)))
}

fn branch_root(branch: Option<&str>) -> Option<String> {
    let normalized = normalize(branch?.trim());
    normalized
        .split('/')
        .next()
        .map(str::to_string)
        .filter(|id| !id.is_empty())
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
