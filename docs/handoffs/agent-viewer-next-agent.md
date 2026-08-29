# FleetScope Agent Viewer — implementation handoff

Paste the fenced prompt below into the next coding agent. It is intentionally
self-contained; the receiving agent has no conversation context.

```text
You are continuing FleetScope in the existing worktree. Execute the plan below,
then report evidence. Do not create a new clone/worktree, rebase, wipe, commit,
push, or update a PR unless the operator explicitly asks.

MISSION

The judge Golden Path and the Guided Evidence Tour are DONE. See
docs/plans/case-1042-guided-tour-plan.md and docs/product/case-1042-judge-demo.md.

THE NEXT TASK IS NOT CODE. Run the five-person comprehension test described
below. It is the only evidence that any of this communicates, and it must not be
simulated, estimated, or inferred from the implementation. If you cannot run it
with five real people, say so and stop rather than producing numbers.

Only after that, and only if it materially improves the demo or an operator
workflow, start the canonical agentInstanceId to renderer-node mapping.

FIVE-PERSON COMPREHENSION TEST

Give no product explanation first. Open /cockpit/CASE-1042 and ask:

  1. Was unsafe vendor input used by an agent?
  2. Who authorized the recovery, and did the retry actually work?
  3. Did vendor activation require a person?
  4. Show me the exact evidence for activation.
  5. Is this live or recorded?

Targets: 5/5 identify it as recorded; at least 4/5 answer the three governance
questions correctly; at least 4/5 open exact evidence unaided; median under 90
seconds; nobody needs the graph. Record confusion points VERBATIM.

If participants fail, fix copy, hierarchy and navigation before adding anything. That document is normative for this
slice: card states, proof chains, URL contract, selection vocabulary,
responsive layout, and the required tests are all specified there. Do not
re-derive them and do not restate them differently.

WORKSPACE (VERIFY BEFORE TOUCHING)

- Worktree: /Users/harryphan/Documents/dev/FleetScope
- Branch: feat/agent-viewer-cli
- Canonical future PR base: main
- PUSH IS BLOCKED. The active gh account (harrymove-ctrl) has READ-only access
  to jasong-03/FleetScope; `git push` returns HTTP 403. Nothing on this branch
  has been pushed. Do not work around this by switching accounts or forking;
  report it and let the operator decide.
- Run:
  git -C /Users/harryphan/Documents/dev/FleetScope status --short --branch
  git -C /Users/harryphan/Documents/dev/FleetScope branch --show-current
- Stop and report if the worktree or branch differs. Preserve unrelated user
  changes. Do not reset --hard or checkout away changes.

EVERYTHING ON THIS BRANCH IS UNCOMMITTED. Story Mode, the Dashboard, the viewer
shell modules, the graph-selection work and `packages/run-ledger/` all live in
the working tree only. Do not stage or discard any of it.

BASELINE

Green as of 2026-08-29. All seven gates pass:

  pnpm check          0 errors, 408 TypeScript tests across 21 files
  cargo test          140 tests
  cargo clippy -D warnings, cargo fmt --check, NO_COLOR=1 pnpm build:wasm
  pnpm qa:browser     490/490
  git diff --check    clean

`pnpm qa:browser` derives its preview port from the process id, so it no longer
collides with a preview server you left running. `FLEETSCOPE_QA_PORT` overrides.

`packages/run-ledger/` is an untracked package in this worktree that belongs to
other work. It is NOT part of this slice. Do not edit, format, stage or discard
it. Its tests are included in the 336 above, so leave that count alone when you
report yours.

READ FIRST (IN THIS ORDER)

1. docs/plans/case-1042-story-mode-plan.md — normative for this slice.
2. docs/plans/zoetrope-audit-and-implementation-plan.md — the product pivot,
   the Zoetrope boundary, and "Graph-node selection — DELIVERED", which records
   the contract /viewer's selection now keeps.
3. docs/product/ui-ux-plan.md — "Cockpit Story Mode (planned)".
4. packages/fixtures/cases/CASE-1042/canonical-events.jsonl — 60 events,
   caseSequence 0..59. The proof chains are verified against THIS file.
5. apps/web/src/features/story/story.ts — the shared card contract to extend.
6. apps/web/tests/story.test.ts — what a local session is forbidden to claim.
7. crates/agent-viewer-render/src/selection.rs — selection is Rust's, not the
   shell's. Read before touching any selection path.
8. scripts/browser-qa.ts — `graphSelectionChecks` is the model for what an
   acceptance check has to prove.
9. apps/web/components.json and apps/web/src/SKILL.md
   READ-ONLY REFERENCES. Untracked, present only in this worktree. Verified to
   contain only the `${REACTBITS_LICENSE_KEY}` environment-variable
   placeholder. Never add the token, never edit or stage these.

INVARIANTS THE GOLDEN PATH AND TOUR DEPEND ON

- The Proof Path is drawn as a connected sequence, so its display order IS a
  claim about chronology. Keep the anchors strictly increasing; a test asserts
  it. Do not re-order for storytelling.
- The tour is built FROM the Proof Path, so the two cannot disagree about where
  a step lives. A step with no anchor is dropped, never given a neighbour.
- The tour drives the SAME canonical cursor. Never add a second playhead.
- Focus moves to the step heading, not the pressed button: Next and Back become
  disabled at the ends and focus on a disabled control is lost.
- Closing the tour must not move the cursor.
- Assertions about drawer contents must be scoped to `[data-evidence-drawer]`.
  A body-wide search passes no matter which event opened, because the tour step
  prints its own event id.
- Story Mode carries no expert-only panels. Both `[data-expert-surface]` blocks
  must stay hidden in Story.

INVARIANTS THE GOLDEN PATH DEPENDS ON

- The Proof Path's display order and its chronology genuinely disagree. Pick the
  active step by GREATEST ANCHOR at or before the cursor, never by position.
  `activeStep` in `enterprise.ts` and `paint()` in `StoryPanel.astro` must stay
  in agreement.
- Anchor a path step to its PROVEN capability, not to the first event of a
  matching type. `identity.allowed` first appears at sequence 7 for a routine
  read, 45 events before the vendor activation.
- A card's drawer opens `primaryEventId` — the event AT the destination — not
  `evidenceEventIds[0]`, which is the first link of the chain.
- `waitForExpertMode()` reads the server-rendered `[data-story]` panel, NOT the
  `data-cockpit-mode` attribute. Script order between the renderer and the panel
  is not guaranteed, and reading the attribute reintroduces a race that mounts
  the renderer against a hidden zero-width canvas.
- `Number(null)` is 0, so an absent `?event=` must be detected as absent rather
  than read as a request for sequence 0.

SEQUENCE NUMBERING — GET THIS RIGHT

`caseSequence` is 0-based. `evt-0001` is sequence 0, so `evt-NNNN` is sequence
`NNNN - 1`. The verified primary destinations are:

  Input screening   evt-0016  caseSequence 15
  Warden recovery   evt-0031  caseSequence 30
  Runtime recovery  evt-0036  caseSequence 35
  Vendor activation evt-0053  caseSequence 52

An earlier brief gave 31, 36 and 53 for the last three. Those are 1-based
ordinals of the same events and are off by one. Use caseSequence everywhere: it
is what the URL, the adapter and the renderer speak.

CURRENT VERIFIED STATE

- Graph-node selection on /viewer is real, accessible and proven:
  - `agent_viewer_graph_nodes()` reports the renderer's own nodes;
    `agent_viewer_select_agent(id)` selects and returns
    selected|deselected|unknown; `agent_viewer_clear_selection()` is Escape.
  - Every ABI answer is a SESSION agent id. The renderer calls the root node
    `main`; `agent-viewer-render/src/selection.rs` owns that translation. Do not
    let `main` escape the renderer. Apply the same rule to the Cockpit mapping.
  - `snapshot().selectedAgentId` is always serialized, explicitly `null` when
    nothing is selected. Do not restore `skip_serializing_if`.
  - The rail and timeline update in place instead of rebuilding, because
    rebuilding destroyed keyboard focus once a second. Do not replace
    `updateRailState` / `updateTimelineState` with an unconditional
    `replaceChildren`.
  - The inspector refuses to show one agent's event under another's selection
    (`foreignEventNote`). Selecting an agent does not move the playhead.
- The blank-graph defect is FIXED and the fix is presentation-only. Both
  /viewer and /cockpit await a visible, measured host (`waitForMeasuredHost`,
  bounded to five seconds of WALL CLOCK) before importing the wasm glue.
  requestAnimationFrame does not fire in a hidden tab, so a frame-counted bound
  would never expire there. Do not remove that wait, do not convert it to a
  frame count, do not simplify it to an unconditional import.
- Browser QA asserts `clientWidth > 0 && clientHeight > 0` on both routes. Keep
  both checks.
- MemWal MCP is intentionally disabled by the operator. Do not re-enable it,
  call it, or add a replacement memory integration.
- The app is Astro. Do not migrate it to React or install App UI blocks without
  an explicit React/Tailwind boundary and a verified license.

OPEN WORK

Follow the implementation order in the plan document, section "Implementation
order", tasks 1 through 10. Task 11 (Slice J comprehension testing with five
real people) is later work and must not be simulated, estimated or fabricated.

DESIGN AND SAFETY RULES

- Never expose model reasoning/chain-of-thought, secrets, raw credentials, raw
  vendor content, or unredacted tool arguments.
- Do not invent live execution. Recorded mode must say it is recorded.
- Do not fabricate a governance outcome, an approval, an identity decision or a
  recovery the recording does not contain. Configuration is not evidence.
- Do not infer evidence from visual position, timestamps, service configuration,
  or copy.
- The graph and timeline stay deterministic Rust/WASM. React Bits is limited to
  Dashboard/onboarding/settings shell and light motion.
- Respect reduced motion, keyboard access, focus visibility, and layout at
  1440x900, 1280x720 and 1180x800.
- /viewer's claims, adapter, disclosure and wording do not change.

REQUIRED VALIDATION

  pnpm check
  cargo test --workspace
  cargo clippy --workspace --all-targets -- -D warnings
  cargo fmt --all -- --check
  NO_COLOR=1 pnpm build:wasm
  pnpm qa:browser
  git diff --check

The baseline above is green. Preserve or improve every number in it. If a gate
is red before you have changed anything, fix that regression first and record
the first meaningful error.

Treat a green suite as necessary, not sufficient. This suite once reported 95/95
while the graph was blank on both routes, and later reported 108/108 while graph
selection did not work at all. In both cases every check it ran was true and
none of them measured the thing that was broken. When you add a feature, add the
assertion that would fail if it silently stopped working, then PROVE it fails by
breaking the feature on purpose and watching the check go red. The plan lists
six specific breaks to perform.

HAND-BACK

Finish with:

1. Exact changed files and behavior.
2. Exact validation commands and pass/fail output, including the first
   meaningful failure if anything is blocked.
3. For each of the six required breaks: the assertion that failed, and the
   evidence you saw it fail before restoring.
4. Any remaining honest limitation.
5. Updated plan/Tracking references for material decisions.
6. Confirmation that the worktree remains uncommitted.
7. A new handoff prompt in this same structure if another agent must continue.
```
