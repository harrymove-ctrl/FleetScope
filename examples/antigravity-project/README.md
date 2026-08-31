# Antigravity example project

This is the small, read-only project used by `pnpm demo:antigravity`. Five
independent Antigravity CLI sessions inspect the same brief, then a final
synthesizer turns their reports into one launch plan.

## Your own folder

1. Create a directory with a `brief.md` (agents read it).
2. From the FleetScope repo root:

```bash
# Browser-first (recommended): skip the terminal TUI
pnpm demo:antigravity -- --no-tui --project /absolute/path/to/your/app
```

Or set `FLEETSCOPE_ANTIGRAVITY_PROJECT` the same way.

3. When the script prints `session_dir=…`, open `/viewer`, click **Follow folder…**,
   and pick **that session directory** (not your project folder, not `session.jsonl`).

If the TUI panics with `crossterm … IoError`, the session is usually still on disk —
use `--no-tui` and Follow folder. Do not pick the project path; pick `session_dir`.

The Agent Viewer also has a paste-path form at `/viewer#agy-project` that copies
the producer command for you. The browser never starts `agy`.

The agents are deliberately run with `--mode plan`: they can inspect the
brief but do not edit this folder. The bridge records each real Antigravity
response as an ADK-compatible JSONL envelope so FleetScope can follow it live.

The project brief is a tiny product exercise: design a calm dashboard that
helps a team understand which agents are running, what they are waiting for,
and what evidence is trustworthy.
