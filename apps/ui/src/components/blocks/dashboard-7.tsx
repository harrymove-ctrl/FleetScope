'use client';

import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { Plug } from 'lucide-react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type View = 'ready' | 'loading' | 'empty';

const VIEWS: { key: View; label: string }[] = [
  { key: 'ready', label: 'Ready' },
  { key: 'loading', label: 'Loading' },
  { key: 'empty', label: 'Empty' },
];

const Y_MAX = 160;
const Y_TICKS = [160, 120, 80, 40, 0];

const MRR = [109, 112, 118, 121, 127, 131, 136, 140, 144, 148];
const X_LABELS = ['Jun', 'Sep', 'Dec', 'Mar'];

const STATS = [
  {
    label: 'New business',
    value: '$9.1K',
    delta: '+12.4%',
    positive: true,
  },
  {
    label: 'Expansion',
    value: '$3.6K',
    delta: '+4.8%',
    positive: true,
  },
  {
    label: 'Churn',
    value: '$8.5K',
    delta: '+6.1%',
    positive: false,
  },
];

function linePath(values: number[]) {
  const step = 100 / (values.length - 1);
  return values
    .map(
      (v, i) =>
        `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(2)} ${(100 - (v / Y_MAX) * 100).toFixed(2)}`,
    )
    .join(' ');
}

function Bar({ className }: { className: string }) {
  return (
    <span
      className={cx(
        'block rounded-[var(--rb-r-sm,6px)] bg-neutral-200 dark:bg-neutral-800',
        className,
      )}
    />
  );
}

