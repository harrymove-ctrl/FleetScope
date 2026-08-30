//! The provider-neutral session model the Agent Viewer actually renders.
//!
//! # Why this type exists
//!
//! Everything upstream of it is provider dialect: Google ADK writes `Event`
//! objects with `author`/`branch`/`parts`, a future provider will write
//! something else. Everything downstream of it is rendering. This module is the
//! narrow waist between the two, so onboarding a provider is an additive
//! [`crate::adapter::SessionAdapter`] impl and touches no rendering code.
//!
//! It is deliberately NOT FleetScope's enterprise Canonical Event schema. That
//! schema lives in `packages/event-schema` and describes a governed multi-week
//! Case: registry resolutions, identity decisions, gateway routes, approvals.
//! A local Gemini session has none of those and inventing them would put
//! unrecorded fields into an audit vocabulary. The two meet later, at the
//! Phase 4 platform boundary, not here.

use chrono::{DateTime, Utc};
use serde::Serialize;

/// One agent in the session tree.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ViewerAgent {
    /// Stable identity within the session. For ADK this is the branch path, so
    /// two sub-agents with the same `author` under different parents stay
    /// distinct nodes instead of collapsing into one.
    pub id: String,
    /// What the developer sees on the node.
    pub label: String,
    /// The provider's own name for the agent's kind, shown in the detail panel.
    pub kind: String,
    pub parent_id: Option<String>,
}

impl ViewerAgent {
    pub fn is_root(&self) -> bool {
        self.parent_id.is_none()
    }
}

/// Terminal disposition of an agent, as *stated by the session*.
///
/// Derived counts elsewhere may say an agent looks idle; this enum only ever
/// carries what the provider actually recorded. Ground-truth events outrank
/// inferred liveness, so an agent with no terminal event is `None`, never
/// "probably completed".
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Terminal {
    Completed,
    Failed,
}

/// What one viewer event says happened.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Payload {
    /// A parent handed work to a child. `call_id` is the correlation the
    /// renderer uses to attach the child's node to the parent's chip.
    Spawn {
        child_agent_id: String,
        call_id: String,
        description: String,
    },
    /// A prompt or a model response, already reduced to display-safe text.
    Message { text: String, from_user: bool },
    /// A tool invocation that has not been answered yet.
    ToolCall {
        call_id: String,
        tool: String,
        summary: String,
    },
    /// The answer to a [`Payload::ToolCall`] with the same `call_id`.
    ToolResult {
        call_id: String,
        tool: String,
        summary: String,
        is_error: bool,
    },
    /// An explicit terminal event. Never synthesized from a timeout.
    Status { terminal: Terminal, detail: String },
}

/// One ordered thing that happened, attributed to one agent.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ViewerEvent {
    /// Total order within the session, assigned by the adapter. Ordering is the
    /// adapter's responsibility because only it knows whether the provider's
    /// timestamps are trustworthy; the renderer never re-sorts.
    pub sequence: u64,
    pub agent_id: String,
    pub timestamp: DateTime<Utc>,
    pub payload: Payload,
    /// The provider's own id for the record this came from, so `inspect` output
    /// can be traced back to the file the developer owns.
    pub source_id: String,
}

/// A whole local session: the agent tree plus its ordered events.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ViewerSession {
    pub session_id: String,
    /// Which adapter produced this, e.g. `google-adk@1`.
    pub adapter_id: String,
    /// Root first, then children. [`ViewerSession::from_parts`] enforces it.
    pub agents: Vec<ViewerAgent>,
    pub events: Vec<ViewerEvent>,
}

impl ViewerSession {
    /// Assemble a session, sorting agents so parents precede children and
    /// renumbering events into a dense total order.
    ///
    /// Renumbering is not cosmetic: the renderer pairs a tool result with its
    /// call by id and lays the graph out in event order, so a sparse or
    /// duplicated sequence would produce a graph that silently disagrees with
    /// the timeline.
    pub fn from_parts(
        session_id: String,
        adapter_id: String,
        mut agents: Vec<ViewerAgent>,
        mut events: Vec<ViewerEvent>,
    ) -> Self {
        agents.sort_by(|a, b| {
            depth_of(a, &[])
                .cmp(&depth_of(b, &[]))
                .then_with(|| a.id.cmp(&b.id))
        });
        events.sort_by_key(|event| event.sequence);
        for (index, event) in events.iter_mut().enumerate() {
            event.sequence = index as u64;
        }
        Self {
            session_id,
            adapter_id,
            agents,
            events,
        }
    }

