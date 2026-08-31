# Chat in real `agy` — Viewer follows

Chat at the rainbow **`>`** prompt (`agy --dangerously-skip-permissions`).
Do not use `pnpm demo:agy-chat` (`you>`) unless you want the fake prompt.

```
Terminal A   pnpm dev:web
Terminal B   pnpm demo:agy -- --project <folder>
             → agy --dangerously-skip-permissions   ← TYPE HERE
Browser      http://127.0.0.1:4321/viewer
```

`pnpm demo:agy` starts the real CLI **and** a sidecar that tails
`~/.gemini/antigravity-cli/brain/<id>/.../transcript.jsonl` into
`.fleetscope/sessions/agy-repl.*/session.jsonl`.

---

## Terminal A — web

```bash
cd /Users/harryphan/Documents/dev/FleetScope
pnpm dev:web
```

Open http://127.0.0.1:4321/viewer

---

## Terminal B — chat (this is `agy`)

```bash
cd /Users/harryphan/Documents/dev/FleetScope
pnpm demo:agy -- --project /Users/harryphan/Documents/dev/fleetscope-agy-demo-20260831-133844
```

You should see `session_dir=.../agy-repl.XXXX` then the **Antigravity CLI 1.1.x** banner and `>`.

1. Refresh `/viewer` (or Follow that `session_dir`)
2. Type at `>` like normal `agy`
3. Graph should grow as transcript.jsonl grows

Same as running `agy --dangerously-skip-permissions` yourself in that folder,
plus the follower.

If you already opened bare `agy` in a folder, also run the follower in another tab:

```bash
cd /Users/harryphan/Documents/dev/FleetScope
python3 scripts/agy-repl-follow.py \
  --project /Users/harryphan/Documents/dev/fleetscope-agy-demo-20260831-133844 \
  --session-dir .fleetscope/sessions/agy-repl-manual
```

Then Follow `agy-repl-manual` in the viewer.

---

## Do not

| Action | Why |
|--------|-----|
| Follow the project folder (`…/fleetscope-agy-demo-…`) | Only `brief.md`, no session.jsonl |
| Expect Viewer to read the IDE/`agy` store with no sidecar | Private `transcript.jsonl` until followed |
| `pnpm demo:antigravity` for continuous chat | One-shot 5 workers then `done` |

---

## Quota

Every `>` turn is real Vertex via your Google AI Pro login.