function ViewTabs({
  value,
  onChange,
  baseId,
  panelId,
}: {
  value: View;
  onChange: (next: View) => void;
  baseId: string;
  panelId: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (next: number) => {
    const index = (next + VIEWS.length) % VIEWS.length;
    onChange(VIEWS[index].key);
    refs.current[index]?.focus({ preventScroll: true });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = VIEWS.findIndex((v) => v.key === value);
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      move(current + 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      move(current - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      move(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      move(VIEWS.length - 1);
    }
  };

  return (
    <div
      role="tablist"
      aria-label="View state"
      onKeyDown={onKeyDown}
      className="inline-flex h-8 shrink-0 items-center gap-0.5 rounded-[var(--rb-r-md,8px)] bg-neutral-100 p-0.5 dark:bg-neutral-800"
    >
      {VIEWS.map((v, i) => {
        const selected = v.key === value;
        return (
          <button
            key={v.key}
            ref={(node) => {
              refs.current[i] = node;
            }}
            type="button"
            role="tab"
            id={`${baseId}-${i}`}
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(v.key)}
            className={cx(
              'inline-flex h-7 cursor-pointer items-center rounded-[var(--rb-r-sm,6px)] px-2.5 text-[13px] font-medium transition-[transform,background-color,border-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rb-accent,oklch(20.5%_0_0))] dark:focus-visible:outline-[var(--rb-accent,oklch(100%_0_0))]',
              selected
                ? 'bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100'
                : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100',
            )}
          >
            {v.label}
          </button>
        );
      })}
    </div>
  );
}

export default function Dashboard7() {
  const [view, setView] = useState<View>('ready');
  const baseId = useId();
  const panelId = `${baseId}-panel`;

  return (
    <div className="relative flex h-full min-h-[640px] w-full flex-col overflow-hidden bg-white dark:bg-neutral-950">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 sm:px-6 dark:border-neutral-800">
        <h1 className="truncate text-xl font-medium tracking-[-0.015em] text-neutral-900 dark:text-neutral-100">
          Recurring revenue
        </h1>
        <ViewTabs value={view} onChange={setView} baseId={baseId} panelId={panelId} />
      </header>

      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={`${baseId}-${VIEWS.findIndex((v) => v.key === view)}`}
        tabIndex={0}
        className="flex min-h-0 flex-1 flex-col outline-none"
      >
        {view === 'empty' && (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-[var(--rb-r-lg,10px)] border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
              <Plug className="h-5 w-5 text-neutral-500" aria-hidden />
            </div>
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              No revenue data yet
            </p>
            <p className="mt-1 max-w-xs text-xs text-neutral-600 dark:text-neutral-400">
              Connect your billing provider to track recurring revenue, expansion, and churn in one
              place.
            </p>
            <button
              type="button"
              className="mt-4 inline-flex h-9 cursor-pointer items-center gap-2 rounded-[var(--rb-r-md,8px)] bg-[var(--rb-accent,oklch(20.5%_0_0))] px-3 text-sm font-medium text-[var(--rb-accent-fg,oklch(100%_0_0))] transition-[transform,background-color,border-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-[color-mix(in_oklab,var(--rb-accent,oklch(20.5%_0_0))_90%,transparent)] active:scale-[0.97] focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rb-accent,oklch(20.5%_0_0))] dark:bg-[var(--rb-accent,oklch(100%_0_0))] dark:text-[var(--rb-accent-fg,oklch(20.5%_0_0))] dark:hover:bg-[color-mix(in_oklab,var(--rb-accent,oklch(100%_0_0))_90%,transparent)] dark:focus-visible:outline-[var(--rb-accent,oklch(100%_0_0))]"
            >
              Connect billing
            </button>
          </div>
        )}

        {view === 'loading' && (
          <div
            aria-hidden
            className="flex min-h-0 flex-1 animate-pulse flex-col gap-4 p-4 motion-reduce:animate-none sm:p-6"
          >
            <div className="flex min-h-0 flex-1 flex-col rounded-[var(--rb-r-2xl,14px)] border border-neutral-200/70 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <Bar className="h-3 w-40" />
              <Bar className="mt-2.5 h-8 w-48" />
              <div className="mt-4 min-h-0 flex-1 rounded-[var(--rb-r-lg,10px)] bg-neutral-100 dark:bg-neutral-800" />
              <div className="mt-2 flex justify-between">
                <Bar className="h-3 w-8" />
                <Bar className="h-3 w-8" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1 rounded-[var(--rb-r-2xl,14px)] border border-neutral-200/70 bg-neutral-50 p-1 dark:border-neutral-800 dark:bg-neutral-950">
              {STATS.map((s) => (
                <div
                  key={s.label}
                  className="rounded-[var(--rb-r-lg,10px)] border border-neutral-200/70 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
                >
                  <Bar className="h-3 w-20" />
                  <Bar className="mt-3.5 h-6 w-16" />
                  <Bar className="mt-3 h-3 w-12" />
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'ready' && (
          <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6">
            <div className="flex min-h-0 flex-1 flex-col rounded-[var(--rb-r-2xl,14px)] border border-neutral-200/70 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <div>
                <p className="text-[13px] text-neutral-600 dark:text-neutral-400">
                  Monthly recurring revenue
                </p>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <p className="text-3xl font-medium tabular-nums tracking-[-0.02em] text-neutral-900 dark:text-neutral-100">
                    $148.2K
                  </p>
                  <p className="text-[13px] tabular-nums text-neutral-500">
                    <span className="text-emerald-600 dark:text-emerald-400">+$4.2K</span> (+2.9%)
                    vs. last month
                  </p>
                </div>
              </div>

              <div className="mt-4 flex min-h-0 flex-1 gap-3">
                <div className="-my-2 flex w-10 shrink-0 flex-col justify-between text-right text-[11px] leading-4 tabular-nums text-neutral-500">
                  {Y_TICKS.map((t) => (
                    <span key={t}>{t === 0 ? '$0' : `$${t}k`}</span>
                  ))}
                </div>
                <div className="relative min-h-0 flex-1">
                  <svg
                    aria-hidden
                    preserveAspectRatio="none"
                    viewBox="0 0 100 100"
                    className="absolute inset-0 h-full w-full"
                  >
                    {Y_TICKS.map((t) => {
                      const y = 100 - (t / Y_MAX) * 100;
                      return (
                        <line
                          key={t}
                          x1="0"
                          x2="100"
                          y1={y}
                          y2={y}
                          vectorEffect="non-scaling-stroke"
                          className="stroke-neutral-200/60 dark:stroke-neutral-800/60"
                          strokeWidth={1}
                        />
                      );
                    })}
                    <path
                      d={`${linePath(MRR)} L100 100 L0 100 Z`}
                      className="fill-neutral-900/5 dark:fill-neutral-100/5"
                    />
                    <path
                      d={linePath(MRR)}
                      fill="none"
                      vectorEffect="non-scaling-stroke"
                      className="stroke-neutral-900 dark:stroke-neutral-100"
                      strokeWidth={1.75}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>

              <div className="mt-2 flex gap-3">
                <div className="w-10 shrink-0" aria-hidden />
                <div className="flex min-w-0 flex-1 justify-between text-[11px] tabular-nums text-neutral-500">
                  {X_LABELS.map((l) => (
                    <span key={l}>{l}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1 rounded-[var(--rb-r-2xl,14px)] border border-neutral-200/70 bg-neutral-50 p-1 dark:border-neutral-800 dark:bg-neutral-950">
              {STATS.map((s) => (
                <div
                  key={s.label}
                  className="rounded-[var(--rb-r-lg,10px)] border border-neutral-200/70 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
                >
                  <p className="truncate text-[13px] text-neutral-500">{s.label}</p>
                  <p className="mt-2 truncate text-2xl font-medium tabular-nums tracking-[-0.02em] text-neutral-900 dark:text-neutral-100">
                    {s.value}
                  </p>
                  <p className="mt-1.5 truncate text-[13px] tabular-nums">
                    <span
                      className={
                        s.positive
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }
                    >
                      {s.delta}
                    </span>
                    <span className="hidden text-neutral-500 sm:inline"> vs. last month</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