    pub fn root(&self) -> Option<&ViewerAgent> {
        self.agents.iter().find(|agent| agent.is_root())
    }

    pub fn agent(&self, id: &str) -> Option<&ViewerAgent> {
        self.agents.iter().find(|agent| agent.id == id)
    }

    pub fn children_of<'a>(&'a self, id: &'a str) -> impl Iterator<Item = &'a ViewerAgent> {
        self.agents
            .iter()
            .filter(move |agent| agent.parent_id.as_deref() == Some(id))
    }

    /// Events attributed to one agent, in order.
    ///
    /// Declared double-ended because `terminal_for` reads the LAST terminal
    /// event: an agent that failed and was retried into success must report the
    /// outcome the session ended on, not the first one it recorded.
    pub fn events_for<'a>(
        &'a self,
        agent_id: &'a str,
    ) -> impl DoubleEndedIterator<Item = &'a ViewerEvent> {
        self.events
            .iter()
            .filter(move |event| event.agent_id == agent_id)
    }

    /// The terminal state the session actually recorded for an agent.
    ///
    /// `None` means the session never said. That is a real answer and the
    /// caller must render it as unknown rather than as success.
    pub fn terminal_for(&self, agent_id: &str) -> Option<Terminal> {
        self.events_for(agent_id)
            .rev()
            .find_map(|event| match event.payload {
                Payload::Status { terminal, .. } => Some(terminal),
                _ => None,
            })
    }

    /// Tool calls that never received a result. These are what a stuck agent
    /// looks like, and `inspect` reports them explicitly.
    pub fn unanswered_calls<'a>(&'a self, agent_id: &'a str) -> Vec<&'a ViewerEvent> {
        let answered: Vec<&str> = self
            .events_for(agent_id)
            .filter_map(|event| match &event.payload {
                Payload::ToolResult { call_id, .. } => Some(call_id.as_str()),
                _ => None,
            })
            .collect();
        self.events_for(agent_id)
            .filter(|event| match &event.payload {
                Payload::ToolCall { call_id, .. } => !answered.contains(&call_id.as_str()),
                _ => false,
            })
            .collect()
    }

    pub fn error_count(&self, agent_id: &str) -> usize {
        self.events_for(agent_id)
            .filter(|event| match &event.payload {
                Payload::ToolResult { is_error, .. } => *is_error,
                Payload::Status { terminal, .. } => *terminal == Terminal::Failed,
                _ => false,
            })
            .count()
    }

    pub fn last_timestamp(&self) -> Option<DateTime<Utc>> {
        self.events.last().map(|event| event.timestamp)
    }
}

/// Depth of an agent in the tree, used only for a stable parents-first order.
/// Cycles cannot happen (an adapter derives parentage from a path prefix) but a
/// visited set keeps this total anyway rather than looping on malformed input.
fn depth_of(agent: &ViewerAgent, _seen: &[&str]) -> usize {
    agent.id.matches('/').count()
}

/// One event, reduced to what a timeline row needs.
///
/// Deliberately NOT the whole `Payload`. A row shows what happened and to whom;
/// anything richer belongs to an inspector that asks for one event, so a
/// thousand-row window never carries a thousand tool payloads.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EventSummary {
    /// The only event key. There is no separate id: `source_id` is the
    /// provider's own record id and is NOT unique (one provider event can
    /// produce several viewer events), so it cannot address anything.
    pub sequence: u64,
    pub agent_id: String,
    /// RFC 3339, so the browser can format it without a second convention.
    pub timestamp: String,
    pub kind: &'static str,
    /// Display-safe already: reasoning was dropped at ingestion.
    pub label: String,
    pub is_error: bool,
    /// Correlates a call with its result. `None` for everything else.
    pub call_id: Option<String>,
}

