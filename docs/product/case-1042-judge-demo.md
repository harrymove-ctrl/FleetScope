# CASE-1042 judge demo — 90 second script

Last updated: 2026-08-29

## Open

```text
http://localhost:4321/cockpit/CASE-1042/
```

Story Mode is the default. Nothing needs to be configured, and no graph needs to
be opened.

## The script

| Time | Say | Do |
|---|---|---|
| 0–15s | "This is recorded canonical evidence from one vendor onboarding case. Nothing is executing." | Point at `● Recorded CASE-1042 evidence — nothing is executing`, then the outcome line. |
| 15–30s | "The agent was sent a prompt injection over vendor email. It was blocked before it became memory." | Start guided tour, Next to step 3 (Screen). View evidence → `evt-0016`. |
| 30–50s | "The logistics check timed out three times. Policy permitted exactly one retry, and it worked." | Next to step 4 (Recover). View evidence → `evt-0036`. |
| 50–70s | "The externally visible action waited for a person." | Next to step 5 (Approve). View evidence → `evt-0045`. |
| 70–85s | "The vendor was activated under that approval, and identity allowed the approved request." | Next to step 6 (Activate). View evidence → `evt-0053`. |
| 85–90s | "The same evidence in the expert surface, at the same event." | Open in Expert Mode. |

## Expected evidence ids

| Claim | Primary event | Sequence |
|---|---|---|
| Input screening | `evt-0016` | 15 |
| Warden recovery | `evt-0031` | 30 |
| Runtime recovery | `evt-0036` | 35 |
| Vendor activation | `evt-0053` | 52 |

`caseSequence` is **0-based**: `evt-0053` is the 53rd event and sequence 52. The
UI shows the 1-based position ("Canonical event 53 of 60") because that is what a
person counts.

## Shareable URLs

```text
/cockpit/CASE-1042/?mode=story&event=15&tour=screen
/cockpit/CASE-1042/?mode=story&event=35&tour=recover
/cockpit/CASE-1042/?mode=expert&event=52&tour=activate
```

Reload restores the same step. Browser Back walks the tour backwards.

## If the renderer fails

Story Mode is server-rendered and needs no WASM. If `/wasm/cockpit.js` fails to
load, the entire demo above still works; only "Open in Expert Mode" degrades,
and it says why rather than showing a blank graph. **Do not open Expert Mode as
the opening move** — Story is the pitch, Expert is the proof.

If the graph does appear but draws nothing, the renderer measured a zero-width
canvas. Reload with `?mode=expert` and report it; do not present a blank graph
as an empty case.

## What not to claim

- Not live. Nothing is executing, and no agent is running.
- Do not say FleetScope *prevented* anything. It **recorded** that a control
  acted. The distinction is the product.
- Do not describe an approval, recovery, activation, Warden action or screening
  result from configuration. Every claim on the page has an event id behind it;
  if a claim has no id, it is not evidenced and the card says so.
- Do not generalise beyond this fixture. These are claims about one recording.
- Do not open the graph to explain the product. If a judge needs the graph to
  understand it, the Story failed and that is the finding.

## Supported viewports

1440×900, 1280×720, 1180×800. Verified: no body overflow, cards reflow 4 → 2 → 2,
chapters scroll horizontally.

## Validation

```text
pnpm check
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings
cargo fmt --all -- --check
NO_COLOR=1 pnpm build:wasm
pnpm qa:browser
git diff --check
```

## Screenshots

`docs/product/screenshots/case-1042-tour-{1440x900,1280x720,1180x800}.png`
