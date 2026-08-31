# Paired Agent Viewer — TUI, browser, fullscreen

**Status:** active  
**Last updated:** 2026-08-31  
**Scope:** native TUI + `/viewer` usage, control, fullscreen, and view-state
pairing for one local session. Does not change producers, adapters, or the
projection core.

## Mission

An operator following a real Antigravity (or ADK) session can drive the
session from the TUI **or** the browser, see the same playhead on both, and
work fullscreen. The evidence file stays the source of truth. Viewers never
start the agent.

**URL split (2026-08-31):**

- **`/demo`** — judge/video poster. One status line + all seven Session
  readings (handoffs, who held the run, agent tree, calls answered, event
  health, session, timeline). Antigravity restraint chrome (no Claude/mdx
  dashed stickers). No WASM, no Follow/Pause, zero clicks required.
- **`/viewer`** — Gemini / Antigravity operator flight deck (graph, rail,
  inspector, timeline, transport). Interactive. Story is a **one-line strip**
  only (no 4-card dashboard / chapters / 3-column essay). Shared visual
  language with `/demo` (serif display, Gemini orb, cyan kicker, blue CTA).
  Full Session readings live on `/demo`.

## Why the TUI felt uncontrollable (2026-08-31 live take)

This is observed behavior from the real `agy` run on
`examples/antigravity-project`, not a guess.

1. **The window was too small.** Terminal was 143×39 then 151×39. Zoetrope
   layout then overlays the inspector on the graph. Agent cards vanished.
   Keys still worked; the graph they were meant to drive was gone.
2. **Follow auto-opens the inspector and Esc will not close it.** In Follow,
   Esc is a no-op so the panel “auto-narrates.” On a short terminal that
   panel *is* the screen. The operator cannot get the graph back without
   leaving Follow (`o`) or enlarging the window.
3. **Focus.** The TUI only receives keys while that Terminal window is
   frontmost. Opening Chrome, the file picker, or another app silently
   steals control. The TUI is not frozen; it is unfocused.
4. **Selection is not the playhead.** Clicking `ux_designer` focuses the
   agent and drops Follow to Manual, but the inspector can still show
   `lead`'s last event (“The event on show belongs to lead”). That reads as
   “click does nothing.”
5. **Key collisions.** With an agent selected, `j`/`k` scroll the inspector
   instead of panning the graph. `←`/`→` move graph selection, not the
   timeline (`[`/`]` do). The status line advertised `←/→ step` in the CLI
   help; Zoetrope actually steps prompts with `[`/`]`.
6. **Browser fullscreen is on the wrong target.** `FullscreenToggle` only
   covers Session readings, not the WASM graph. `/viewer` has no
   graph-canvas fullscreen.

None of this is “the TUI has no controls.” The controls exist and were
proven (`?` help, live follow, idle at end). They are unusable in a small
unfocused window with an overlay that cannot be dismissed.

## Principles

- **Evidence and view state are different files.** `session.jsonl` is
  append-only producer evidence. View state never lands in it.
- **One session directory, two windows.** Pairing is “same folder,” not a
  cloud room and not a new backend.
- **Live edge is free; playhead pairing is explicit.** Both viewers already
  tail the same JSONL. Shared pause/step is a sidecar, opt-in, last-write
  wins.
- **TUI is the operator surface; browser is the audience surface.** Either
  may drive. Default demo: TUI drives, browser mirrors at the live edge
  until the operator seeks.
- **Fullscreen means the graph is the window.** Page chrome, Session
  readings, and the inspector overlay are secondary.
- **A terminal below the minimum size is an error, not a layout.** Refuse
  or warn; do not render a broken overlay and call it Expert Mode.

## Usage (the demo you actually run)

One producer, one session directory, two fullscreen viewers.

```text
Terminal A  producer   agy workers → session.jsonl
Terminal B  TUI        fleetscope <dir> --follow     (zoomed, ≥160×48)
Chrome      /viewer    Follow folder… <dir>          (graph fullscreen)
```

Canonical command (replace the current “TUI only” demo):

```bash
pnpm demo:antigravity
```

That script MUST:

1. Create `.fleetscope/sessions/<id>/`.
2. Start the Antigravity bridge into that directory.
3. Maximize the TUI terminal (or print a hard size warning and refuse to
   open a <160×48 window without `--tiny`).
4. Open `/viewer/` with the session directory in the clipboard / on-screen
   path, and — when the browser is already running — focus a dedicated
   window.
5. Print: `session_dir=…`, `tui=follow`, `browser=Follow folder…`.

Operator keys (same meaning on both surfaces):

| Key | Meaning |
|---|---|
| `space` | play / pause |
| `[` `]` | step prompt-era |
| `g` | live edge |
| `o` | overview / fit graph |
| `f` | follow live agent |
| `esc` | close overlay, then deselect |
| `?` | help |
| `q` | quit TUI only |

Clicking an agent **selects** it. Clicking an event **seeks** the playhead.
If the selected agent's current event is not the playhead, the inspector
says so *and* offers “Jump to this agent’s latest event” as the one action.

## Architecture

