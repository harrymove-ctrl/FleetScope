//! Anthropic Claude Code local sessions.
//!
//! # The dialect
//!
//! A main transcript at `<project>/<session-uuid>.jsonl`, one JSON envelope per
//! line, plus a sibling directory `<session-uuid>/subagents/` holding
//! `agent-<id>.jsonl` per sub-agent and an `agent-<id>.meta.json` sidecar. The
//! frontend hands the sub-agent files over as [`Companion`]s; this adapter
//! decides what they mean.
//!
//! Envelopes carry `type` (`assistant` / `user` / `system` and several
//! non-conversational kinds), `uuid`, `parentUuid`, `timestamp`, `sessionId`,
//! `version`, and on sub-agent lines `agentId` and `isSidechain`. An assistant
//! message's `content` is a block list of `text` / `thinking` / `tool_use`; a
//! user message's is either a plain string or a `tool_result` list.
//!
//! # Why this adapter exists
//!
//! It is the second provider, and its job is to prove the ingestion boundary is
//! real: it shares no parsing with the ADK adapter, and the viewer, the wire
//! emitter and both frontends needed no change to gain it.
//!
//! It does NOT reuse the vendored renderer's parser. That parser is a serde
//! model for this same format and is used to read the renderer's OWN input one
//! layer down; borrowing it here would make a provider's transcript the domain
//! model, which is the thing the plan forbids.
//!
//! # The two rules, again
//!
//! `thinking` blocks are dropped, and the `prompt` field of an `Agent` spawn is
//! never read into a label. Terminal state comes only from a recorded fact: a
//! sub-agent is `Completed` or `Failed` because the main transcript carries the
//! `tool_result` that answered its spawn.

use std::collections::BTreeMap;

use chrono::{DateTime, Utc};
use serde::Deserialize;

use super::{AdapterError, Companion, Confidence, SessionAdapter, SessionSource};
use crate::viewer::{Payload, Terminal, ViewerAgent, ViewerEvent, ViewerSession};

pub const ADAPTER_ID: &str = "claude-code@1";

/// The tool names that mean "hand work to a sub-agent".
const SPAWN_TOOLS: [&str; 2] = ["Agent", "Task"];
/// The root agent's id. The format has no name for it; the transcript is it.
const ROOT_ID: &str = "main";

/// How many lines detection reads before deciding.
const PROBE_LINES: usize = 40;

const MAX_TEXT: usize = 160;
const MAX_SUMMARY: usize = 120;

pub struct ClaudeCodeAdapter;

// ---------------------------------------------------------------------------
// Wire types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct Envelope {
    #[serde(rename = "type")]
    kind: String,
    #[serde(default)]
    uuid: Option<String>,
    #[serde(default)]
    timestamp: Option<DateTime<Utc>>,
    #[serde(rename = "sessionId", default)]
    session_id: Option<String>,
    #[serde(rename = "agentId", default)]
    agent_id: Option<String>,
    #[serde(default)]
    message: Option<Message>,
}

#[derive(Debug, Deserialize)]
struct Message {
    #[serde(default)]
    role: Option<String>,
    #[serde(default)]
    content: Content,
}

#[derive(Debug, Default, Deserialize)]
#[serde(untagged)]
enum Content {
    Text(String),
    Blocks(Vec<Block>),
    #[default]
    Absent,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum Block {
    #[serde(rename = "text")]
    Text {
        #[serde(default)]
        text: String,
    },
    /// Model reasoning. Deserialized so it can be recognised and dropped, never
    /// so it can be rendered.
    #[serde(rename = "thinking")]
    Thinking(serde::de::IgnoredAny),
    #[serde(rename = "tool_use")]
    ToolUse {
        #[serde(default)]
        id: Option<String>,
        #[serde(default)]
        name: Option<String>,
        #[serde(default)]
        input: serde_json::Value,
    },
    #[serde(rename = "tool_result")]
    ToolResult {
        #[serde(rename = "tool_use_id", default)]
        tool_use_id: Option<String>,
        #[serde(default)]
        content: serde_json::Value,
        #[serde(rename = "is_error", default)]
        is_error: bool,
    },
    #[serde(other)]
    Other,
}

/// The `agent-<id>.meta.json` sidecar.
#[derive(Debug, Default, Deserialize)]
struct SubagentMeta {
    #[serde(rename = "agentType", default)]
    agent_type: Option<String>,
    #[serde(default)]
    description: Option<String>,
    #[serde(rename = "toolUseId", default)]
    tool_use_id: Option<String>,
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

impl SessionAdapter for ClaudeCodeAdapter {
    fn id(&self) -> &'static str {
        ADAPTER_ID
    }

