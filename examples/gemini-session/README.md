# FleetScope CLI example

This folder is a small Google ADK-shaped Gemini session you can open directly
with the native viewer. It is intentionally safe and offline: the file is a
recording, not an agent runtime, and contains no credentials.

From the repository root:

```bash
cargo run -p fleetscope-cli --bin fleetscope -- examples/gemini-session
cargo run -p fleetscope-cli --bin fleetscope -- examples/gemini-session --follow
cargo run -p fleetscope-cli --bin fleetscope -- inspect examples/gemini-session
```

The browser can observe the same file from `/viewer/` with **Open folder…**.
For the real Google producer, run `pnpm demo:google-session -- --run`; it
creates `.fleetscope/sessions/<session-id>/session.jsonl` and prints the exact
CLI follow command.
