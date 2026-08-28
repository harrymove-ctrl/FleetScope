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
