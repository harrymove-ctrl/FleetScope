import { useId, useState } from 'react';
import {
  READINESS_COMMANDS,
  READINESS_COPY,
  READINESS_TABS,
  type ReadinessView,
} from '@/content/readiness';
import { cn } from '@/lib/utils';

function CheckList({ view }: { view: ReadinessView }) {
  const copy = READINESS_COPY[view];
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium tracking-tight text-neutral-100">{copy.title}</h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-neutral-400">{copy.message}</p>
      </div>
      {view === 'checking' ? (
        <div className="space-y-3" aria-busy="true" aria-label="Checking runtime">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-neutral-900" />
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {copy.checks.map((check) => (
            <li
              key={check.label}
              className="flex items-start gap-3 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2.5"
            >
              <span
                className={cn(
                  'mt-1 h-2 w-2 shrink-0 rounded-full',
                  check.done ? 'bg-emerald-500' : 'bg-neutral-600',
                )}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-100">{check.label}</p>
                <p className="text-xs text-neutral-500">{check.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-neutral-500">
        Rehearsal panel — Astro onboarding above owns real probes and file pickers.
      </p>
    </div>
  );
}

function CommandList() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium tracking-tight text-neutral-100">Commands</h2>
        <p className="mt-1.5 text-sm text-neutral-400">
          Product paths for this machine. Opens the Astro site (port 4321).
        </p>
      </div>
      <ul className="divide-y divide-neutral-800 rounded-xl border border-neutral-800">
        {READINESS_COMMANDS.map((cmd) => (
          <li key={cmd.id}>
            {cmd.href ? (
              <a
                href={cmd.href}
                target="_parent"
                className="flex items-center gap-3 px-3 py-3 text-sm hover:bg-neutral-900"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-neutral-100">{cmd.title}</span>
                  {cmd.detail && (
                    <span className="block text-xs text-neutral-500">{cmd.detail}</span>
                  )}
                </span>
                <kbd className="rounded bg-neutral-900 px-1.5 py-0.5 font-mono text-[11px] text-neutral-400">
                  {cmd.shortcut}
                </kbd>
              </a>
            ) : (
              <div className="flex items-center gap-3 px-3 py-3 text-sm text-neutral-400">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-neutral-200">{cmd.title}</span>
                  {cmd.detail && (
                    <span className="block text-xs text-neutral-500">{cmd.detail}</span>
                  )}
                </span>
                <kbd className="rounded bg-neutral-900 px-1.5 py-0.5 font-mono text-[11px] text-neutral-400">
                  {cmd.shortcut}
                </kbd>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

type Tab = ReadinessView | 'commands';

export default function ReadinessPanel() {
  const [tab, setTab] = useState<Tab>('empty');
  const baseId = useId();

  const tabs: { key: Tab; label: string }[] = [
    ...READINESS_TABS,
    { key: 'commands', label: 'Commands' },
  ];

  return (
    <div className="flex min-h-[520px] flex-col bg-neutral-950">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 px-4 py-3 sm:px-5">
        <div>
          <h1 className="text-base font-medium text-neutral-100">Session readiness</h1>
          <p className="text-xs text-neutral-500">Onboarding only · no invented metrics</p>
        </div>
        <div
          role="tablist"
          aria-label="Readiness view"
          className="inline-flex flex-wrap gap-0.5 rounded-lg bg-neutral-900 p-0.5"
        >
          {tabs.map((t) => {
            const selected = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                id={`${baseId}-${t.key}`}
                aria-selected={selected}
                onClick={() => setTab(t.key)}
                className={cn(
                  'rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors',
                  selected
                    ? 'bg-neutral-800 text-neutral-50'
                    : 'text-neutral-400 hover:text-neutral-100',
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </header>
      <div className="flex-1 px-4 py-5 sm:px-5">
        {tab === 'commands' ? <CommandList /> : <CheckList view={tab} />}
      </div>
    </div>
  );
}