impl ViewerEvent {
    pub fn summary(&self) -> EventSummary {
        let (kind, label, is_error, call_id) = match &self.payload {
            Payload::Spawn {
                child_agent_id,
                call_id,
                description,
            } => (
                "spawn",
                format!("{description} → {child_agent_id}"),
                false,
                Some(call_id.clone()),
            ),
            Payload::Message { text, from_user } => (
                if *from_user { "prompt" } else { "message" },
                text.clone(),
                false,
                None,
            ),
            Payload::ToolCall {
                call_id,
                tool,
                summary,
            } => (
                "tool_call",
                format!("{tool} {summary}"),
                false,
                Some(call_id.clone()),
            ),
            Payload::ToolResult {
                call_id,
                tool,
                summary,
                is_error,
            } => (
                "tool_result",
                format!("{tool} {summary}"),
                *is_error,
                Some(call_id.clone()),
            ),
            Payload::Status { terminal, detail } => (
                "status",
                format!(
                    "{} {detail}",
                    match terminal {
                        Terminal::Completed => "completed",
                        Terminal::Failed => "failed",
                    }
                ),
                *terminal == Terminal::Failed,
                None,
            ),
        };
        EventSummary {
            sequence: self.sequence,
            agent_id: self.agent_id.clone(),
            timestamp: self.timestamp.to_rfc3339(),
            kind,
            label: label.trim().to_string(),
            is_error,
            call_id,
        }
    }
}

/// One agent, as the left rail needs it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSummary {
    pub id: String,
    pub label: String,
    pub kind: String,
    pub parent_id: Option<String>,
    pub event_count: usize,
    pub error_count: usize,
    /// `None` means the session never said. Render it as unknown, never as
    /// success: an agent with no terminal event has to look unfinished.
    pub terminal: Option<&'static str>,
}

impl ViewerSession {
    pub fn agent_summaries(&self) -> Vec<AgentSummary> {
        self.agents
            .iter()
            .map(|agent| AgentSummary {
                id: agent.id.clone(),
                label: agent.label.clone(),
                kind: agent.kind.clone(),
                parent_id: agent.parent_id.clone(),
                event_count: self.events_for(&agent.id).count(),
                error_count: self.error_count(&agent.id),
                terminal: self.terminal_for(&agent.id).map(|t| match t {
                    Terminal::Completed => "completed",
                    Terminal::Failed => "failed",
                }),
            })
            .collect()
    }
}

/// How many events one window may return.
///
/// A real session is not small: one measured here holds 3581 events. Returning
/// all of them on every call would ship roughly a megabyte to build a list the
/// viewport shows forty rows of. The window is the contract, not an
/// optimisation added later.
pub const MAX_EVENT_WINDOW: usize = 500;

/// A bounded slice of the event stream.
///
/// Reports what was actually returned, so a caller never has to infer whether
/// it was truncated.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EventWindow {
    pub items: Vec<EventSummary>,
    pub total_count: usize,
    pub offset: usize,
    pub has_more: bool,
}

impl ViewerSession {
    /// A window of events starting at `offset`.
    ///
    /// `limit` is clamped to [`MAX_EVENT_WINDOW`], and an out-of-range offset
    /// yields an empty window rather than an error: a caller paging past the
    /// end is asking a reasonable question and deserves a reasonable answer.
    pub fn event_window(&self, offset: usize, limit: usize) -> EventWindow {
        let total_count = self.events.len();
        let start = offset.min(total_count);
        let count = limit.min(MAX_EVENT_WINDOW).min(total_count - start);
        EventWindow {
            items: self.events[start..start + count]
                .iter()
                .map(ViewerEvent::summary)
                .collect(),
            total_count,
            offset: start,
            has_more: start + count < total_count,
        }
    }
}

/// One event in full, for an inspector.
///
/// Bounded on purpose: an inspector asks about ONE event, so this never grows
/// with the session. It carries nothing the event did not already carry, and
/// the adapter dropped model reasoning at ingestion, so there is no path by
/// which chain-of-thought, a credential or a raw secret reaches this struct.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EventDetail {
    pub sequence: u64,
    pub agent_id: String,
    /// The agent's display label when the session named one.
    pub agent_label: Option<String>,
    #[serde(rename = "type")]
    pub kind: &'static str,
    pub timestamp: String,
    /// `ok` or `error`. Derived from what the session recorded, never guessed.
    pub status: &'static str,
    /// The tool a call or result names. `None` for anything else.
    pub tool: Option<String>,
    pub summary: String,
    pub call_id: Option<String>,
    /// How this reached the viewer. Every browser session is a local file.
    pub source: &'static str,
}

