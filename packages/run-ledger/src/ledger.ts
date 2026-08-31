/**
 * An append-only run ledger.
 *
 * # Append-only, and why
 *
 * A run's history is evidence. Overwriting a record would make "this
 * Intervention already executed" unprovable after the fact, which is the one
 * question the ledger exists to answer. Every change appends a new version and
 * the current state is the last one written, which is the same shape the
 * Canonical Event spine already uses.
 *
 * # Storage is injected
 *
 * The store is a port, so the whole ledger is testable with no filesystem and
 * no database. `packages/run-ledger` therefore stays dependency-free and the
 * decision about WHERE runs live belongs to the frontend that mounts it.
 */

import { isActive, type RunRecord } from './record.js';

/** Somewhere durable to append lines to and read them back. */
export interface RunStore {
  append(line: string): void;
  readAll(): readonly string[];
}

/** An in-memory store. Real for tests, and a truthful fallback in a process
 * that has nowhere durable to write: it says so rather than pretending. */
export class MemoryRunStore implements RunStore {
  private readonly lines: string[] = [];

  append(line: string): void {
    this.lines.push(line);
  }

  readAll(): readonly string[] {
    return this.lines;
  }
}

export class RunLedger {
  constructor(private readonly store: RunStore) {}

  /** Every version ever written, oldest first. */
  private versions(): RunRecord[] {
    const records: RunRecord[] = [];
    for (const line of this.store.readAll()) {
      const trimmed = line.trim();
      if (trimmed === '') continue;
      try {
        const parsed = JSON.parse(trimmed) as { record?: unknown };
        // Events share this file (see `event.ts`). They are discriminated by
        // `record: 'event'`; run records carry no such field.
        if (parsed.record === 'event') continue;
        records.push(parsed as RunRecord);
      } catch {
        // A malformed line is skipped rather than throwing: one corrupt append
        // must not make every previous run unreadable.
      }
    }
    return records;
  }

  /** The current state of every run, by its latest written version. */
  all(): RunRecord[] {
    const latest = new Map<string, RunRecord>();
    for (const record of this.versions()) latest.set(record.runId, record);
    return [...latest.values()];
  }

  get(runId: string): RunRecord | null {
    return this.all().find((run) => run.runId === runId) ?? null;
  }

  /** The run occupying the single active slot, if any. */
  active(): RunRecord | null {
    return this.all().find(isActive) ?? null;
  }

  /** Append a new version. The caller owns the transition's correctness. */
  put(record: RunRecord): RunRecord {
    this.store.append(JSON.stringify(record));
    return record;
  }

  /**
   * Whether this idempotency key has already been recorded.
   *
   * Checked BEFORE an external request and persisted before it too, so a
   * redelivery of the same Intervention finds the key already present.
   */
  hasIdempotencyKey(key: string): boolean {
    return this.versions().some((record) => record.idempotencyKey === key);
  }
}
