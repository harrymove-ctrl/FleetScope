//! The headless summary: `fleetscope inspect <path>`.
//!
//! Everything the graph shows, as text, for the cases where a TUI is the wrong
//! answer: a CI check, a pipe into grep, an agent reading its own run back, or a
//! terminal that cannot draw. It is also where the FULL agent tree is reported —
//! the renderer flattens depth for layout, this does not.

use std::fmt::Write as _;

use crate::adapter::Confidence;
use crate::viewer::{Payload, Terminal, ViewerSession};
use crate::wire;
use crate::Projection;

/// Render the summary. Returns the text rather than printing it so tests can
/// assert on it without capturing stdout.
pub fn summary(projection: &Projection) -> String {
    let Projection {
        session,
        wire,
        selection,
    } = projection;
    let mut out = String::new();

    let _ = writeln!(out, "session   {}", session.session_id);

    // Say what recognised the file, how sure it was, and what the producer
    // stamped. A session written by a newer producer should be visible as such
    // rather than showing up later as an unexplained parse difference.
    match selection {
        Some(selection) => {
            let hedge = if selection.confidence == Confidence::Maybe {
                "  (best guess: no discriminating field)"
            } else {
                ""
            };
            let _ = writeln!(
                out,
                "adapter   {} — {}{hedge}",
                session.adapter_id, selection.label
            );
            if let Some(version) = &selection.version {
                let _ = writeln!(out, "producer  {version}");
            }
        }
        None => {
            let _ = writeln!(out, "adapter   {} (forced)", session.adapter_id);
        }
    }
    let _ = writeln!(out, "agents    {}", session.agents.len());
    let _ = writeln!(out, "events    {}", session.events.len());

    match (
        session.events.first().map(|e| e.timestamp),
        session.last_timestamp(),
    ) {
        (Some(first), Some(last)) => {
            let _ = writeln!(
                out,
                "span      {} → {}",
                first.format("%Y-%m-%d %H:%M:%S"),
                last.format("%Y-%m-%d %H:%M:%S")
            );
        }
        _ => {
            let _ = writeln!(out, "span      unknown");
        }
    }

    if let Some(note) = wire::flatten_note(wire) {
        let _ = writeln!(out, "note      {note}");
    }

    let _ = writeln!(out, "\nagents");
    if let Some(root) = session.root() {
        write_agent(&mut out, session, &root.id, 0);
    } else {
        let _ = writeln!(out, "  (no root agent: every agent names a parent)");
    }

    out
}

fn write_agent(out: &mut String, session: &ViewerSession, agent_id: &str, depth: usize) {
    let Some(agent) = session.agent(agent_id) else {
        return;
    };
    let indent = "  ".repeat(depth + 1);

    let calls = session
        .events_for(agent_id)
        .filter(|e| matches!(e.payload, Payload::ToolCall { .. }))
        .count();
    let errors = session.error_count(agent_id);
    let unanswered = session.unanswered_calls(agent_id);

    // The session's own words, never a guess. An agent with no terminal event
    // reads "no terminal event recorded", which is the honest answer and the
    // one that makes a stuck agent visible.
    let state = match session.terminal_for(agent_id) {
        Some(Terminal::Completed) => "completed",
        Some(Terminal::Failed) => "failed",
        None if !unanswered.is_empty() => "waiting on a tool result",
        None => "no terminal event recorded",
    };

    let _ = writeln!(out, "{indent}{} [{}]", agent.label, state);
    let _ = writeln!(
        out,
        "{indent}  path {}  events {}  tools {}  errors {}",
        agent.id,
        session.events_for(agent_id).count(),
        calls,
        errors
    );

    for event in &unanswered {
        if let Payload::ToolCall { tool, call_id, .. } = &event.payload {
            let _ = writeln!(out, "{indent}  ! {tool} ({call_id}) never returned");
        }
    }
    for event in session.events_for(agent_id) {
        match &event.payload {
            Payload::ToolResult {
                tool,
                summary,
                is_error: true,
                ..
            } => {
                let _ = writeln!(out, "{indent}  ✗ {tool}: {summary}");
            }
            Payload::Status {
                terminal: Terminal::Failed,
                detail,
            } => {
                let _ = writeln!(out, "{indent}  ✗ {detail}");
            }
            _ => {}
        }
    }

    let children: Vec<String> = session
        .children_of(agent_id)
        .map(|child| child.id.clone())
        .collect();
    for child in children {
        write_agent(out, session, &child, depth + 1);
    }
}