    fn label(&self) -> &'static str {
        "Claude Code session"
    }

    fn detect(&self, source: &SessionSource) -> Confidence {
        let mut best = Confidence::No;

        for line in source.probe_lines(PROBE_LINES) {
            let Ok(value) = serde_json::from_str::<serde_json::Value>(line) else {
                continue;
            };

            // `author` is ADK's discriminator. Seeing it means the file is the
            // other dialect, so decline outright rather than fight over it.
            if value.get("author").is_some() {
                return Confidence::No;
            }
            if value.get("type").and_then(|t| t.as_str()).is_none() {
                continue;
            }

            // The envelope is `uuid` + `parentUuid` + `sessionId` together. Any
            // one alone could be coincidence; the set is the format. Which
            // `type` a line carries is deliberately NOT part of this: producers
            // add entry kinds (queued operations, attachments, titles, mode
            // changes) between releases, and a detector that enumerates them
            // starts refusing sessions every time one is added.
            if value.get("uuid").is_some()
                && value.get("parentUuid").is_some()
                && value.get("sessionId").is_some()
            {
                return Confidence::Yes;
            }
            if value.get("message").is_some() {
                best = Confidence::Maybe;
            }
        }

        best
    }

    fn detected_version(&self, source: &SessionSource) -> Option<String> {
        source.probe_lines(PROBE_LINES).find_map(|line| {
            serde_json::from_str::<serde_json::Value>(line)
                .ok()?
                .get("version")?
                .as_str()
                .map(str::to_string)
        })
    }

    fn parse(&self, source: &SessionSource) -> Result<ViewerSession, AdapterError> {
        Builder::new().build(source)
    }
}

// ---------------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------------

struct Builder {
    agents: BTreeMap<String, ViewerAgent>,
    events: Vec<ViewerEvent>,
    sequence: u64,
    clock: Option<DateTime<Utc>>,
    /// Spawn `tool_use` id → the child agent it created, so the answering
    /// `tool_result` can be turned into that child's terminal event.
    spawned: BTreeMap<String, String>,
    /// Call id → tool name. A `tool_result` does not repeat the name of the
    /// tool it answers, but the call did, and rendering a failed `Edit` as a
    /// failed "tool" throws away the one detail that makes it actionable.
    tool_names: BTreeMap<String, String>,
}

impl Builder {
    fn new() -> Self {
        Self {
            agents: BTreeMap::new(),
            events: Vec::new(),
            sequence: 0,
            clock: None,
            spawned: BTreeMap::new(),
            tool_names: BTreeMap::new(),
        }
    }

    fn build(mut self, source: &SessionSource) -> Result<ViewerSession, AdapterError> {
        let metas = read_metas(source);

        self.declare(ROOT_ID, "main", "session", None);

        // Sub-agents are declared before any transcript is read, so a spawn in
        // the main file can attach to a child the companion tree already names.
        for (agent_id, meta) in &metas {
            let label = meta
                .agent_type
                .clone()
                .or_else(|| meta.description.clone())
                .unwrap_or_else(|| agent_id.clone());
            self.declare(agent_id, &label, "subagent", Some(ROOT_ID.to_string()));
            if let Some(tool_use_id) = &meta.tool_use_id {
                self.spawned.insert(tool_use_id.clone(), agent_id.clone());
            }
        }

        let session_id = self.read_transcript(&source.text, ROOT_ID, source)?;

        for companion in subagent_files(source, ".jsonl") {
            let agent_id = agent_id_of(&companion.name);
            if !self.agents.contains_key(&agent_id) {
                // A transcript with no sidecar. Still shown: an agent whose
                // metadata is missing is not an agent that did not run.
                self.declare(&agent_id, &agent_id, "subagent", Some(ROOT_ID.to_string()));
            }
            self.read_transcript(&companion.text, &agent_id, source)?;
        }

        if self.events.is_empty() {
            return Err(AdapterError::Empty);
        }

        // Safety net for a join that did not line up.
        //
        // `inspect` and the graph both walk DOWN from the root, so an event
        // attributed to an agent nobody declared is invisible: not an error,
        // not a warning, just missing work. Declaring the agent instead makes a
        // bad join show up as an extra node, which someone will notice and can
        // report, rather than as activity that quietly is not there.
        let referenced: Vec<String> = self
            .events
            .iter()
            .map(|event| event.agent_id.clone())
            .filter(|id| !self.agents.contains_key(id))
            .collect();
        for id in referenced {
            self.declare(&id, &id, "subagent", Some(ROOT_ID.to_string()));
        }

        let session_id = session_id.unwrap_or_else(|| fallback_id(source));
        let agents = self.agents.into_values().collect();
        Ok(ViewerSession::from_parts(
            session_id,
            ADAPTER_ID.to_string(),
            agents,
            self.events,
        ))
    }

