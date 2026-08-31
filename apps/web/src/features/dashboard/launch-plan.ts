/**
 * The onboarding assistant's launch-readiness plan.
 *
 * Honest numbers only: four ADK children, six Vertex calls, a 180s ceiling.
 * No invented dollar cost. FleetScope does not run Vertex from this page.
 */

export const LAUNCH_PLAN_TITLE = 'Launch-readiness on Google Cloud';

export const LAUNCH_PLAN_GOAL =
  'Inspect the Cloud Run service and session bucket, verify the six-call budget, then issue READY or NOT_READY. Watch it in Agent Viewer. gcloud stays in your terminal.';

export const LAUNCH_PLAN_TOOLS = [
  'gcloud CLI',
  'Vertex Gemini 3.7',
  'Cloud Run Admin API',
  'Cloud Storage API',
  'FleetScope viewer',
] as const;

export const GCP_PROJECT = 'project-ac0c5f88-868b-46b9-a2e';
export const GCP_REGION = 'us-central1';
export const GCP_RUN_SERVICE = 'fleetscope-web';
export const GCP_BUCKET = 'fleetscope-sessions-project-ac0c5f88-868b-46b9-a2e';
export const GCP_RUN_URL = 'https://fleetscope-web-6tes2q7oqa-uc.a.run.app';

export const CONSOLE_APP_PATH = '/console';
export const CONSOLE_RUN_URL = `https://console.cloud.google.com/run/detail/${GCP_REGION}/${GCP_RUN_SERVICE}?project=${GCP_PROJECT}`;
export const CONSOLE_STORAGE_URL = `https://console.cloud.google.com/storage/browser/${GCP_BUCKET}?project=${GCP_PROJECT}`;

export const GCLOUD_STORAGE = `gcloud storage buckets describe gs://${GCP_BUCKET} --project ${GCP_PROJECT}`;

export type DemoCheckState = 'approved';

export const LAUNCH_PLAN_PHASES = [
  {
    name: 'Prove Cloud Run with gcloud',
    steps: 1,
    time: '1m',
    state: 'approved' as DemoCheckState,
    evidence: `${GCP_RUN_SERVICE} · ${GCP_REGION} · recorded describe`,
  },
  {
    name: 'Probe Storage metadata',
    steps: 1,
    time: '1m',
    state: 'approved' as DemoCheckState,
    evidence: `gs://${GCP_BUCKET}`,
  },
  {
    name: 'Guard the six-call budget',
    steps: 1,
    time: '3m',
    state: 'approved' as DemoCheckState,
    evidence: '6 Vertex calls · 180s · no seventh call',
  },
  {
    name: 'Review READY / NOT_READY',
    steps: 1,
    time: '1m',
    state: 'approved' as DemoCheckState,
    evidence: 'launch_reviewer on the recorded session',
  },
  {
    name: 'Watch in Agent Viewer',
    steps: 1,
    time: 'live',
    state: 'approved' as DemoCheckState,
    evidence: 'loopback auto-follow · no Open folder',
  },
] as const;

export const DEMO_TALK = [
  {
    say: 'Four Gemini agents inspect Cloud Run and Storage, then decide READY or NOT_READY.',
    show: 'Cloud Console /console · Cloud Run',
  },
  {
    say: 'They run on Vertex. Here is the same project in gcloud.',
    show: 'Copy gcloud describe',
  },
  {
    say: 'FleetScope does not start the agents. It follows the JSONL Antigravity already wrote.',
    show: 'Copy Antigravity + Open Viewer',
  },
  {
    say: 'Budget is itself a task: six calls, 180 seconds, no invented dollar cost.',
    show: 'budget_guard on the graph',
  },
] as const;

export const LAUNCH_PLAN_STEPS = LAUNCH_PLAN_PHASES.reduce((sum, phase) => sum + phase.steps, 0);

export const LAUNCH_PLAN_CALLS = 6;
export const LAUNCH_PLAN_TIMEOUT = '180s';

export const GCLOUD_DESCRIBE =
  'gcloud run services describe fleetscope-web --region us-central1 --project project-ac0c5f88-868b-46b9-a2e';

export const PRODUCER_DRY_RUN = 'pnpm demo:google-session';

export const SUPPORT_AGY_COMMAND =
  'cd /Users/harryphan/Documents/dev/FleetScope && cargo run -p fleetscope-cli --bin fleetscope -- .fleetscope/sessions/antigravity-live-cu --follow --tiny';

export const SUPPORT_CLI_COMMAND =
  'cd /Users/harryphan/Documents/dev/FleetScope && cargo run -p fleetscope-cli --bin fleetscope -- examples/gemini-session --follow --tiny';

export const SUPPORT_PRIVACY =
  'The producer writes JSONL on your machine. This tab never uploads a transcript, never holds a Gemini key, and never starts Vertex.';

export const SUPPORT_CLI =
  'Copy Antigravity follows the recorded agy session. Copy example follows the checked-in Gemini JSONL. Both cd into FleetScope first so they work from zoetrope.';

export const SUPPORT_CLI_STEPS = [
  {
    title: 'Copy Antigravity and paste in any terminal',
    detail:
      'Follows .fleetscope/sessions/antigravity-live-cu. Does not spawn new agy workers. cd is included so zoetrope is fine.',
  },
  {
    title: 'Wait for the TUI',
    detail: '--tiny keeps a 138×32 window from failing. Keys: space pause, [ ] step, q quit.',
  },
  {
    title: 'Open Agent Viewer',
    detail:
      'http://127.0.0.1:4321/viewer attaches to .fleetscope/sessions on loopback. Talk the script. Do not Open folder.',
  },
] as const;

export const SUPPORT_FORMATS = [
  { id: '.jsonl', note: 'Gemini and Google ADK transcripts' },
  { id: '.json', note: 'Session recordings' },
  { id: 'folder', note: 'Parent and sub-agent files together' },
] as const;
