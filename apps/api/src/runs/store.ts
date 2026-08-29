import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { MemoryRunStore, type RunStore } from '@fleetscope/run-ledger';

/**
 * A durable, append-only run store backed by a JSONL file.
 *
 * # Why the filesystem and not a database
 *
 * The ledger has to answer one question across a restart: has this Intervention
 * already executed? A JSONL file answers it, needs no service, and matches the
 * append-only shape the Canonical Event spine already uses. Adding a database
 * to prove exactly-once would be a larger risk than the problem.
 *
 * # Why IO lives here and not in the package
 *
 * `@fleetscope/run-ledger` is deliberately IO-free so admission, budget and
 * idempotency stay testable with no filesystem at all. Deciding WHERE runs live
 * belongs to the process that mounts it, which is this one.
 */
export class FileRunStore implements RunStore {
  constructor(private readonly path: string) {
    mkdirSync(dirname(path), { recursive: true });
  }

  append(line: string): void {
    appendFileSync(this.path, `${line}\n`, 'utf8');
  }

  readAll(): readonly string[] {
    try {
      return readFileSync(this.path, 'utf8').split('\n');
    } catch {
      // No file yet is the normal first-run case, not an error.
      return [];
    }
  }
}

/**
 * Choose a store.
 *
 * A process with nowhere durable to write gets an in-memory store and the
 * caller is told so, rather than the ledger silently forgetting across a
 * restart while still claiming exactly-once.
 */
export function createRunStore(path: string | null): {
  readonly store: RunStore;
  readonly durable: boolean;
} {
  if (path === null || path.trim() === '') {
    return { store: new MemoryRunStore(), durable: false };
  }
  try {
    return { store: new FileRunStore(path), durable: true };
  } catch {
    return { store: new MemoryRunStore(), durable: false };
  }
}
