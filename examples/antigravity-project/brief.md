# Agent workbench brief

Design a first demo for a read-only session observer. A user should be able to
open one session, see the coordinator and its sub-agents, inspect the latest
tool/result, and replay the same evidence without triggering a new model call.

Constraints:

- local-first; never upload the session by default;
- show live, replay, failed, and waiting states clearly;
- keep the first-run path understandable in under one minute;
- preserve provider and model evidence separately from UI labels.
