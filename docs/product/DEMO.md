# FleetScope demo — full operator script

Servers (leave running):

```bash
cd /Users/harryphan/Documents/dev/FleetScope
pnpm dev:web    # http://127.0.0.1:4321
pnpm dev:ui     # http://127.0.0.1:5173  (Approvals/Dashboard embeds)
```

Git: https://github.com/harrymove-ctrl/FleetScope/tree/feat/agent-viewer-cli

---

## Beat 1 — Landing (30s)

http://127.0.0.1:4321/

Watch agent work become evidence. Local JSONL. Viewer never uploads, never starts a model.

---

## Beat 2 — Session readings (1 min)

http://127.0.0.1:4321/demo

Zero-click poster. Seven readings. Recorded only.

---

## Beat 3 — Chat in **real agy** + watch all sessions (core)

**Terminal A** already has `pnpm dev:web`.

**Terminal B — this is the chat** (rainbow CLI, prompt `>`):

```bash
cd /Users/harryphan/Documents/dev/FleetScope
pnpm demo:agy -- --project /Users/harryphan/Documents/dev/fleetscope-agy-demo-20260831-133844
```

Same as `agy --dangerously-skip-permissions` in that folder, plus a sidecar that tails
`~/.gemini/antigravity-cli/.../transcript.jsonl` into `.fleetscope/sessions/agy-repl.*/session.jsonl`.

**Browser:** http://127.0.0.1:4321/viewer

1. See **Local sessions** — every `session.jsonl` on this machine.
2. **Follow newest** on (default) while you chat, or click a row to pin one.
3. Type at `>` in Terminal B. Graph / timeline grow.

Do **not** Follow the project folder (`fleetscope-agy-demo-…` = only `brief.md`).
Do **not** chat in a bare `agy` tab without `pnpm demo:agy` (no sidecar → Viewer is blind).

On `/viewer` you can also **Copy agy chat** (same command).

---

## Beat 4 — Approvals (1 min)

http://127.0.0.1:4321/approvals

Launch readiness HITL (budget / upload / READY). Rehearsal only — no cloud write.

---

## Beat 5 — Dashboard (45s)

http://127.0.0.1:4321/dashboard

Readiness, not SaaS revenue. **New Antigravity folder…** jumps to the viewer form.

---

## Beat 6 — Cloud Console (1 min)

http://127.0.0.1:4321/console

Recorded Cloud Run / Storage / ADK facts. Not live GCP IAM.

---

## Optional one-shot (not continuous chat)

```bash
pnpm demo:antigravity --no-tui --project /Users/harryphan/Documents/dev/fleetscope-agy-demo-20260831-133844
```

Five workers then `producer=done`. Use only if you want a canned fan-out, not live chat.

---

## Offline TUI

```bash
cd /Users/harryphan/Documents/dev/FleetScope
cargo run -p fleetscope-cli --bin fleetscope -- examples/gemini-session --tiny
```

---

## Pitch (one breath)

FleetScope is a read-only session observer. You chat in real Antigravity CLI.
We graph who ran, tools, and wait states from JSONL on disk — browser or the
same Rust TUI — without uploading the transcript.
