# Antigravity example project

This is the small, read-only project used by `pnpm demo:antigravity`. Five
independent Antigravity CLI sessions inspect the same brief, then a final
synthesizer turns their reports into one launch plan.

The agents are deliberately run with `--mode plan`: they can inspect the
brief but do not edit this folder. The bridge records each real Antigravity
response as an ADK-compatible JSONL envelope so FleetScope can follow it live.

The project brief is a tiny product exercise: design a calm dashboard that
helps a team understand which agents are running, what they are waiting for,
and what evidence is trustworthy.
