//! The Agent Viewer Render Manifest.
//!
//! # What it is for
//!
//! The renderer's timeline and the viewer's event stream are NOT the same list.
//! Folding the bundled fixture produces 23 renderer items from 20 viewer
//! events: 20 `Update::Entry` and 3 `Update::SubagentMeta` sidecars that
//! correspond to no viewer event at all, interleaved at renderer positions 3, 9
//! and 16. Any arithmetic bridge between the two indexes is therefore wrong,
//! and a scrubber fraction is wrong for the same reason plus rounding.
//!
//! This manifest records the mapping so nothing has to guess it.
//!
//! # Why it is separate from `fleet_cockpit::RenderManifest`
//!
//! That one exists for the same class of problem and its reasoning is
//! [ADR 0004](../../../docs/decisions/0004-render-manifest-cursor-mapping.md),
//! which is worth reading before changing this. It is deliberately NOT reused:
//! it maps *governed Case* Canonical Events, carrying a `caseSequence`, an
//! evidence domain and a policy outcome, none of which a local session has. A
//! shared type would either force a local session to invent governance fields
//! or dilute the Case manifest into something that no longer describes a Case.
//! Two small honest types beat one that lies to one of its callers.
//!
//! # Recorded, not computed
//!
//! For the current emitter the mapping happens to be
//! `renderer_index = event_index + metas_before_it`. That formula appears in
//! this crate's tests as an oracle and NOWHERE in its runtime code. The
//! sequence is read back out of the wire (`wire::compile` stamps each line
//! `fs-<sequence>`), so the mapping is observed from the fold that actually
//! happened. If a future emitter makes one event produce two entries, or none,
//! the manifest records that too and no caller changes.

use std::collections::BTreeMap;

use agent_viewer_core::viewer::ViewerSession;
use serde::Serialize;
use zoetrope::tailer::{ReplayItem, Update};
use zoetrope::transcript::Entry;

/// The prefix `agent_viewer_core::wire` stamps on every emitted line's uuid.
/// The two must agree; the round trip is asserted in this crate's tests.
const WIRE_UUID_PREFIX: &str = "fs-";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ViewerManifestItemKind {
    /// Produced by a viewer event.
    Event,
    /// A sub-agent `meta.json` sidecar. Real renderer state, no viewer event.
    SubagentMeta,
}

/// One renderer timeline item and what produced it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewerManifestEntry {
    pub renderer_entry_index: usize,
    /// The viewer event this item came from. `None` for a `SubagentMeta`, and
    /// that None is a real answer: the caller must render "no event here"
    /// rather than the nearest one.
    pub sequence: Option<u64>,
    pub agent_id: Option<String>,
    pub kind: ViewerManifestItemKind,
}

#[derive(Clone, Debug, Default, Serialize)]
pub struct ViewerManifest {
    entries: Vec<ViewerManifestEntry>,
    /// sequence → every renderer index it produced. A Vec because one event
    /// producing several entries is a shape this must survive, even though the
    /// current emitter never does it.
    #[serde(skip)]
    by_sequence: BTreeMap<u64, Vec<usize>>,
    /// The session's root agent id.
    ///
    /// Recorded here because the renderer names the root node `main` — its own
    /// id, not the session's — and every other id in the system is a session
    /// agent id. Something has to hold both ends of that translation, and the
    /// manifest is already the place identity questions are answered.
    #[serde(skip)]
    root_agent_id: Option<String>,
}

impl ViewerManifest {
    /// Record the mapping from a fold that actually happened.
    pub fn build(items: &[ReplayItem], session: &ViewerSession) -> Self {
        let agent_of: BTreeMap<u64, &str> = session
            .events
            .iter()
            .map(|event| (event.sequence, event.agent_id.as_str()))
            .collect();

        let mut entries = Vec::with_capacity(items.len());
        let mut by_sequence: BTreeMap<u64, Vec<usize>> = BTreeMap::new();

        for (renderer_entry_index, item) in items.iter().enumerate() {
            let entry = match &item.update {
                Update::SubagentMeta { agent_id, .. } => ViewerManifestEntry {
                    renderer_entry_index,
                    sequence: None,
                    agent_id: Some(agent_id.clone()),
                    kind: ViewerManifestItemKind::SubagentMeta,
                },
                Update::Entry { entry, .. } => {
                    let sequence = sequence_of(entry);
                    if let Some(sequence) = sequence {
                        by_sequence
                            .entry(sequence)
                            .or_default()
                            .push(renderer_entry_index);
                    }
                    ViewerManifestEntry {
                        renderer_entry_index,
                        sequence,
                        agent_id: sequence
                            .and_then(|s| agent_of.get(&s))
                            .map(|id| (*id).to_string()),
                        kind: ViewerManifestItemKind::Event,
                    }
                }
            };
            entries.push(entry);
        }

        Self {
            entries,
            by_sequence,
            root_agent_id: session.root().map(|agent| agent.id.clone()),
        }
    }

