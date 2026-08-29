import { randomUUID } from 'node:crypto';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRunStore } from './store.js';
import { productionWorkerLauncher } from './worker.js';
import type { RunRoutesDependencies } from '../routes/runs.js';
import type { FleetScopeConfig } from '../config/index.js';

/**
 * The repository root, found from this file rather than from `process.cwd()`.
 *
 * The API runs with its working directory at `apps/api`, so a worker path
 * relative to the repository root would otherwise resolve to the wrong place
 * depending on how the process was started.
 */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

const atRoot = (path: string): string => (isAbsolute(path) ? path : resolve(REPO_ROOT, path));

/**
 * The run controller's real ports.
 *
 * # Why this is a default rather than an optional injection
 *
 * The route used to mount only when dependencies were passed. Tests passed them
 * and passed; the real server did not, and served 404 on every `/runs` path. An
 * optional parameter that silently REMOVES an endpoint is the defect, not the
 * missing argument, so production wiring is now the default and tests override
 * it. A missing argument can no longer delete a route.
 *
 * Every value comes from the parsed config, so the ledger path, the spend
 * ceilings and the worker command are validated at boot with everything else
 * rather than read straight from the environment at the point of use.
 */
export function productionRunDependencies(config: FleetScopeConfig): RunRoutesDependencies {
  const chosen = createRunStore(config.runs.ledgerPath);

  return {
    store: chosen.store,
    // Not `true`: an unwritable path yields a memory store, and admission must
    // then refuse every run rather than accept one it cannot record.
    durable: chosen.durable,
    totalCallBudget: config.runs.totalCallBudget,
    perRunCallCeiling: config.runs.maxModelCallsPerRun,
    launcher: productionWorkerLauncher({
      ...config,
      worker: {
        ...config.worker,
        python: atRoot(config.worker.python),
        directory: atRoot(config.worker.directory),
        pythonPath: atRoot(config.worker.pythonPath),
      },
    }),
    workerTimeoutMs: config.worker.timeoutMs,
    // `pure` until a live run is explicitly authorised: it executes the whole
    // scenario, spends nothing, and labels its evidence `recorded`.
    workerMode: 'pure',
    runDriver: config.runs.driver,
    now: () => new Date().toISOString(),
    newId: (prefix) => `${prefix}-${randomUUID()}`,
  };
}
