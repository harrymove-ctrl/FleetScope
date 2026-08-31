"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ChevronRight } from "lucide-react";

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

const REQUEST_ARGS = `delete_projects({
  workspace: "storage-cleanup",
  ids: ["prj_9f2a", "prj_7c10", "prj_5b83", … +9],
  purgeBuildCache: true
})`;

type Decision = "pending" | "approved" | "rejected";

const focusRing =
  "focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--rb-accent,oklch(20.5%_0_0))] dark:focus-visible:outline-[var(--rb-accent,oklch(100%_0_0))]";
const press =
  "transition-[transform,background-color,border-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]";

export default function AgentApproval1() {
  const reduceMotion = useReducedMotion();
  const [decision, setDecision] = useState<Decision>("pending");
  const [showRequest, setShowRequest] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const body = useScrollFade<HTMLDivElement>();
  const scrollRef = body.ref;

  useEffect(() => {
    if (!announcement) return;
    const id = setTimeout(() => setAnnouncement(""), 2400);
    return () => clearTimeout(id);
  }, [announcement]);

  useEffect(() => {
    if (decision === "pending") return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [decision, reduceMotion]);

  const enter = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.24, ease: [0.23, 1, 0.32, 1] as const },
      };

  return (
    <div className="flex h-full min-h-[480px] w-full flex-col overflow-hidden bg-white dark:bg-neutral-950">
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={body.onScroll}
          className="h-full overflow-y-auto overscroll-contain [overflow-anchor:none] px-4 py-6 sm:px-6"
        >
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            <p className="text-center text-xs text-neutral-500 dark:text-neutral-500">
              Today
            </p>

            <div className="flex justify-end">
              <p className="max-w-[85%] rounded-[var(--rb-r-2xl,14px)] bg-neutral-100 px-3.5 py-2.5 text-sm text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100">
                Clean up the archived projects: we&rsquo;re over the storage
                quota again.
              </p>
            </div>

            <p className="text-sm leading-relaxed text-neutral-900 dark:text-neutral-100">
              Twelve archived projects haven&rsquo;t been opened in over a year.
              Removing them and their build history frees about 4.2 GB. Because
              this is permanent, I need you to confirm before I run it.
            </p>

            <div className="rounded-[var(--rb-r-md,8px)] border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex h-8 items-center gap-2 px-3">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                <span className="font-mono text-xs text-neutral-900 dark:text-neutral-100">
                  list_projects
                </span>
                <span className="ml-auto text-xs tabular-nums text-neutral-500 dark:text-neutral-500">
                  0.8s
                </span>
              </div>
            </div>

            {decision === "pending" ? (
              <motion.section
                {...enter}
                aria-labelledby="aa1-title"
                className="space-y-1 rounded-[var(--rb-r-2xl,14px)] border border-neutral-200/70 bg-neutral-50 p-1 dark:border-neutral-800 dark:bg-neutral-900"
              >
                <div className="rounded-[var(--rb-r-lg,10px)] border border-neutral-200/70 bg-white px-3 py-3 dark:border-neutral-800 dark:bg-neutral-950 sm:px-4">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Needs approval
                    </span>
                  </div>
                  <p
                    id="aa1-title"
                    className="mt-2 text-base font-medium tracking-[-0.01em] text-neutral-900 dark:text-neutral-100"
                  >
                    Delete 12 archived projects and their build history
                  </p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-600 dark:text-neutral-400">
                    Frees 4.2 GB in the storage-cleanup workspace. Active
                    projects are untouched and this can&rsquo;t be undone.
                  </p>
                </div>

                <div className="rounded-[var(--rb-r-lg,10px)] border border-neutral-200/70 bg-white p-1 dark:border-neutral-800 dark:bg-neutral-950">
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowRequest((v) => !v)}
                      aria-expanded={showRequest}
                      className={cx(
                        "inline-flex h-8 cursor-pointer items-center gap-1 rounded-[var(--rb-r-sm,6px)] px-2 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-100",
                        press,
                        focusRing,
                      )}
                    >
                      <ChevronRight
                        aria-hidden="true"
                        className={cx(
                          "h-3.5 w-3.5 shrink-0 transition-transform duration-150 ease-out",
                          showRequest && "rotate-90",
                        )}
                      />
                      {showRequest ? "Hide request" : "Show request"}
                    </button>
                    <div className="ml-auto flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setDecision("rejected");
                          setAnnouncement("Skipped, not approved.");
                        }}
                        className={cx(
                          "inline-flex h-8 cursor-pointer items-center justify-center rounded-[var(--rb-r-sm,6px)] bg-neutral-100 px-2.5 text-[13px] font-medium text-neutral-900 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700",
                          press,
                          focusRing,
                        )}
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDecision("approved");
                          setAnnouncement(
                            "Approved. Deleted 12 projects and freed 4.2 GB.",
                          );
                        }}
                        className={cx(
                          "inline-flex h-8 cursor-pointer items-center justify-center rounded-[var(--rb-r-sm,6px)] bg-[var(--rb-accent,oklch(20.5%_0_0))] px-2.5 text-[13px] font-medium text-[var(--rb-accent-fg,oklch(100%_0_0))] hover:bg-[color-mix(in_oklab,var(--rb-accent,oklch(20.5%_0_0))_90%,transparent)] dark:bg-[var(--rb-accent,oklch(100%_0_0))] dark:text-[var(--rb-accent-fg,oklch(20.5%_0_0))] dark:hover:bg-[color-mix(in_oklab,var(--rb-accent,oklch(100%_0_0))_90%,transparent)]",
                          press,
                          focusRing,
                        )}
                      >
                        Delete 12 projects
                      </button>
                    </div>
                  </div>
                  {showRequest && (
                    <pre
                      tabIndex={0}
                      className={cx(
                        "mt-1 max-h-40 overflow-auto rounded-[var(--rb-r-sm,6px)] bg-neutral-50 px-3 py-2.5 font-mono text-xs leading-relaxed text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400",
                        focusRing,
                      )}
                    >
                      {REQUEST_ARGS}
                    </pre>
                  )}
                </div>
              </motion.section>
            ) : (
              <motion.div {...enter} className="flex items-center gap-2 py-0.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                <p className="min-w-0 flex-1 truncate text-[13px] text-neutral-600 dark:text-neutral-400">
                  {decision === "approved"
                    ? "Approved: deleted 12 projects, freed 4.2 GB"
                    : "Skipped, not approved"}
                </p>
                <span className="shrink-0 text-xs tabular-nums text-neutral-500 dark:text-neutral-500">
                  just now
                </span>
              </motion.div>
            )}

            {decision === "approved" && (
              <motion.p
                {...enter}
                className="text-sm leading-relaxed text-neutral-900 dark:text-neutral-100"
              >
                Done: your archive is cleaned up. I&rsquo;ll flag projects for
                review the next time you pass 90% of the quota.
              </motion.p>
            )}
          </div>
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

      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}
