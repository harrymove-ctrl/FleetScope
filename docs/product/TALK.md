# FleetScope — talk script, e2e flow, prompts

**Product:** read-only Session Observer. You chat in real Antigravity CLI. FleetScope watches JSONL.

**Do not say:** FleetScope starts agents, Cloud Run is live chat, `/demo` seven readings are the four sub-agents, “cryptographic proof”.

---

## Links (say these out loud)

| Surface | URL | What it actually is |
|---------|-----|---------------------|
| **Local live** | http://127.0.0.1:4321/viewer | Follows `.fleetscope/sessions` on this machine |
| **Local poster** | http://127.0.0.1:4321/demo | Live TUI cards from newest local JSONL **plus** bundled fixture readings |
| **Prod web** | https://fleetscope-web-6tes2q7oqa-uc.a.run.app/ | Cloud Run, **recorded-only** (`liveMode: false`) |
| **Prod demo** | https://fleetscope-web-6tes2q7oqa-uc.a.run.app/demo/ | Same fixture poster. No 127.0.0.1 sessions. |
| **Prod viewer** | https://fleetscope-web-6tes2q7oqa-uc.a.run.app/viewer/ | Drop a file / load launch-readiness. Cannot list your laptop. |
| **Prod API** | https://fleetscope-api-6tes2q7oqa-uc.a.run.app/health | `{"status":"ok","liveMode":false}` |
| **GitHub PR** | https://github.com/jasong-03/FleetScope/pull/1 | `harrymove-ctrl:feat/agent-viewer-cli` → `jasong-03/main` |
| **Fork branch** | https://github.com/harrymove-ctrl/FleetScope | Working fork |

Prod never tails `agy`. Live multi-agent graph is **local `/viewer` only**.

---

## Setup (before you talk)

**Terminal A — web**

```bash
cd /Users/harryphan/Documents/dev/FleetScope
pnpm dev:web
```

**Browser tabs (order):**

1. http://127.0.0.1:4321/
2. http://127.0.0.1:4321/demo
3. http://127.0.0.1:4321/viewer  (Follow newest ON)
4. https://fleetscope-web-6tes2q7oqa-uc.a.run.app/demo/
5. https://fleetscope-api-6tes2q7oqa-uc.a.run.app/health

**Terminal B — real agy (do not open bare `agy`)**

```bash
cd /Users/harryphan/Documents/dev/FleetScope
pnpm demo:agy -- --project /Users/harryphan/Documents/dev/fleetscope-agy-demo-20260831-133844
```

Wait for `session_dir=.../agy-repl.XXXX` and the rainbow `>`.

---

## Beat-by-beat talk (≈10 min)

### 0. One sentence (10s)

> “You talk to Antigravity like a normal user. FleetScope is the observer: JSONL on disk, agent graph in the browser, nothing uploaded.”

### 1. Landing — http://127.0.0.1:4321/ (30s)

> “Watch agent work become evidence. The viewer does not start a model.”

### 2. Prod honesty — Cloud Run tab (45s)

Open https://fleetscope-web-6tes2q7oqa-uc.a.run.app/demo/

> “This is the **deployed** site on Cloud Run. `liveMode` is false. Judges can open it without a laptop session. It shows a **recorded** launch-readiness / travel-crew fixture — coordinator, flight_search, hotel_search. It is not the four sub-agents we are about to spawn.”

Open https://fleetscope-api-6tes2q7oqa-uc.a.run.app/health

> “API health: production, liveMode false. One bounded read-only service.”

### 3. Local `/demo` — live TUI vs fixture (45s)

http://127.0.0.1:4321/demo

> “On loopback, the **boxed TUI at the top** is the newest local `agy` JSONL. The **seven glyph readings below** are still the bundled fixture. Two layers, labelled. Cloud Run only has the fixture.”

### 4. Live chat — Terminal B + `/viewer` (5 min) — THIS is the product

Hard-refresh http://127.0.0.1:4321/viewer  
Local sessions should list `agy-repl.*`. Follow newest.

**Paste at `>` — Prompt 1 (spawn four, do not do their jobs):**