    /// Read one transcript file, attributing everything to `default_agent`
    /// unless a line names its own `agentId`.
    fn read_transcript(
        &mut self,
        text: &str,
        default_agent: &str,
        _source: &SessionSource,
    ) -> Result<Option<String>, AdapterError> {
        let mut session_id = None;

        for (offset, raw) in text.lines().enumerate() {
            let line = raw.trim();
            if line.is_empty() {
                continue;
            }
            let envelope: Envelope = match serde_json::from_str(line) {
                Ok(envelope) => envelope,
                Err(error) => {
                    return Err(AdapterError::Malformed {
                        line: Some(offset + 1),
                        message: error.to_string(),
                    })
                }
            };

            // Non-conversational bookkeeping: queue operations, mode changes,
            // titles, PR links. Real records, but not agent activity.
            if !matches!(envelope.kind.as_str(), "assistant" | "user") {
                continue;
            }
            if session_id.is_none() {
                session_id = envelope.session_id.clone();
            }

            let timestamp = self.timestamp_of(envelope.timestamp);
            let source_id = envelope
                .uuid
                .clone()
                .unwrap_or_else(|| format!("line-{}", offset + 1));
            let agent_id = envelope
                .agent_id
                .clone()
                .unwrap_or_else(|| default_agent.to_string());

            let Some(message) = envelope.message else {
                continue;
            };
            let from_user = message.role.as_deref() == Some("user");

            match message.content {
                Content::Absent => {}
                Content::Text(text) => {
                    let text = clean(&text, MAX_TEXT);
                    if !text.is_empty() {
                        self.emit(
                            &agent_id,
                            timestamp,
                            &source_id,
                            Payload::Message { text, from_user },
                        );
                    }
                }
                Content::Blocks(blocks) => {
                    for block in blocks {
                        self.push_block(block, &agent_id, timestamp, &source_id, from_user);
                    }
                }
            }
        }

        Ok(session_id)
    }

