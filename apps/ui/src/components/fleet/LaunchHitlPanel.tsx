import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  HONESTY_NOTE,
  LAUNCH_AUDIT,
  LAUNCH_GATES,
  type LaunchAuditOutcome,
  type LaunchGateId,
} from '@/content/launch-hitl';
import { cn } from '@/lib/utils';

type Mode = 'gates' | 'audit';
type Decision = 'pending' | 'approved' | 'rejected';

const OUTCOME_WORD: Record<LaunchAuditOutcome, string> = {
  approved: 'Approved',
  denied: 'Skipped',
  expired: 'Expired',
};

function GateCard({ gateId }: { gateId: LaunchGateId }) {
  const gate = LAUNCH_GATES.find((g) => g.id === gateId)!;
  const [decision, setDecision] = useState<Decision>('pending');
  const [showRequest, setShowRequest] = useState(false);

  return (
    <div className="space-y-4">
      <p className="text-center text-xs text-neutral-500">launch_readiness · rehearsal</p>

      <p className="text-sm leading-relaxed text-neutral-200">
        Agents already finished their probes. FleetScope is asking you to decide one bound gate —
        not a standing permission to keep going.
      </p>

      <div className="rounded-md border border-neutral-800 bg-neutral-900">
        <div className="flex h-8 items-center gap-2 px-3">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-600" />
          <span className="font-mono text-xs text-neutral-100">{gate.agent}</span>
          <span className="ml-auto text-xs text-neutral-500">waiting</span>
        </div>
      </div>

      {decision === 'pending' ? (
        <section
          aria-labelledby={`gate-${gate.id}-title`}
          className="space-y-1 rounded-2xl border border-neutral-800 bg-neutral-900 p-1"
        >
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-3 sm:px-4">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              <span className="text-xs font-medium text-neutral-300">Needs approval</span>
              <span className="ml-auto font-mono text-[11px] text-neutral-500">
                {gate.sideEffect}
              </span>
            </div>
            <p
              id={`gate-${gate.id}-title`}
              className="mt-2 text-base font-medium tracking-tight text-neutral-100"
            >
              {gate.title}
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-400">
              {gate.description}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
              {gate.facts.map((f) => (
                <div key={f.label} className="contents">
                  <dt className="text-neutral-500">{f.label}</dt>
                  <dd className="font-mono text-neutral-300">{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-1">
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => setShowRequest((v) => !v)}
                aria-expanded={showRequest}
                className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
              >
                <ChevronRight
                  aria-hidden
                  className={cn('h-3.5 w-3.5 transition-transform', showRequest && 'rotate-90')}
                />
                {showRequest ? 'Hide request' : 'Show request'}
              </button>
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setDecision('rejected')}
                  className="inline-flex h-8 items-center rounded-md bg-neutral-800 px-2.5 text-[13px] font-medium text-neutral-100 hover:bg-neutral-700"
                >
                  {gate.rejectLabel}
                </button>
                <button
                  type="button"
                  onClick={() => setDecision('approved')}
                  className="inline-flex h-8 items-center rounded-md bg-[var(--rb-accent)] px-2.5 text-[13px] font-medium text-[var(--rb-accent-fg)]"
                >
                  {gate.approveLabel}
                </button>
              </div>
            </div>
            {showRequest && (
              <pre className="mt-1 max-h-40 overflow-auto rounded-md bg-neutral-900 px-3 py-2.5 font-mono text-xs leading-relaxed text-neutral-400">
                {gate.requestPreview}
              </pre>
            )}
          </div>
        </section>
      ) : (
        <p className="text-[13px] text-neutral-400">
          {decision === 'approved' ? gate.approvedLine : gate.rejectedLine}
          <span className="ml-2 text-xs text-neutral-600">just now</span>
        </p>
      )}

      <p className="text-xs leading-relaxed text-neutral-500">{HONESTY_NOTE}</p>
    </div>
  );
}

function AuditList() {
  const [filter, setFilter] = useState<'all' | LaunchAuditOutcome>('all');
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    return LAUNCH_AUDIT.filter((e) => {
      if (filter !== 'all' && e.outcome !== filter) return false;
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return `${e.action} ${e.context} ${e.reviewer}`.toLowerCase().includes(q);
    });
  }, [filter, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-medium text-neutral-100">Launch gate history</h2>
          <p className="text-xs text-neutral-500">budget · upload · READY — rehearsal only</p>
        </div>
      </div>

      <label className="block">
        <span className="sr-only">Search history</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search gates…"
          className="h-9 w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 text-sm text-neutral-100 placeholder:text-neutral-600"
        />
      </label>

      <div className="flex flex-wrap gap-1">
        {(['all', 'approved', 'denied', 'expired'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium',
              filter === f
                ? 'bg-neutral-800 text-neutral-50'
                : 'text-neutral-400 hover:text-neutral-100',
            )}
          >
            {f === 'all' ? 'All' : OUTCOME_WORD[f]}
          </button>
        ))}
      </div>

      <ul className="divide-y divide-neutral-800 rounded-xl border border-neutral-800">
        {rows.map((row) => (
          <li key={row.id} className="flex gap-3 px-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-neutral-100">{row.action}</p>
              <p className="text-xs text-neutral-500">
                {row.context} · {row.reviewer}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs font-medium text-neutral-300">{OUTCOME_WORD[row.outcome]}</p>
              <p className="text-[11px] text-neutral-600">{row.time}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-neutral-500">{HONESTY_NOTE}</p>
    </div>
  );
}

export default function LaunchHitlPanel() {
  const [mode, setMode] = useState<Mode>('gates');
  const [gateId, setGateId] = useState<LaunchGateId>('budget');

  return (
    <div className="flex min-h-[520px] flex-col bg-neutral-950">
      <header className="flex flex-wrap items-center gap-2 border-b border-neutral-800 px-4 py-3 sm:px-5">
        <div className="mr-auto">
          <h1 className="text-base font-medium text-neutral-100">Launch readiness HITL</h1>
          <p className="text-xs text-neutral-500">budget_guard · upload · launch_reviewer</p>
        </div>
        <div className="inline-flex rounded-lg bg-neutral-900 p-0.5">
          {(
            [
              ['gates', 'Live gates'],
              ['audit', 'History'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={cn(
                'rounded-md px-2.5 py-1.5 text-[13px] font-medium',
                mode === id
                  ? 'bg-neutral-800 text-neutral-50'
                  : 'text-neutral-400 hover:text-neutral-100',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {mode === 'gates' && (
        <div className="flex flex-wrap gap-1 border-b border-neutral-800 px-4 py-2 sm:px-5">
          {LAUNCH_GATES.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setGateId(g.id)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium',
                gateId === g.id
                  ? 'bg-neutral-800 text-neutral-50'
                  : 'text-neutral-400 hover:text-neutral-100',
              )}
            >
              {g.id === 'budget' ? 'Budget' : g.id === 'upload' ? 'Upload' : 'READY'}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 px-4 py-5 sm:px-5">
        {mode === 'gates' ? <GateCard gateId={gateId} /> : <AuditList />}
      </div>
    </div>
  );
}
