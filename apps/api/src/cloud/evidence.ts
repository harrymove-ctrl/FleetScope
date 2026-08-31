/**
 * Recorded Google Cloud evidence the judge console can serve without ADC,
 * Vertex, or a model call. Hosted URLs are the 2026-08-31 Cloud Run proof.
 * Probe payloads are the checked-in ADK fixture the viewer can replay.
 * Those are two sessions — do not merge them into one invocation id.
 */

export const CLOUD_CONSOLE_SCHEMA = 'fleetscope.cloud-console.v1';

export const GCP_PROJECT = 'project-ac0c5f88-868b-46b9-a2e';
export const GCP_REGION = 'us-central1';

export const HOSTED_WEB_URL = 'https://fleetscope-web-6tes2q7oqa-uc.a.run.app';
export const HOSTED_API_URL = 'https://fleetscope-api-6tes2q7oqa-uc.a.run.app';

export const CLOUD_CONSOLE_BOUNDS = {
  startsAgents: false,
  retriesToolCalls: false,
  uploadsSessionFiles: false,
  spendsModelTokens: false,
  requiresGcpLogin: false,
  note:
    'Recorded-only. GET returns the last captured Cloud Run, Storage, and ADK ' +
    'facts. Nothing here calls Vertex, gcloud, or the Cloud Admin APIs.',
} as const;

const cloudRunProbe = {
  status: 'ok',
  service: 'fleetscope',
  location: GCP_REGION,
  uri: 'https://fleetscope-6tes2q7oqa-uc.a.run.app',
  latestReadyRevision: 'fleetscope-00001-4mn',
  ready: true,
  latestTrafficPercent: 100,
  operation: 'run.googleapis.com services.get',
  source: 'crates/fleetscope-cli/tests/fixtures/google-cloud-launch-readiness/session.jsonl',
} as const;

const storageProbe = {
  status: 'ok',
  bucket: 'fleetscope-sessions-project-ac0c5f88-868b-46b9-a2e',
  location: 'US-CENTRAL1',
  storageClass: 'STANDARD',
  uniformAccess: true,
  versioning: false,
  operation: 'storage.googleapis.com buckets.get',
  source: 'crates/fleetscope-cli/tests/fixtures/google-cloud-launch-readiness/session.jsonl',
} as const;

export const CLOUD_CONSOLE_EVIDENCE = {
  schema: CLOUD_CONSOLE_SCHEMA,
  mode: 'recorded' as const,
  observedAt: '2026-08-31',
  bounds: CLOUD_CONSOLE_BOUNDS,
  project: {
    id: GCP_PROJECT,
    region: GCP_REGION,
  },
  hosted: {
    web: {
      service: 'fleetscope-web',
      revision: 'fleetscope-web-00001-g4s',
      url: HOSTED_WEB_URL,
      region: GCP_REGION,
      consolePath: '/console',
    },
    api: {
      service: 'fleetscope-api',
      revision: 'fleetscope-api-00001-qtm',
      url: HOSTED_API_URL,
      region: GCP_REGION,
      liveMode: false,
    },
  },
  probes: {
    cloudRun: cloudRunProbe,
    storage: storageProbe,
  },
  session: {
    caseId: 'google-cloud-launch-readiness',
    invocationId: 'e-d9651b51-1d27-4991-b314-5fe77e4c8e2e',
    adkSessionId: 'demo-rec-20260830T182359Z',
    producer: 'google-adk 2.8.0',
    configuredModel: 'gemini-3.7-flash',
    observedModel: 'gemini-3.7-flash',
    decision: 'READY',
    modelCalls: 6,
    timeoutSeconds: 180,
    cloudReads: 2,
    cloudWritesDuringWorkflow: 0,
    agents: [
      'launch_readiness',
      'cloud_run_probe',
      'storage_probe',
      'budget_guard',
      'launch_reviewer',
    ],
    fixture: 'crates/fleetscope-cli/tests/fixtures/google-cloud-launch-readiness/session.jsonl',
  },
  vertexTake: {
    invocationId: 'e-04e1149b-7b8b-4529-951d-9029e6c7bfdb',
    projection: 'ef62b782198ed6b3',
    observedModel: 'gemini-3.7-flash',
    observedAt: '2026-08-31',
    note: 'Separate provider-backed take. Not the bundled fixture session.',
  },
  invoke: {
    health: `${HOSTED_API_URL}/health`,
    capability: `${HOSTED_API_URL}/capability`,
    console: `${HOSTED_API_URL}/cloud/console`,
    run: `${HOSTED_API_URL}/cloud/console/run`,
    storage: `${HOSTED_API_URL}/cloud/console/storage`,
    session: `${HOSTED_API_URL}/cloud/console/session`,
    webConsole: `${HOSTED_WEB_URL}/console`,
    gcloudRun:
      'gcloud run services describe fleetscope-web --region us-central1 --project project-ac0c5f88-868b-46b9-a2e',
    gcloudStorage:
      'gcloud storage buckets describe gs://fleetscope-sessions-project-ac0c5f88-868b-46b9-a2e --project project-ac0c5f88-868b-46b9-a2e',
    inspectFixture:
      'cargo run -p fleetscope-cli --bin fleetscope -- inspect crates/fleetscope-cli/tests/fixtures/google-cloud-launch-readiness',
    followExample:
      'cargo run -p fleetscope-cli --bin fleetscope -- examples/gemini-session --follow --tiny',
    dryRun:
      'pnpm demo:google-session -- --project example-project --location us-central1 --service fleetscope --bucket fleetscope-sessions-demo',
  },
} as const;

export type CloudConsoleEvidence = typeof CLOUD_CONSOLE_EVIDENCE;
export type CloudConsoleResource = 'overview' | 'run' | 'storage' | 'session';

export function cloudConsoleSlice(resource: CloudConsoleResource) {
  const evidence = CLOUD_CONSOLE_EVIDENCE;
  switch (resource) {
    case 'run':
      return {
        schema: evidence.schema,
        mode: evidence.mode,
        bounds: evidence.bounds,
        project: evidence.project,
        hosted: evidence.hosted,
        probe: evidence.probes.cloudRun,
      };
    case 'storage':
      return {
        schema: evidence.schema,
        mode: evidence.mode,
        bounds: evidence.bounds,
        project: evidence.project,
        probe: evidence.probes.storage,
      };
    case 'session':
      return {
        schema: evidence.schema,
        mode: evidence.mode,
        bounds: evidence.bounds,
        session: evidence.session,
        vertexTake: evidence.vertexTake,
      };
    default:
      return evidence;
  }
}
