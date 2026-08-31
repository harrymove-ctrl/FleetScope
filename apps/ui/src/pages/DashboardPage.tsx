import ReadinessPanel from '@/components/fleet/ReadinessPanel';

interface Props {
  embedded?: boolean;
}

/** Product embed: session readiness only — no SaaS metrics. */
export default function DashboardPage({ embedded = false }: Props) {
  return (
    <div className={embedded ? undefined : 'space-y-4'}>
      {!embedded && (
        <div className="space-y-2 px-1">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-50">
            Dashboard lab
          </h1>
          <p className="text-sm text-neutral-400">
            Product surface is Astro <code className="rounded bg-neutral-900 px-1.5">/dashboard</code>.
          </p>
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-neutral-800">
        <ReadinessPanel />
      </div>
    </div>
  );
}
