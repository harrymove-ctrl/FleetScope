import { describe, expect, it } from 'vitest';
import {
  CONSOLE_APP_PATH,
  CONSOLE_RUN_URL,
  DEMO_TALK,
  GCLOUD_DESCRIBE,
  SUPPORT_AGY_COMMAND,
  LAUNCH_PLAN_CALLS,
  LAUNCH_PLAN_PHASES,
  LAUNCH_PLAN_STEPS,
  LAUNCH_PLAN_TOOLS,
  SUPPORT_CLI_COMMAND,
  SUPPORT_FORMATS,
  SUPPORT_PRIVACY,
} from '../src/features/dashboard/launch-plan';

describe('launch plan', () => {
  it('names the Google action path without inventing a dollar cost', () => {
    expect(LAUNCH_PLAN_STEPS).toBe(5);
    expect(LAUNCH_PLAN_CALLS).toBe(6);
    expect(LAUNCH_PLAN_PHASES.map((phase) => phase.name).join(' ')).toContain('READY');
    expect(LAUNCH_PLAN_PHASES.every((phase) => phase.state === 'approved')).toBe(true);
    expect(CONSOLE_APP_PATH).toBe('/console');
    expect(CONSOLE_RUN_URL).toContain('console.cloud.google.com/run');
    expect(DEMO_TALK.length).toBe(4);
    expect(LAUNCH_PLAN_TOOLS).toContain('gcloud CLI');
    expect(LAUNCH_PLAN_TOOLS).toContain('FleetScope viewer');
    expect(GCLOUD_DESCRIBE).toContain('gcloud run services describe');
    expect(GCLOUD_DESCRIBE).toContain('fleetscope-web');
    expect(SUPPORT_AGY_COMMAND).toContain('.fleetscope/sessions/antigravity-live-cu');
    expect(SUPPORT_AGY_COMMAND).toContain('--follow --tiny');
    expect(SUPPORT_CLI_COMMAND).toContain('cd /Users/harryphan/Documents/dev/FleetScope');
    expect(SUPPORT_CLI_COMMAND).toContain('cargo run -p fleetscope-cli');
    expect(SUPPORT_CLI_COMMAND).toContain('examples/gemini-session --follow --tiny');
    expect(SUPPORT_CLI_COMMAND).not.toContain('~/sessions/my-run');
    expect(SUPPORT_PRIVACY).toContain('never uploads');
    expect(SUPPORT_PRIVACY).not.toContain('files you choose');
    expect(SUPPORT_FORMATS.map((item) => item.id).join(' ')).toContain('.jsonl');
  });
});