```text
agy / ADK ──append──► session.jsonl          (evidence)
                         │
                         ├── tail ──► TUI projection ──► Terminal (fullscreen)
                         └── tail ──► WASM projection ──► /viewer  (fullscreen)
                         │
              optional  view.json            (playhead, paused, selection)
                         │
                         ├── TUI writes on operator action, polls 200ms
                         └── browser writes on operator action, polls 750ms
```

The projection core stays IO-free. Pairing lives at the same edge that
already discovers and tails files (`fleetscope-cli` follow watcher, viewer
file/folder handles). No API, no upload, no WebSocket.

### View state sidecar

Path: `<session-dir>/view.json` (sibling of `session.jsonl`).

```json
{
  "v": 1,
  "playhead": 71,
  "paused": true,
  "selectedAgent": "ux_designer",
  "camera": "manual",
  "updatedAt": 1756571844375,
  "writer": "tui"
}
```

Rules:

- Last `updatedAt` wins. Ignore a write older than the local copy.
- A viewer that has never received a key/click does not write (so the
  first opener does not clobber).
- Missing file = unpaired, each viewer independent (today’s behavior).
- Corrupt file = ignore once, do not crash follow.
- `playhead` is an event index in the current projection, not a
  timestamp. If the index is past the local event count, clamp to the
  live edge (the other viewer saw a line you have not flushed yet).

Browser pairing requires **Follow folder…** (directory handle) so the tab
can poll both `session.jsonl` and `view.json`. Follow-file-only stays
unpaired. The demo script tells the operator to pick the folder, not the
file.

## Fullscreen

### TUI

- Enter the alternate screen as today.
- On launch, if columns < 160 or rows < 48: print the size, the zoom
  hint, and do not start Follow overlay-first. `--tiny` overrides for
  tests.
- Demo script zooms the Terminal/iTerm window before `exec fleetscope`.
- Inspector is a **bottom pane** when rows ≥ 48. Overlay is only the
  fallback for `--tiny`. Esc closes the overlay even in Follow.

### Browser

- Two fullscreen targets, never one control stealing the other:
  - **Full screen readings** — audience Session readings workspace
    (handoffs → who held the run → tree/check → health/session →
    timeline). Default `/viewer` surface.
  - **Full screen graph** — Expert workspace only (`[data-dropzone]`:
    graph + agent rail + inspector + timeline).
- Story Mode + Session readings are the default. Expert graph stays
  collapsed until “Open technical evidence”.
- After Follow folder succeeds, offer graph fullscreen (user gesture
  required by the browser; do not call it from a timer).
- While graph-fullscreen, page chrome and Readings stay outside the
  fullscreen element.

## Control fixes (TUI first)

These are product bugs, not new features:

1. Esc closes the inspector overlay in Follow.
2. Help and CLI `--help` list `[`/`]` for step, not `←`/`→`.
3. Status line shows `FOCUS` when the terminal has focus and a dim
   `unfocused` is impossible in-process — instead, the demo script
   keeps the TUI window front until the operator switches.
4. Selecting an agent that is not the playhead agent shows the jump
   action; it does not silently leave the inspector on another agent.
5. Failed agents render as failed in the inspector, never as
   `running · 0s`.

## Security

Assumptions: both windows are on the operator’s machine; the session
directory is local.

Controls: viewers read JSONL; they do not fetch it. `view.json` contains
indexes and ids only. Pairing across machines is out of scope. A
stale/hostile `view.json` can at worst seek the playhead, not execute an
agent.

Gaps: last-write-wins can fight if both windows are driven at once. Accept
for two-window demo; do not add CRDT.

## Constraints

- Session Observer: JSONL is evidence; FleetScope is read-only.
- Story Mode stays the browser default; Expert graph is what fullscreen
  and the TUI show.
- No Google key in FleetScope; producer is the operator’s `agy` or ADK.
- Native and browser projections MUST keep the same fingerprint for the
  same bytes.

## Acceptance

- [ ] A 160×48 TUI following a growing Antigravity session keeps the
      graph visible; Esc dismisses the inspector; space pauses; `[`/`]`
      step; `g` returns to the live edge.
- [ ] `/viewer` Follow folder on that directory shows the same
      fingerprint and agent set; Full screen graph fills the display.
- [ ] Pause on TUI moves the browser to History at the same event index
      within one second when `view.json` is present.
- [ ] Seek to a failed child event on either surface shows that child as
      failed in the inspector on both.
- [ ] Follow-file (single file, no folder) still works and does not
      require pairing.
- [ ] `--tiny` still renders for tests; default demo refuses it.

## Open points

- Whether macOS Terminal zoom is scriptable enough, or the demo should
  prefer iTerm/cmux for a guaranteed 160×48. Decide at implementation
  by probing the front terminal once.
- Whether Story Mode in the browser should follow the paired playhead
  (chapter highlight) or stay independent. Default: Story follows
  playhead so the audience screen narrates the same event.

## Links

- Requirements: [Session Observer](../requirements/session-observer.md)
  (open file or folder; play/pause/step/seek/live edge; native/browser
  parity).
- Product UX: [UI/UX plan](../product/ui-ux-plan.md) (shared playhead
  inside one screen; this doc extends that across two windows).
- Parent design: [Session Observer](session-observer.md).
- Glossary: Agent Viewer, playhead, live edge, view state, paired
  viewers.
