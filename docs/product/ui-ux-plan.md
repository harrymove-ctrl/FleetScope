# FleetScope Session Observer UI/UX plan

**Status:** active

**Last updated:** 2026-08-30

## Experience goal

A first-time viewer should understand within 30 seconds which agents ran, what
the selected agent did, whether anything is still waiting, and whether they are
watching the live edge or replaying history.

## Primary screen

```text
┌────────────────────────────────────────────────────────────────────────┐
│ session · google-adk 2.8.0 · observed model · LIVE / HISTORY / REPLAY  │
├────────────────┬───────────────────────────────┬───────────────────────┤
│ AGENTS         │ GRAPH + ACTIVITY              │ INSPECTOR             │
│ launch...      │ launch_readiness              │ selected agent/event  │
│ ├ cloud_run    │ ├ cloud_run_probe             │ message / tool        │
│ ├ storage      │ ├ storage_probe               │ result / error        │
│ ├ budget       │ ├ budget_guard                │ explicit terminal     │
│ └ reviewer     │ └ launch_reviewer             │ source id / timestamp │
├────────────────┴───────────────────────────────┴───────────────────────┤
│ play/pause · step · event-indexed scrubber · speed · return to edge   │
└────────────────────────────────────────────────────────────────────────┘
```

The playhead is shared by the graph, rail, inspector, and timeline. Selection
never changes the evidence; it only changes which evidence is in focus.

## Information priority

1. Truth label: dry-run, local live follow, history, replay, or failed.
2. Session identity and producer/framework.
3. Agent topology and selected agent state.
4. Current event and tool/result evidence.
5. Timeline controls and projection fingerprint.
6. Technical metadata in progressive disclosure.

Do not lead with product marketing, CASE-1042, or a cloud-service logo grid.

## State language

| State | UI copy rule |
|---|---|
| At a growing right edge | **Local live follow** |
| Behind a growing edge | **History** |
| Finished file | **Replay** |
| Tool call without result | **Waiting on a tool result** |
| No provider terminal event | **No terminal event recorded** |
| Explicit provider failure | **Failed** with the safe recorded detail |
| Configured model only | **Configured**, never “used” |
| Provider `modelVersion` observed | **Observed model** |
| Unsupported/malformed input | Error with adapter/line; no graph |

## Core interactions

- Click an agent to focus its path and activity.
- Click an event to move the playhead and open its detail.
- Press play/pause without changing the source or rerunning an agent.
- Step one event at a time.
- Seek by event index; long idle gaps do not bury work.
- Return to the live edge in one action.
- Open help without leaving the session.
- Load a file/folder locally; the browser does not upload it.

## Demo choreography

1. Open with raw JSONL for two seconds.
2. Run `fleetscope inspect` and point to producer, agents, events, and observed
   model.
3. Open the viewer at the live edge while the producer appends.
4. Point to all four direct child agents.
5. Select Cloud Run and Storage tool calls/results.
6. Select `budget_guard` and show the fixed limits.
7. Select `launch_reviewer` and the final decision.
8. Pause, seek before a result, step forward, and return to the edge.
9. Show that a hidden-thought marker does not appear.
10. Close on the same session in the browser and the proof manifest.

## Visual direction

- Near-black neutral background; one bright accent for selection.
- Cyan only for a genuinely growing live edge.
- Amber for waiting/unknown, red for explicit failure, green for explicit
  provider completion.
- Sans serif for explanation, monospace for event IDs, tool names, paths, and
  timestamps.
- Motion communicates new events or playhead movement; it never implies agent
  activity not present in the log.
- Graph lines and labels must remain legible at 1280×720 for the video.

## Accessibility and responsive behavior

- Every state uses text/icon plus color.
- Keyboard controls have visible help and focus.
- Inspector content is selectable and does not rely on hover.
- At narrow widths, graph remains primary; agent rail and inspector become
  drawers rather than shrinking into unreadable columns.
- Reduced-motion mode disables pulses and camera animation while preserving
  event arrival and selection.
- Long tool/result text is bounded in the graph and available in the inspector.

## Non-goals

- No Start, Retry, Approve, Recover, or Authorize button.
- No hidden reasoning toggle.
- No fabricated “active” animation based only on elapsed wall time.
- No enterprise CASE status, Warden lifecycle, or policy cards in the primary
  demo.
- No remote session control.

## Links

- [Session Observer](session-observer.md)
- [Feature flows](feature-flows.md)
- [Session Observer design](../design/session-observer.md)