    fn push_block(
        &mut self,
        block: Block,
        agent_id: &str,
        timestamp: DateTime<Utc>,
        source_id: &str,
        from_user: bool,
    ) {
        match block {
            // Reasoning. Recognised only so it can be dropped here, before it
            // can reach a label, a node or a detail panel.
            Block::Thinking(_) | Block::Other => {}
            Block::Text { text } => {
                let text = clean(&text, MAX_TEXT);
                if !text.is_empty() {
                    self.emit(
                        agent_id,
                        timestamp,
                        source_id,
                        Payload::Message { text, from_user },
                    );
                }
            }
            Block::ToolUse { id, name, input } => {
                let call_id = id.unwrap_or_else(|| format!("call-{}", self.sequence));
                let tool = name.unwrap_or_else(|| "tool".to_string());

                if SPAWN_TOOLS.contains(&tool.as_str()) {
                    // `input.prompt` is deliberately NOT read: it is a prompt,
                    // and a prompt on a spawn is what the renderer's detail
                    // panel would draw as a provenance row.
                    let description = input
                        .get("description")
                        .and_then(|d| d.as_str())
                        .map(|d| clean(d, MAX_SUMMARY))
                        .unwrap_or_else(|| "subagent".to_string());
                    let child = self
                        .spawned
                        .get(&call_id)
                        .cloned()
                        .unwrap_or_else(|| format!("agent-{call_id}"));
                    let label = input
                        .get("subagent_type")
                        .and_then(|s| s.as_str())
                        .unwrap_or(&child)
                        .to_string();
                    self.declare(&child, &label, "subagent", Some(ROOT_ID.to_string()));
                    self.spawned.insert(call_id.clone(), child.clone());
                    self.emit(
                        agent_id,
                        timestamp,
                        source_id,
                        Payload::Spawn {
                            child_agent_id: child,
                            call_id,
                            description,
                        },
                    );
                } else {
                    self.tool_names.insert(call_id.clone(), tool.clone());
                    self.emit(
                        agent_id,
                        timestamp,
                        source_id,
                        Payload::ToolCall {
                            call_id,
                            tool,
                            summary: preview(&input),
                        },
                    );
                }
            }
            Block::ToolResult {
                tool_use_id,
                content,
                is_error,
            } => {
                let call_id = tool_use_id.unwrap_or_else(|| format!("result-{}", self.sequence));

                // The answer to a spawn is the sub-agent's terminal event, and
                // it is a recorded fact rather than an inference from silence.
                if let Some(child) = self.spawned.get(&call_id).cloned() {
                    let terminal = if is_error {
                        Terminal::Failed
                    } else {
                        Terminal::Completed
                    };
                    self.emit(
                        &child,
                        timestamp,
                        source_id,
                        Payload::Status {
                            terminal,
                            detail: preview(&content),
                        },
                    );
                    return;
                }

                let tool = self
                    .tool_names
                    .get(&call_id)
                    .cloned()
                    // A result whose call was never seen. Real: a sub-agent's
                    // call can be answered in a file read before its own.
                    .unwrap_or_else(|| "tool".to_string());
                self.emit(
                    agent_id,
                    timestamp,
                    source_id,
                    Payload::ToolResult {
                        call_id,
                        tool,
                        summary: preview(&content),
                        is_error,
                    },
                );
            }
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

    fn declare(&mut self, id: &str, label: &str, kind: &str, parent_id: Option<String>) {
        self.agents
            .entry(id.to_string())
            .or_insert_with(|| ViewerAgent {
                id: id.to_string(),
                label: label.to_string(),
                kind: kind.to_string(),
                parent_id,
            });
    }

    fn timestamp_of(&mut self, recorded: Option<DateTime<Utc>>) -> DateTime<Utc> {
        let resolved = recorded.unwrap_or_else(|| {
            self.clock
                .map(|last| last + chrono::Duration::milliseconds(1))
                .unwrap_or_else(|| DateTime::UNIX_EPOCH)
        });
        self.clock = Some(resolved);
        resolved
    }
}

// ---------------------------------------------------------------------------
// Companions and display helpers
// ---------------------------------------------------------------------------

fn read_metas(source: &SessionSource) -> BTreeMap<String, SubagentMeta> {
    subagent_files(source, ".meta.json")
        .filter_map(|companion| {
            let meta: SubagentMeta = serde_json::from_str(&companion.text).ok()?;
            Some((agent_id_of(&companion.name), meta))
        })
        .collect()
}

/// The directory sub-agent files live in, relative to the companion root.
const SUBAGENT_DIR: &str = "subagents/";

/// Companions that are sub-agent files, and only those.
///
/// A sub-agent file sits DIRECTLY under `subagents/`. The tree also holds
/// `subagents/workflows/<id>/…`, `workflows/…` and `tool-results/…`, which are
/// different concepts entirely — a real session put 127 workflow files under
/// one of those directories, and treating every `.jsonl` in the tree as a
/// sub-agent turned a two-agent session into an 82-agent one. The frontend
/// collects the tree structurally; deciding what a path MEANS is the adapter's
/// job, and this is that decision.
fn subagent_files<'a>(
    source: &'a SessionSource,
    suffix: &'a str,
) -> impl Iterator<Item = &'a Companion> + 'a {
    source.companions_ending(suffix).filter(|companion| {
        companion
            .name
            .strip_prefix(SUBAGENT_DIR)
            .is_some_and(|rest| !rest.contains('/'))
    })
}

/// The agent id a companion filename names.
///
/// `subagents/agent-a1b2.jsonl` and `subagents/agent-a1b2.meta.json` both name
/// the agent `a1b2`. The `agent-` prefix is a FILENAME convention only: the
/// lines inside carry `agentId: "a1b2"` without it, and that field is the
/// authoritative join key. Keeping the prefix here silently orphans every event
/// in the file, which is exactly what happened before this stripped it.
fn agent_id_of(name: &str) -> String {
    let file = name.rsplit('/').next().unwrap_or(name);
    let stem = file
        .strip_suffix(".meta.json")
        .or_else(|| file.strip_suffix(".jsonl"))
        .unwrap_or(file);
    stem.strip_prefix("agent-").unwrap_or(stem).to_string()
}

fn fallback_id(source: &SessionSource) -> String {
    source
        .path
        .file_stem()
        .map(|stem| stem.to_string_lossy().into_owned())
        .unwrap_or_else(|| "session".to_string())
}

fn clean(text: &str, limit: usize) -> String {
    let collapsed = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if collapsed.chars().count() <= limit {
        return collapsed;
    }
    let kept: String = collapsed.chars().take(limit.saturating_sub(1)).collect();
    format!("{kept}…")
}

fn preview(value: &serde_json::Value) -> String {
    let rendered = match value {
        serde_json::Value::Null => String::new(),
        serde_json::Value::String(text) => text.clone(),
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
