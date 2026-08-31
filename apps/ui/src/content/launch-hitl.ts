/**
 * Launch readiness HITL rehearsal — understandable gates tied to
 * google-cloud-launch-readiness agents. Not CASE-1042 ERP, not SaaS refunds.
 *
 * Honesty: local UI only. No approval write-path in this build.
 */

export type LaunchGateId = 'budget' | 'upload' | 'ready';

export type LaunchGate = {
  id: LaunchGateId;
  agent: string;
  title: string;
  description: string;
  approveLabel: string;
  rejectLabel: string;
  sideEffect: 'none' | 'external_write';
  facts: { label: string; value: string }[];
  requestPreview: string;
  approvedLine: string;
  rejectedLine: string;
};

export const LAUNCH_GATES: LaunchGate[] = [
  {
    id: 'budget',
    agent: 'budget_guard',
    title: 'Allow 2 more Vertex calls for this run only?',
    description:
      'budget_guard hit the demo ceiling (6/6 model calls). Extending by two calls lets launch_reviewer finish. This does not raise a standing quota.',
    approveLabel: 'Allow +2 calls',
    rejectLabel: 'Keep limit',
    sideEffect: 'none',
    facts: [
      { label: 'Agent', value: 'budget_guard' },
      { label: 'Calls', value: '6 / 6 used' },
      { label: 'Ask', value: '+2 Vertex calls' },
      { label: 'Side effect', value: 'none (model spend only)' },
    ],
    requestPreview: `extend_model_budget({
  run: "launch_readiness",
  used: 6,
  limit: 6,
  grant: 2,
  scope: "this_run_only"
})`,
    approvedLine: 'Approved: +2 Vertex calls for this run only',
    rejectedLine: 'Skipped: kept the 6-call ceiling',
  },
  {
    id: 'upload',
    agent: 'post-run',
    title: 'Upload finished session JSONL to the proof bucket?',
    description:
      'The run finished. Uploading the JSONL is an external write used for hackathon proof. Decline to keep the file only on this machine.',
    approveLabel: 'Upload once',
    rejectLabel: 'Keep local',
    sideEffect: 'external_write',
    facts: [
      { label: 'Agent', value: 'post-run upload' },
      { label: 'Object', value: 'gs://…/launch_readiness/<run-id>.jsonl' },
      { label: 'Side effect', value: 'external_write' },
      { label: 'Binding', value: 'once · this run id' },
    ],
    requestPreview: `upload_session_jsonl({
  run: "launch_readiness",
  once: true,
  redaction: "hidden_reasoning_stripped"
})`,
    approvedLine: 'Approved: upload JSONL once to the proof bucket',
    rejectedLine: 'Skipped: session stays on this machine',
  },
  {
    id: 'ready',
    agent: 'launch_reviewer',
    title: 'Confirm the human-visible READY verdict?',
    description:
      'launch_reviewer proposes READY after cloud_run_probe, storage_probe, and budget_guard reports. Confirming only accepts the displayed verdict — it does not mutate Cloud Run.',
    approveLabel: 'Confirm READY',
    rejectLabel: 'Keep NOT_READY',
    sideEffect: 'none',
    facts: [
      { label: 'Agent', value: 'launch_reviewer' },
      { label: 'Proposed', value: 'READY' },
      { label: 'Inputs', value: '3 child reports' },
      { label: 'Side effect', value: 'none (display verdict)' },
    ],
    requestPreview: `confirm_launch_verdict({
  proposed: "READY",
  sources: ["cloud_run_probe", "storage_probe", "budget_guard"]
})`,
    approvedLine: 'Approved: display READY for this recorded run',
    rejectedLine: 'Skipped: leave verdict as NOT_READY',
  },
];

export type LaunchAuditOutcome = 'approved' | 'denied' | 'expired';

export type LaunchAuditEntry = {
  id: string;
  action: string;
  context: string;
  reviewer: string;
  outcome: LaunchAuditOutcome;
  time: string;
};

/** Prior launch-gate decisions — same vocabulary as the live cards. */
export const LAUNCH_AUDIT: LaunchAuditEntry[] = [
  {
    id: 'lg-1007',
    action: 'Allow +2 Vertex calls for this run only',
    context: 'budget_guard · 6/6 · side-effect none',
    reviewer: 'operator',
    outcome: 'approved',
    time: '10:42',
  },
  {
    id: 'lg-1006',
    action: 'Upload finished session JSONL to the proof bucket',
    context: 'post-run · external_write · once',
    reviewer: 'operator',
    outcome: 'denied',
    time: '10:40',
  },
  {
    id: 'lg-1005',
    action: 'Confirm the human-visible READY verdict',
    context: 'launch_reviewer · 3 child reports',
    reviewer: 'operator',
    outcome: 'approved',
    time: '10:38',
  },
  {
    id: 'lg-1004',
    action: 'Allow +2 Vertex calls for this run only',
    context: 'budget_guard · no response in 2 hours',
    reviewer: '—',
    outcome: 'expired',
    time: 'Yesterday',
  },
  {
    id: 'lg-1003',
    action: 'Upload finished session JSONL to the proof bucket',
    context: 'post-run · kept local',
    reviewer: 'operator',
    outcome: 'denied',
    time: 'Yesterday',
  },
  {
    id: 'lg-1002',
    action: 'Confirm the human-visible READY verdict',
    context: 'launch_reviewer · proposed NOT_READY path',
    reviewer: 'operator',
    outcome: 'approved',
    time: 'Mon',
  },
];

export const HONESTY_NOTE =
  'Local rehearsal. This build has no approval write-path. Approve / reject do not authorize a cloud action.';