    /// The session's root agent id, which the renderer draws as `main`.
    pub fn root_agent_id(&self) -> Option<&str> {
        self.root_agent_id.as_deref()
    }

    pub fn entries(&self) -> &[ViewerManifestEntry] {
        &self.entries
    }

    pub fn renderer_entry_count(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    /// Every renderer index a viewer event produced, in order. Empty when the
    /// event rendered nothing, which is a legitimate answer.
    pub fn renderer_indices_for_sequence(&self, sequence: u64) -> &[usize] {
        self.by_sequence
            .get(&sequence)
            .map(Vec::as_slice)
            .unwrap_or(&[])
    }

    /// The first renderer index for an event. What a seek targets.
    pub fn renderer_index_for_sequence(&self, sequence: u64) -> Option<usize> {
        self.renderer_indices_for_sequence(sequence)
            .first()
            .copied()
    }

    pub fn entry_at(&self, renderer_entry_index: usize) -> Option<&ViewerManifestEntry> {
        self.entries.get(renderer_entry_index)
    }

    /// The viewer event a renderer index rests on.
    ///
    /// `None` means either "out of range" or "this item is a sidecar with no
    /// event". Callers must not fall back to a neighbour: reporting the wrong
    /// event is worse than reporting none.
    pub fn sequence_at(&self, renderer_entry_index: usize) -> Option<u64> {
        self.entry_at(renderer_entry_index)?.sequence
    }

    /// Position of a renderer index on the scrubber.
    ///
    /// Fractions are for the scrubber, where the fraction IS the user's input.
    /// Nothing derives identity from one.
    pub fn fraction_for_renderer_index(&self, renderer_entry_index: usize) -> f64 {
        if self.entries.len() <= 1 {
            return 0.0;
        }
        let last = self.entries.len() - 1;
        renderer_entry_index.min(last) as f64 / last as f64
    }

    pub fn fraction_for_sequence(&self, sequence: u64) -> Option<f64> {
        self.renderer_index_for_sequence(sequence)
            .map(|index| self.fraction_for_renderer_index(index))
    }

    /// Problems that would make a lookup silently wrong. Empty means consistent.
    pub fn validate(&self, session: &ViewerSession) -> Vec<String> {
        let mut problems = Vec::new();

        for (position, entry) in self.entries.iter().enumerate() {
            if entry.renderer_entry_index != position {
                problems.push(format!(
                    "entry {position} claims renderer index {}",
                    entry.renderer_entry_index
                ));
            }
            match entry.kind {
                ViewerManifestItemKind::SubagentMeta if entry.sequence.is_some() => problems.push(
                    format!("renderer entry {position} is a sidecar but carries a sequence"),
                ),
                ViewerManifestItemKind::Event if entry.sequence.is_none() => {
                    problems.push(format!(
                        "renderer entry {position} came from the event stream but no sequence \
                     was recoverable from its line"
                    ))
                }
                _ => {}
            }
        }

        // An event that rendered nothing is allowed, but it must be visible:
        // silently missing work is the failure mode this whole layer exists to
        // prevent.
        let unrendered: Vec<u64> = session
            .events
            .iter()
            .map(|event| event.sequence)
            .filter(|sequence| self.renderer_indices_for_sequence(*sequence).is_empty())
            .collect();
        if !unrendered.is_empty() {
            problems.push(format!(
                "{} viewer event(s) produced no renderer entry: {:?}",
                unrendered.len(),
                &unrendered[..unrendered.len().min(8)]
            ));
        }

        problems
    }
}

/// Recover the viewer sequence a renderer entry came from.
///
/// The sequence travels in the line's `uuid`, stamped by the wire emitter. It
/// is READ BACK here rather than inferred from position, which is what makes
/// this a recorded mapping instead of an assumption about ordering. Public so
/// pairing can map a live timeline item after the initial fold (the stored
/// manifest does not grow with follow appends).
pub fn sequence_of(entry: &Entry) -> Option<u64> {
    let uuid = match entry {
        Entry::Assistant(assistant) => assistant.envelope.uuid.as_deref(),
        Entry::User(user) => user.envelope.uuid.as_deref(),
        // The emitter writes only assistant and user lines. Anything else in
        // the fold did not come from a viewer event.
        _ => None,
    }?;
    uuid.strip_prefix(WIRE_UUID_PREFIX)?.parse::<u64>().ok()
}
