import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/index.js';

const app = createApp(loadConfig(), 'silent');
const card = async (path: string) => {
  const res = await app.request(path);
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
};

describe('the service descriptor', () => {
  it('answers at the root instead of 404', async () => {
    const { status, body } = await card('/');
    expect(status).toBe(200);
    expect(body['name']).toBe('fleetscope-api');
  });

  it('answers at the conventional discovery path too', async () => {
    const root = await card('/');
    const wellKnown = await card('/.well-known/agent.json');
    expect(wellKnown.status).toBe(200);
    expect(wellKnown.body).toEqual(root.body);
  });

  /*
   * The point of deriving the list from Hono's router: it cannot fall behind
   * the service. If someone adds a route and no summary, it still appears --
   * marked undocumented, which is a nudge rather than a silent omission.
   */
  it('lists every callable route the app actually has', async () => {
    const { body } = await card('/');
    const listed = new Set(
      (body['endpoints'] as { method: string; path: string }[]).map((e) => `${e.method} ${e.path}`),
    );
    const real = app.routes.filter((r) => r.method !== 'ALL').map((r) => `${r.method} ${r.path}`);
    expect(real.length).toBeGreaterThan(0);
    for (const route of real) expect(listed.has(route)).toBe(true);
  });

  it('describes no route the app does not have', async () => {
    const { body } = await card('/');
    const real = new Set(
      app.routes.filter((r) => r.method !== 'ALL').map((r) => `${r.method} ${r.path}`),
    );
    for (const e of body['endpoints'] as { method: string; path: string }[]) {
      expect(real.has(`${e.method} ${e.path}`)).toBe(true);
    }
  });

  it('carries the run endpoints, which are the agentic surface', async () => {
    const { body } = await card('/');
    const paths = (body['endpoints'] as { path: string }[]).map((e) => e.path);
    for (const p of ['/runs', '/runs/capability', '/runs/:runId/events']) {
      expect(paths).toContain(p);
    }
  });

  it('states what it refuses, not only what it offers', async () => {
    const { body } = await card('/');
    const bounds = body['bounds'] as Record<string, unknown>;
    expect(bounds['startsAgents']).toBe(false);
    expect(bounds['uploadsSessionFiles']).toBe(false);
    expect(bounds['retriesToolCalls']).toBe(false);
    expect(String(bounds['note']).length).toBeGreaterThan(20);
  });

  it('reports the live mode the service is actually running in', async () => {
    const { body } = await card('/');
    expect(body['liveMode']).toBe(loadConfig().liveMode);
  });

  it('leaves a real route reachable rather than shadowing it', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const health = (await res.json()) as { status?: string };
    expect(health.status).toBe('ok');
  });
});
