import { LAUNCH_GATES } from '@/content/launch-hitl';
import { READINESS_TABS, READINESS_COMMANDS } from '@/content/readiness';

export default function FeaturesPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-50">
          FleetScope ↔ React Bits map
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-neutral-400">
          Registry demo copy (Net revenue, Acme refunds) is not product. Embeds use FleetScope
          content packs under <code className="rounded bg-neutral-900 px-1.5">src/content/</code>.
        </p>
      </div>

      <section className="rounded-2xl border border-neutral-800 p-5">
        <h2 className="text-sm font-medium text-neutral-200">Dashboard → readiness</h2>
        <ul className="mt-3 space-y-1 text-sm text-neutral-400">
          {READINESS_TABS.map((t) => (
            <li key={t.key}>
              Tab <strong className="text-neutral-200">{t.label}</strong> —{' '}
              {t.key === 'empty'
                ? 'first-run / choose session'
                : t.key === 'checking'
                  ? 'runtime probe in flight'
                  : 'rehearsal ready · open Viewer/Demo'}
            </li>
          ))}
          <li>Commands — {READINESS_COMMANDS.length} product paths (Viewer, Demo, Approvals, …)</li>
          <li className="text-rose-300/90">Dropped: dashboard-1 Net revenue / churn</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-neutral-800 p-5">
        <h2 className="text-sm font-medium text-neutral-200">Approvals → launch_readiness HITL</h2>
        <ul className="mt-3 space-y-2 text-sm text-neutral-400">
          {LAUNCH_GATES.map((g) => (
            <li key={g.id}>
              <strong className="text-neutral-200">{g.id}</strong> ({g.agent}) — {g.title}
            </li>
          ))}
          <li className="text-rose-300/90">
            Dropped: Delete 12 projects / Refunded Acme / API token audit
          </li>
        </ul>
      </section>
    </div>
  );
}