impl ViewerSession {
    /// Detail for one event, by its canonical sequence.
    ///
    /// `None` for an unknown sequence. A caller must render that as "no such
    /// event" rather than falling back to a neighbour.
    pub fn event_detail(&self, sequence: u64) -> Option<EventDetail> {
        let event = self
            .events
            .iter()
            .find(|event| event.sequence == sequence)?;
        let summary = event.summary();
        let tool = match &event.payload {
            Payload::ToolCall { tool, .. } | Payload::ToolResult { tool, .. } => Some(tool.clone()),
            _ => None,
        };
        Some(EventDetail {
            sequence: event.sequence,
            agent_id: event.agent_id.clone(),
            agent_label: self.agent(&event.agent_id).map(|a| a.label.clone()),
            kind: summary.kind,
            timestamp: summary.timestamp,
            status: if summary.is_error { "error" } else { "ok" },
            tool,
            summary: summary.label,
            call_id: summary.call_id,
            source: "local-session-file",
        })
    }
}

/// What kinds of evidence a session can support a claim about.
///
/// # Why this exists
///
/// Story Mode says things like "unsafe input was blocked" or "Warden retried
/// under policy". A LOCAL agent session contains none of those: [`Payload`] has
/// no security screening, no policy decision, no runtime control and no
/// activation. Every flag here is therefore `false` for a local session, and
/// that is a fact about the model rather than a stub waiting to be filled in.
///
/// The UI reads this to decide whether a card may be rendered at all. A card
/// whose evidence is absent is shown as "not present in this session", never
/// rendered as a claim with a caveat underneath: a reader who skims sees the
/// claim, not the caveat.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoryCapabilities {
    /// Input screening decisions (allowed / sanitized / blocked).
    pub has_security_evidence: bool,
    /// A policy-gated intervention with a recorded authorization.
    pub has_warden_evidence: bool,
    /// A protected system being activated under identity.
    pub has_activation_evidence: bool,
    /// A runtime operation confirming a recovery.
    pub has_runtime_recovery: bool,
}

/// The handful of facts Story Mode needs, computed once over the whole session.
///
/// Bounded and fixed-size: a caller gets the same struct for a 20-event session
/// and a 5000-event one. It is computed HERE rather than in the browser because
/// re-deriving agent outcomes in TypeScript would create a second answer that
/// drifts from the one the rest of the viewer shows.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoryFacts {
    pub agent_count: usize,
    pub completed_count: usize,
    pub failed_count: usize,
    /// Agents the session never reported a terminal event for.
    pub unreported_count: usize,
    pub event_count: usize,
    pub error_count: usize,
    /// Tool calls that never received a result. What a stuck agent looks like.
    pub unanswered_call_count: usize,
    /// The label of the first agent that failed, if one did.
    pub failed_agent: Option<String>,
    /// What that failure actually said, already display-safe.
    pub failure_detail: Option<String>,
    pub capabilities: StoryCapabilities,
}

impl ViewerSession {
    /// Compute Story Mode's facts.
    pub fn story_facts(&self) -> StoryFacts {
        let mut completed = 0usize;
        let mut failed = 0usize;
        let mut unreported = 0usize;
        let mut unanswered = 0usize;
        let mut errors = 0usize;
        let mut failed_agent = None;
        let mut failure_detail = None;

        for agent in &self.agents {
            match self.terminal_for(&agent.id) {
                Some(Terminal::Completed) => completed += 1,
                Some(Terminal::Failed) => {
                    failed += 1;
                    if failed_agent.is_none() {
                        failed_agent = Some(agent.label.clone());
                        // The first recorded error on that agent, in its own
                        // words. Nothing is summarized or invented here.
                        failure_detail = self.events_for(&agent.id).find_map(|event| match &event
                            .payload
                        {
                            Payload::ToolResult {
                                is_error: true,
                                summary,
                                tool,
                                ..
                            } => Some(format!("{tool}: {summary}")),
                            Payload::Status {
                                terminal: Terminal::Failed,
                                detail,
                            } => Some(detail.clone()),
                            _ => None,
                        });
                    }
                }
                None => unreported += 1,
            }
            errors += self.error_count(&agent.id);
            unanswered += self.unanswered_calls(&agent.id).len();
        }

        StoryFacts {
            agent_count: self.agents.len(),
            completed_count: completed,
            failed_count: failed,
            unreported_count: unreported,
            event_count: self.events.len(),
            error_count: errors,
            unanswered_call_count: unanswered,
            failed_agent,
            failure_detail,
            // A local agent session carries no governance evidence. This is
            // structural: there is no Payload variant that could produce one.
            capabilities: StoryCapabilities::default(),
        }
    }
}
