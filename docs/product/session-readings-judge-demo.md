# Session readings — judge / video poster

**Status:** active  
**Route:** `/demo`  
**Last updated:** 2026-08-31

## Open

```text
http://localhost:4322/demo
```

(or whatever port `astro dev` printed)

This page is the **non-interactive** Session Observer poster. It does not load
WASM, does not Follow a file, does not offer fullscreen/buttons/controls, and
does not start a model. Scroll only. Leave via the site nav.

For the interactive flight deck (graph / rail / inspector), open `/viewer`
only after the poster has made the story clear.

## What the judge should see in one breath

```text
4 agents in handoff order · 1 call never returned · 2 failed events · 49.5s
Agents that ran: coordinator · flight_search · hotel_search · itinerary_writer
```

Then scroll the seven readings:

1. handoffs  
2. who held the run  
3. agent tree  
4. calls answered  
5. event health  
6. session  
7. timeline  

## 60-second script

| Time | Say | Do |
|---|---|---|
| 0–10s | “This is recorded evidence from one Gemini / Antigravity multi-agent run. Nothing is executing on this page.” | Point at the status line. |
| 10–25s | “Four agents handed work in order. Hotel search timed out.” | Point at handoffs, then who-held (hatched lane). |
| 25–40s | “One tool call never returned. That is in the record, not inferred.” | Point at calls answered `[ ] search_hotels`. |
| 40–55s | “The full timeline is the same file, second by second.” | Scroll timeline; stop on the failed hotel rows. |
| 55–60s | “If you want the live follow surface, that is Agent Viewer — separate from this poster.” | Optional: open `/viewer`. |

## What not to claim

- Not live. This route never calls Vertex or Antigravity.
- Do not invent cost, tokens, or latency beyond the recorded fields.
- Do not open `/viewer` first to explain the product to a judge.

## Visual language

Antigravity restraint: serif display, Gemini orb, cyan kicker, blue focus,
fault red only when the record failed. No Claude-style dashed sticker frames.

## Related

- Operator deck: `/viewer`
- Design split: [paired-viewers.md](../design/paired-viewers.md)
- Session Observer brief: [session-observer.md](session-observer.md)
