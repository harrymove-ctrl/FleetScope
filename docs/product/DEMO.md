# FleetScope demo — full operator script

Chat **directly in Antigravity CLI** (rainbow `>`). FleetScope **watches** — it does
not replace the chat. New sessions and later sub-agent conversations on that
project folder auto-appear under **Local sessions** (Follow newest).

Git: https://github.com/harrymove-ctrl/FleetScope/tree/feat/agent-viewer-cli  
PR: https://github.com/jasong-03/FleetScope/pull/1  
Prod (recorded only): https://fleetscope-web-6tes2q7oqa-uc.a.run.app/  
Talk script + prompts: [TALK.md](./TALK.md)

---

## Leave running (Terminal A)

```bash
cd /Users/harryphan/Documents/dev/FleetScope
pnpm dev:web    # http://127.0.0.1:4321
pnpm dev:ui     # :5173 optional (Approvals / Dashboard embeds)
```

Open **http://127.0.0.1:4321/viewer** — **Follow newest** stays on.

---

## Chat (Terminal B) — real `agy`

```bash
cd /Users/harryphan/Documents/dev/FleetScope
pnpm demo:agy -- --project /Users/harryphan/Documents/dev/fleetscope-agy-demo-20260831-133844
```

This **is** `agy --dangerously-skip-permissions` in that project (same UI as
`agy '--dangerously-skip-permissions'`). Type at `>`.

A sidecar tails `~/.gemini/antigravity-cli` transcripts (main conversation **and**
later sub-agent conversations on that cwd) into:

`.fleetscope/sessions/agy-repl.*/session.jsonl`

Viewer polls that folder. Graph / agents / timeline update while you chat.
Spawn more agents in `agy` → named nodes (`researcher`, `ux_designer`, …) plus
their child transcripts, not a single `chat` / `invoke_subagent` blob.

On `/viewer` you can **Copy agy chat** for the same command.

---

## Demo beats (~8 min)

| Beat | Where | What you say |
|------|--------|----------------|
| 1 Landing | http://127.0.0.1:4321/ | Watch agent work become evidence. No upload. |
| 2 Poster | `/demo` | Seven readings, zero click, recorded. |
| 3 **Live chat** | Terminal B `>` + `/viewer` | Chat in Antigravity. Viewer lists **all** local sessions. Follow newest. Sub-agents show up as the JSONL grows. |
| 4 Approvals | `/approvals` | HITL rehearsal (budget / upload / READY). No cloud write. |
| 5 Dashboard | `/dashboard` | Readiness, not SaaS revenue. |
| 6 Cloud Console | `/console` | Recorded Cloud Run / Storage / ADK. Not live IAM. |

---

## Do not

- Follow the **project** folder (`…/fleetscope-agy-demo-…` — only `brief.md`).
- Chat in a **bare** `agy` tab **without** `pnpm demo:agy` (no sidecar → Viewer blind).  
  If you already opened bare `agy`, keep it and run the sidecar in another tab:
  ```bash
  cd /Users/harryphan/Documents/dev/FleetScope
  python3 scripts/agy-repl-follow.py \
    --project /Users/harryphan/Documents/dev/fleetscope-agy-demo-20260831-133844 \
    --session-dir .fleetscope/sessions/agy-repl-manual
  ```
  Then click that row in **Local sessions**.
- Use `pnpm demo:antigravity` for this beat — that is a **one-shot** 5-worker batch.

---

## Pitch

You talk to Antigravity CLI like a normal user. FleetScope is the observer:
every local session, including new ones and sub-agents on that project, updates
the graph from JSONL on disk.
