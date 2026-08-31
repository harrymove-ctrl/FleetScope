import { describe, expect, it } from 'vitest';
import { parseConfig, type FleetScopeConfig } from '@fleetscope/shared';
import { createApp } from '../src/app.js';
import { CLOUD_CONSOLE_EVIDENCE } from '../src/cloud/evidence.js';

const config = (source: Record<string, string> = {}): FleetScopeConfig => {
  const result = parseConfig(source);
  if (!result.ok) throw new Error(result.error.join('; '));
  return result.value;
};

const recorded = config();

describe('GET /cloud/console', () => {
  it('answers in recorded mode with no credential', async () => {
    const res = await createApp(recorded, 'silent').request('/cloud/console');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body['schema']).toBe('fleetscope.cloud-console.v1');
    expect(body['mode']).toBe('recorded');
    expect(body['liveMode']).toBe(false);
    expect(body['bounds']).toMatchObject({ startsAgents: false, spendsModelTokens: false });
  });

  it('names the hosted Cloud Run services judges can curl', async () => {
    const body = (await (
      await createApp(recorded, 'silent').request('/cloud/console')
    ).json()) as {
      hosted: { web: { url: string; revision: string }; api: { url: string; liveMode: boolean } };
    };
    expect(body.hosted.web.url).toBe('https://fleetscope-web-6tes2q7oqa-uc.a.run.app');
    expect(body.hosted.web.revision).toBe('fleetscope-web-00001-g4s');
    expect(body.hosted.api.url).toBe('https://fleetscope-api-6tes2q7oqa-uc.a.run.app');
    expect(body.hosted.api.liveMode).toBe(false);
  });

  it('keeps the bundled ADK fixture and the Vertex take as two sessions', async () => {
    const body = (await (
      await createApp(recorded, 'silent').request('/cloud/console')
    ).json()) as {
      session: { invocationId: string; decision: string };
      vertexTake: { invocationId: string };
    };
    expect(body.session.invocationId).toBe('e-d9651b51-1d27-4991-b314-5fe77e4c8e2e');
    expect(body.session.decision).toBe('READY');
    expect(body.vertexTake.invocationId).toBe('e-04e1149b-7b8b-4529-951d-9029e6c7bfdb');
    expect(body.session.invocationId).not.toBe(body.vertexTake.invocationId);
  });
});

describe('GET /cloud/console slices', () => {
  it('returns the Cloud Run probe without listing Storage objects', async () => {
    const body = (await (
      await createApp(recorded, 'silent').request('/cloud/console/run')
    ).json()) as { probe: Record<string, unknown> };
    expect(body.probe['operation']).toBe('run.googleapis.com services.get');
    expect(body.probe['service']).toBe('fleetscope');
    expect(JSON.stringify(body)).not.toContain('objects.list');
  });

  it('returns bucket metadata without object contents', async () => {
    const body = (await (
      await createApp(recorded, 'silent').request('/cloud/console/storage')
    ).json()) as { probe: Record<string, unknown> };
    expect(body.probe['operation']).toBe('storage.googleapis.com buckets.get');
    expect(body.probe['bucket']).toBe('fleetscope-sessions-project-ac0c5f88-868b-46b9-a2e');
    expect(body.probe['uniformAccess']).toBe(true);
  });

  it('returns the launch-readiness decision and agent tree', async () => {
    const body = (await (
      await createApp(recorded, 'silent').request('/cloud/console/session')
    ).json()) as { session: { agents: string[]; modelCalls: number } };
    expect(body.session.agents).toEqual([
      'launch_readiness',
      'cloud_run_probe',
      'storage_probe',
      'budget_guard',
      'launch_reviewer',
    ]);
    expect(body.session.modelCalls).toBe(6);
  });
});

describe('cloud console refusals', () => {
  it('does not expose a write or spend path', async () => {
    const app = createApp(recorded, 'silent');
    for (const path of ['/cloud/console', '/cloud/console/run']) {
      const res = await app.request(path, { method: 'POST' });
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
  });

  it('keeps invoke URLs on the public Cloud Run API', () => {
    expect(CLOUD_CONSOLE_EVIDENCE.invoke.console).toContain('/cloud/console');
    expect(CLOUD_CONSOLE_EVIDENCE.invoke.dryRun).toContain('pnpm demo:google-session');
    expect(CLOUD_CONSOLE_EVIDENCE.invoke.dryRun).not.toContain('--run');
  });
});
