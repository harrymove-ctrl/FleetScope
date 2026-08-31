import { Hono } from 'hono';
import type { FleetScopeConfig } from '../config/index.js';

/**
 * What this service is, answered at the root instead of a bare 404.
 *
 * The endpoint list is read out of Hono's own router at request time rather
 * than written here by hand. A hand-kept list is a second copy of the truth
 * and drifts the first time someone adds a route; this one cannot describe an
 * endpoint that does not exist, and cannot hide one that does -- a route with
 * no summary is still listed, marked undocumented, which is noisier than
 * omitting it and that is the point.
 *
 * `bounds` is the half that matters to another agent: what this service will
 * refuse. A caller that reads only `endpoints` learns what it can try; a
 * caller that reads `bounds` learns what it must not bother trying, and why
 * the answer will not change by asking again.
 */
export interface EndpointDescription {
  readonly method: string;
  readonly path: string;
  readonly summary: string;
}

const SUMMARIES: Record<string, string> = {
  'GET /': 'This document.',
  'GET /.well-known/agent.json': 'This document, at the conventional discovery path.',
  'GET /health': 'Liveness, environment, and whether the live path is armed.',
  'GET /capability': 'What the live path would be allowed to do, and its per-case limits.',
  'GET /cloud/console': 'Recorded Google Cloud evidence. No GCP login, no Vertex spend.',
  'GET /cloud/console/run': 'Recorded Cloud Run service probe and hosted revision.',
  'GET /cloud/console/storage': 'Recorded Cloud Storage bucket metadata. No object listing.',
  'GET /cloud/console/session': 'Recorded launch-readiness ADK session and READY decision.',
  'POST /live/decision': 'One allowlisted live decision. Refused unless LIVE_MODE is on.',
  'GET /runs/capability': 'Whether a run can be admitted right now, and under what budget.',
  'GET /runs/active': 'Runs currently admitted.',
  'GET /runs/:runId': 'One run, by id.',
  'GET /runs/:runId/events': 'That run’s events, append-only and in order.',
  'POST /runs/:runId/events': 'Append an event to a run.',
  'POST /runs': 'Admit a run, subject to the budget in /runs/capability.',
};

function describe(app: Hono): EndpointDescription[] {
  const seen = new Set<string>();
  const out: EndpointDescription[] = [];
  for (const route of app.routes) {
    // Middleware registers as ALL /* and is not an endpoint anyone can call.
    if (route.method === 'ALL') continue;
    const key = `${route.method} ${route.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      method: route.method,
      path: route.path,
      summary: SUMMARIES[key] ?? 'Undocumented route — present in the router.',
    });
  }
  return out.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

export function descriptorRoutes(app: Hono, config: FleetScopeConfig): Hono {
  const routes = new Hono();

  const card = () => ({
    name: 'fleetscope-api',
    summary:
      'The bounded read-only backend behind FleetScope, which reads agent sessions ' +
      'that already exist and turns them into evidence.',
    liveMode: config.liveMode,
    endpoints: describe(app),
    bounds: {
      startsAgents: false,
      retriesToolCalls: false,
      uploadsSessionFiles: false,
      servesCaseData: false,
      note: config.liveMode
        ? 'The live path is armed and is allowlisted per case; see /capability for its limits.'
        : 'Recorded-only. Every live path answers with a refusal rather than a model call, ' +
          'so nothing here can spend money or reach a provider.',
    },
    evidence: {
      note: 'Recorded evidence ships with the static frontend, so the product works with this service switched off.',
    },
  });

  routes.get('/', (c) => c.json(card()));
  routes.get('/.well-known/agent.json', (c) => c.json(card()));

  return routes;
}