```
Read brief.md in this folder. Then spawn FOUR parallel subagents. Do not do their jobs yourself.

1) researcher — user jobs, worst failure, one demo moment for a session observer. Read-only.
2) ux_designer — first screen, live vs replay, one primary action. Read-only.
3) qa_planner — checks: live follow, duplicate events, failed child, replay. Read-only.
4) cloud_architect — smallest Google proof (Cloud Run + Storage reads, no writes). Read-only.

Wait for all four. Then synthesize: 60-second demo script, agent graph, three proof checks.
Do not edit files. Prefer honest unknown over fake completion.
```

**What you say while it runs:**

> “That prompt is in Antigravity, not in FleetScope. Sidecar tails `transcript.jsonl`, including child brains. Graph should grow `chat` plus `researcher`, `ux_designer`, `qa_planner`, `cloud_architect` — names, not one `invoke_subagent` blob.”

Click **Full screen TUI**. Esc to leave.

**Prompt 2 (if they already spawned — status only):**

```
List the four subagents with conversation ids and state. Do not spawn more. Summarize each in three bullets.
```

**Prompt 3 (failed child, honest unknown):**

```
Ask qa_planner to describe what the viewer must show if one child errors and the parent claims success. Do not edit files.
```

**Prompt 4 (stop / wrap):**

```
Stop spawning. Give me the 60-second operator script only: where I look, what I must not claim.
```

### 5. Approvals / dashboard / console (90s, optional)

| Tab | Line |
|-----|------|
| `/approvals` | “HITL rehearsal. No cloud write.” |
| `/dashboard` | “Readiness, not a SaaS dashboard.” |
| `/console` | “Recorded Cloud Run / Storage / ADK evidence. Not live IAM.” |

### 6. Close (20s)

> “Chat stays in `agy`. Evidence stays local JSONL. Prod is the recorded proof the judges can open. Live follow is this machine.”

---

## Prompts only (copy stack)

Use **one** per turn at `>`.

**A — fan-out (primary demo)**

```
Read brief.md. Spawn four parallel read-only subagents: researcher, ux_designer, qa_planner, cloud_architect. You orchestrate only. Wait, then synthesize a 60s demo script, the agent graph, and three proof checks. Do not edit files.
```

**B — identity check (viewer must match CLI)**

```
Print each subagent type, role, conversation id, and running/idle/done. No new agents.
```

**C — live vs replay**

```
In one screen: how should Live Follow vs Replay be obvious? One primary operator action. No files.
```

**D — failure honesty**

```
Worst failure for this observer: parent says done while a child crashed. What must the graph show? Prefer honest unknown.
```

**E — smallest Google proof**

```
cloud_architect: Cloud Run URL + Storage read-only. No writes. Name the deployed fleetscope-web service as the recorded site, not as live tailing.
```

---

## E2E checklist (you run this)

- [ ] `pnpm demo:agy` prints `session_dir` and `>` (not `agy_args unbound`)
- [ ] `/viewer` Local sessions lists that folder in <2s (not stuck “Looking…”)
- [ ] After Prompt A: inspect / graph shows **5 agents** (`chat` + 4 names)
- [ ] Full screen TUI fills the display; Esc restores
- [ ] `/demo` live cards show those names; seven readings still say coordinator/flight_search
- [ ] Prod `/demo/` loads without 127.0.0.1; health `liveMode: false`
- [ ] Never Follow the **project** folder (only `brief.md`)

---

## If it breaks

| Symptom | Fix |
|---------|-----|
| Viewer “Looking…” forever | Hard-refresh. List is independent of WASM. |
| Graph is one `chat` node | Sidecar old; restart `python3 scripts/agy-repl-follow.py --project <dir> --session-dir <session_dir>` |
| Chatted in bare `agy` | Keep CLI; start sidecar in another tab (command in DEMO.md) |
| Prod has no sub-agents | Expected. Prod is recorded. Live is `:4321/viewer` |
| `pnpm demo:antigravity` | One-shot batch, not continuous chat. Do not use for this beat. |
