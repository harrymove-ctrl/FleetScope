import LaunchHitlPanel from '@/components/fleet/LaunchHitlPanel';

interface Props {
  embedded?: boolean;
}

/** Product embed: launch_readiness HITL — not CASE-1042 ERP, not SaaS refunds. */
export default function ApprovalsPage({ embedded = false }: Props) {
  return (
    <div className={embedded ? undefined : 'space-y-4'}>
      {!embedded && (
        <div className="space-y-2 px-1">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-50">
            Approvals lab
          </h1>
          <p className="text-sm text-neutral-400">
            Product surface is Astro <code className="rounded bg-neutral-900 px-1.5">/approvals</code>.
          </p>
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-neutral-800">
        <LaunchHitlPanel />
      </div>
    </div>
  );
}
