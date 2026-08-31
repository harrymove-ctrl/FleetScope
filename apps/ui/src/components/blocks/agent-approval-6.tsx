"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Search } from "lucide-react";

const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

function useScrollFade<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    setEdges({
      start: scrollTop > 1,
      end: Math.ceil(scrollTop + clientHeight) < scrollHeight - 1,
    });
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    const view = el?.ownerDocument.defaultView;
    if (!el || !view?.ResizeObserver) return;
    const observer = new view.ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [update]);

  return { ref, edges, onScroll: update };
}

type Outcome = "approved" | "denied" | "expired";

type Entry = {
  id: string;
  action: string;
  context: string;
  reviewer: string;
  outcome: Outcome;
  time: string;
};

const LOG: Entry[] = [
  {
    id: "ap-1051",
    action: "Refunded 3 duplicate charges to Acme Logistics",
    context: "$1,240.00 · West billing",
    reviewer: "Maya Chen",
    outcome: "approved",
    time: "10:42",
  },
  {
    id: "ap-1050",
    action: "Added a private note to ticket #4821",
    context: "Internal notes policy",
    reviewer: "Auto policy",
    outcome: "approved",
    time: "9:41",
  },
  {
    id: "ap-1049",
    action: "Rotated the production API token",
    context: "Payments service",
    reviewer: "Sam Rivera",
    outcome: "denied",
    time: "9:18",
  },
  {
    id: "ap-1048",
    action: "Granted read access to analytics for 30 minutes",
    context: "Meridian service account",
    reviewer: "Owen Patel",
    outcome: "approved",
    time: "9:12",
  },
  {
    id: "ap-1047",
    action: "Merged the staging config branch",
    context: "No response in 2 hours",
    reviewer: "-",
    outcome: "expired",
    time: "Yesterday",
  },
  {
    id: "ap-1046",
    action: "Changed the invoice retention window to 45 days",
    context: "billing-retention-policy.ts",
    reviewer: "Leah Stone",
    outcome: "denied",
    time: "Yesterday",
  },
  {
    id: "ap-1045",
    action: "Reset QA seed data before the nightly replay",
    context: "qa_orders, qa_refunds · QA only",
    reviewer: "Auto policy",
    outcome: "approved",
    time: "Yesterday",
  },
  {
    id: "ap-1044",
    action: "Archived 312 paused campaigns older than 18 months",
    context: "EU and NA marketing",
    reviewer: "Nina Brooks",
    outcome: "denied",
    time: "Mon",
  },
];

const FILTERS = ["all", "approved", "denied", "expired"] as const;
type Filter = (typeof FILTERS)[number];

const OUTCOME_WORD: Record<Outcome, string> = {
  approved: "Approved",
  denied: "Skipped",
  expired: "Expired",
};

const focusRing =
  "focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--rb-accent,oklch(20.5%_0_0))] dark:focus-visible:outline-[var(--rb-accent,oklch(100%_0_0))]";
const press =
  "transition-[transform,background-color,border-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]";

export default function AgentApproval6() {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const body = useScrollFade<HTMLDivElement>();

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return LOG.filter((e) => {
      const byFilter = filter === "all" || e.outcome === filter;
      const byQuery =
        q === "" ||
        `${e.action} ${e.context} ${e.reviewer}`.toLowerCase().includes(q);
      return byFilter && byQuery;
    });
  }, [filter, query]);

  return (
    <div className="flex h-full min-h-[640px] w-full flex-col overflow-hidden bg-white dark:bg-neutral-950">
      <header className="flex h-14 shrink-0 items-center gap-2 px-4 sm:px-6">
        <h2 className="text-base font-medium tracking-[-0.01em] text-neutral-900 dark:text-neutral-100">
          Approval history
        </h2>
        <button
          type="button"
          className={cx(
            "ml-auto inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-[var(--rb-r-md,8px)] border border-neutral-200 bg-white px-2.5 text-[13px] font-medium text-neutral-900 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-900",
            press,
            focusRing,
          )}
        >
          <Download aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          Export
        </button>
      </header>

      <div className="flex shrink-0 flex-col gap-2 px-4 pb-2 sm:h-12 sm:flex-row sm:items-center sm:px-6 sm:pb-0">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500 dark:text-neutral-500"
          />
          <label htmlFor="aa6-search" className="sr-only">
            Search history
          </label>
          <input
            id="aa6-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search decisions"
            className={cx(
              "h-8 w-full rounded-[var(--rb-r-md,8px)] border border-neutral-200 bg-white pl-8 pr-3 text-[13px] text-neutral-900 placeholder:text-neutral-400 hover:border-neutral-300 focus:border-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:hover:border-neutral-700 dark:focus:border-white",
              "transition-colors duration-150 ease-out",
              "focus-visible:outline-none",
            )}
          />
        </div>
        <div className="flex items-center gap-0.5 rounded-[var(--rb-r-md,8px)] bg-neutral-100 p-0.5 dark:bg-neutral-800/50 sm:ml-auto">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={cx(
                "inline-flex h-7 flex-1 cursor-pointer items-center justify-center rounded-[var(--rb-r-sm,6px)] px-2.5 text-[13px] font-medium capitalize sm:flex-none",
                press,
                focusRing,
                filter === f
                  ? "bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
                  : "bg-transparent text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100",
              )}
            >
              {f === "denied" ? "skipped" : f}
            </button>
          ))}
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={body.ref}
          onScroll={body.onScroll}
          className="h-full overflow-y-auto overscroll-contain"
        >
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                No decisions match
              </p>
              <p className="mt-1 max-w-xs text-xs text-neutral-600 dark:text-neutral-400">
                Clear the search or switch the filter to see the full history.
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
                className={cx(
                  "mt-4 inline-flex h-9 cursor-pointer items-center justify-center rounded-[var(--rb-r-md,8px)] bg-[var(--rb-accent,oklch(20.5%_0_0))] px-3 text-sm font-medium text-[var(--rb-accent-fg,oklch(100%_0_0))] hover:bg-[color-mix(in_oklab,var(--rb-accent,oklch(20.5%_0_0))_90%,transparent)] dark:bg-[var(--rb-accent,oklch(100%_0_0))] dark:text-[var(--rb-accent-fg,oklch(20.5%_0_0))] dark:hover:bg-[color-mix(in_oklab,var(--rb-accent,oklch(100%_0_0))_90%,transparent)]",
                  press,
                  focusRing,
                )}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <ul className="mx-4 my-2 flex flex-col gap-1.5 sm:mx-6">
              {rows.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center gap-3 rounded-[var(--rb-r-lg,10px)] bg-neutral-50 px-3 py-2.5 dark:bg-neutral-900"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-neutral-900 dark:text-neutral-100">
                      {e.action}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-500">
                      {e.context} · {e.reviewer}
                    </p>
                  </div>
                  <span className="w-24 shrink-0 whitespace-nowrap text-right text-[13px] text-neutral-600 dark:text-neutral-400 sm:w-28">
                    {OUTCOME_WORD[e.outcome]}
                  </span>
                  <span className="hidden w-16 shrink-0 text-right text-xs tabular-nums text-neutral-500 sm:block dark:text-neutral-500">
                    {e.time}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          aria-hidden="true"
          className={cx(
            "pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-white to-transparent transition-opacity duration-200 ease-out dark:from-neutral-950",
            body.edges.start ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          aria-hidden="true"
          className={cx(
            "pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent transition-opacity duration-200 ease-out dark:from-neutral-950",
            body.edges.end ? "opacity-100" : "opacity-0",
          )}
        />
      </div>
    </div>
  );
}
