import { err, ok, type Result } from './result.js';

/**
 * Central environment parsing.
 *
 * Nothing outside this file and `apps/api/src/config` may read `process.env`
 * (enforced by the `no-restricted-globals` ESLint rule). Config is parsed once,
 * validated, and passed as a value.
 */
export type EnvSource = Readonly<Record<string, string | undefined>>;

export interface FleetScopeConfig {
  readonly appEnv: 'development' | 'test' | 'production';
  /**
   * The safe default is FALSE. When false, no Gemini or platform call may occur
   * anywhere in the system (Invariant 8 / budget-demo credit guardrails).
   */
  readonly liveMode: boolean;
  readonly defaultCaseId: string;
  /**
   * Browser origins allowed to call this API cross-origin.
   *
   * Empty by DEFAULT and therefore fail-closed: with no entry the service sends
   * no CORS header at all, which is correct for a same-origin deployment and
   * correct for a deployment that has not thought about it. The browser live
   * proof needs one entry when the static site is served from a different
   * origin than the API — a local `astro preview` on :4331 calling :8080, say.
   */
  readonly webOrigins: readonly string[];
  readonly port: number;
  readonly logLevel: 'silent' | 'info';
  readonly gcp: { readonly projectId: string | null; readonly region: string | null };
  readonly gemini: {
    readonly model: string | null;
    /**
     * The model API credential. Never logged, never echoed, and never included
     * in the `/capability` description — a deployment says whether live mode is
     * ON, never what it is holding.
     */
    readonly apiKey: string | null;
    readonly maxInputTokens: number;
    readonly maxOutputTokens: number;
    readonly maxCallsPerCase: number;
    readonly temperature: number;
    readonly timeoutMs: number;
  };
  readonly runs: {
    /**
     * Where the append-only run ledger is written.
     *
     * A run is only admitted when this path is durable, so the location is
     * configuration rather than a constant buried in the controller.
     */
    readonly ledgerPath: string;
    /**
     * The ceiling on model calls this deployment may spend across ALL runs,
     * distinct from the per-run cap. It exists so a restart loop cannot spend
     * the budget one admissible run at a time.
     */
    readonly totalCallBudget: number;
    /**
     * The most model calls ONE run may reserve.
     *
     * Deliberately separate from `gemini.maxCallsPerCase`. That key bounds the
     * existing single-decision `/live/decision` path, which spends two calls
     * per case; a scenario run drives a root agent and a delegated sub-agent
     * and reserves six. They are different subsystems with different budgets,
     * and the earlier ambiguity between them was the defect: reusing the
     * decision key would either starve the run at call three or triple the
     * decision path's ceiling. A scenario declaring more than this is refused
     * at admission rather than discovered mid-run.
     */
    readonly maxModelCallsPerRun: number;
    /**
     * How the API's own worker executes an admitted run.
     *
     * `pure` is the safe default and never imports or invokes Google ADK.
     * `adk` is an explicit, metered Vertex/Google ADK path and is refused at
     * boot unless every live prerequisite is present.
     */
    readonly workerMode: 'pure' | 'adk';
    /**
     * Who executes an admitted run.
     *
     * `worker` spawns FleetScope's own Python process. `mcp` waits for the
     * developer's own Gemini/Antigravity CLI agent to call the FleetScope MCP
     * tool, which is how a live run happens when FleetScope holds no model
     * credential of its own: the model runs on the developer's CLI quota and
     * FleetScope still owns the fault, the policy, the retry and the evidence.
     */
    readonly driver: 'worker' | 'mcp';
  };
  readonly worker: {
    /**
     * How to start the Python worker. Paths are relative to the repository
     * root and are resolved by the process that mounts the run controller,
     * because the API's own working directory is `apps/api`.
     */
    readonly python: string;
    readonly directory: string;
    readonly pythonPath: string;
    /**
     * Wall-clock ceiling for one worker process. A worker that outlives this
     * is killed and its run recorded as `timed_out`: an unbounded child would
     * hold the single active slot forever.
     */
    readonly timeoutMs: number;
    /**
     * Answer the allowlisted read from a recorded fixture instead of the
     * network. Only meaningful in `pure` mode, whose evidence is already
     * labelled `recorded`, so it cannot make a live claim cheaper.
     */
    readonly offline: boolean;
    /** Explicit spend authorization for the API-owned ADK worker. */
    readonly allowModelCalls: boolean;
    /** Whether the ADK worker should use Vertex AI with ambient ADC. */
    readonly useVertexAi: boolean;
    /** Where the worker records tool attempts, for idempotency across a restart. */
    readonly attemptLedger: string;
  };
}

const APP_ENVS = ['development', 'test', 'production'] as const;

/**
 * `LIVE_MODE` fails closed: only the exact string "true" enables it. A typo,
 * an empty value, or an unset variable all mean recorded-only.
 */
function parseLiveMode(raw: string | undefined): boolean {
  return raw === 'true';
}

function parseInt_(
  raw: string | undefined,
  fallback: number,
  name: string,
  problems: string[],
): number {
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    problems.push(`${name} must be a non-negative integer, got ${JSON.stringify(raw)}`);
    return fallback;
  }
  return n;
}

function parseFloat_(
  raw: string | undefined,
  fallback: number,
  name: string,
  problems: string[],
): number {
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    problems.push(`${name} must be a number, got ${JSON.stringify(raw)}`);
    return fallback;
  }
  return n;
}

const nullable = (raw: string | undefined): string | null =>
  raw === undefined || raw === '' ? null : raw;

const firstNonEmpty = (...values: readonly (string | undefined)[]): string | undefined =>
  values.find((value) => value !== undefined && value !== '') ?? undefined;

const parseWorkerMode = (raw: string | undefined, problems: string[]): 'pure' | 'adk' => {
  const value = raw ?? 'pure';
  if (value !== 'pure' && value !== 'adk') {
    problems.push(
      `FLEETSCOPE_RUN_WORKER_MODE must be one of pure | adk, got ${JSON.stringify(value)}`,
    );
    return 'pure';
  }
  return value;
};

const isGemini35OrNewer = (model: string): boolean => {
  const match = /^gemini-(\d+)\.(\d+)-[a-z0-9][a-z0-9.-]*$/.exec(model);
  return (
    match !== null && (Number(match[1]) > 3 || (Number(match[1]) === 3 && Number(match[2]) >= 5))
  );
};

export function parseConfig(source: EnvSource): Result<FleetScopeConfig, string[]> {
  const problems: string[] = [];

  const rawAppEnv = source['APP_ENV'] ?? 'development';
  if (!(APP_ENVS as readonly string[]).includes(rawAppEnv)) {
    problems.push(
      `APP_ENV must be one of ${APP_ENVS.join(' | ')}, got ${JSON.stringify(rawAppEnv)}`,
    );
  }

  const liveMode = parseLiveMode(source['LIVE_MODE']);

  const config: FleetScopeConfig = {
    appEnv: (APP_ENVS as readonly string[]).includes(rawAppEnv)
      ? (rawAppEnv as FleetScopeConfig['appEnv'])
      : 'development',
    liveMode,
    defaultCaseId: source['PUBLIC_DEFAULT_CASE_ID'] ?? 'CASE-1042',
    webOrigins: (source['WEB_ORIGINS'] ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin !== ''),
    port: parseInt_(source['PORT'], 8080, 'PORT', problems),
    logLevel: source['API_LOG_LEVEL'] === 'silent' ? 'silent' : 'info',
    gcp: {
      // Google client libraries use GOOGLE_CLOUD_*; retain the GCP_* aliases
      // for the existing bounded API path and local tests.
      projectId: nullable(firstNonEmpty(source['GOOGLE_CLOUD_PROJECT'], source['GCP_PROJECT_ID'])),
      region: nullable(firstNonEmpty(source['GOOGLE_CLOUD_LOCATION'], source['GCP_REGION'])),
    },
    gemini: {
      model: nullable(firstNonEmpty(source['FLEETSCOPE_ADK_MODEL'], source['GEMINI_MODEL'])),
      apiKey: nullable(source['GEMINI_API_KEY']),
      maxInputTokens: parseInt_(
        source['GEMINI_MAX_INPUT_TOKENS'],
        2000,
        'GEMINI_MAX_INPUT_TOKENS',
        problems,
      ),
      maxOutputTokens: parseInt_(
        source['GEMINI_MAX_OUTPUT_TOKENS'],
        300,
        'GEMINI_MAX_OUTPUT_TOKENS',
        problems,
      ),
      maxCallsPerCase: parseInt_(
        source['GEMINI_MAX_CALLS_PER_CASE'],
        2,
        'GEMINI_MAX_CALLS_PER_CASE',
        problems,
      ),
      temperature: parseFloat_(source['GEMINI_TEMPERATURE'], 0, 'GEMINI_TEMPERATURE', problems),
      timeoutMs: parseInt_(source['GEMINI_TIMEOUT_MS'], 15_000, 'GEMINI_TIMEOUT_MS', problems),
    },
    runs: {
      ledgerPath: source['FLEETSCOPE_RUN_LEDGER']?.trim() || '.fleetscope/runs.jsonl',
      totalCallBudget: parseInt_(
        source['FLEETSCOPE_TOTAL_CALL_BUDGET'],
        60,
        'FLEETSCOPE_TOTAL_CALL_BUDGET',
        problems,
      ),
      maxModelCallsPerRun: parseInt_(
        source['FLEETSCOPE_RUN_MAX_MODEL_CALLS'],
        6,
        'FLEETSCOPE_RUN_MAX_MODEL_CALLS',
        problems,
      ),
      workerMode: parseWorkerMode(source['FLEETSCOPE_RUN_WORKER_MODE'], problems),
      driver: source['FLEETSCOPE_RUN_DRIVER'] === 'mcp' ? 'mcp' : 'worker',
    },
    worker: {
      python: source['FLEETSCOPE_WORKER_PYTHON']?.trim() || 'apps/adk-worker/.venv/bin/python',
      directory: source['FLEETSCOPE_WORKER_DIR']?.trim() || 'apps/adk-worker',
      pythonPath: source['FLEETSCOPE_WORKER_PYTHONPATH']?.trim() || 'apps/adk-worker/src',
      timeoutMs: parseInt_(
        source['FLEETSCOPE_WORKER_TIMEOUT_MS'],
        120_000,
        'FLEETSCOPE_WORKER_TIMEOUT_MS',
        problems,
      ),
      offline: source['FLEETSCOPE_WORKER_OFFLINE'] === 'true',
      allowModelCalls: source['FLEETSCOPE_ALLOW_MODEL_CALLS'] === 'true',
      useVertexAi: source['GOOGLE_GENAI_USE_VERTEXAI'] === 'true',
      attemptLedger: source['FLEETSCOPE_ATTEMPT_LEDGER']?.trim() ?? '',
    },
  };

  // Live mode is the only state that can spend credit, so its prerequisites are
  // validated at boot rather than discovered at call time.
  //
  // WHICH prerequisites depends on who issues the model call:
  //
  //   worker  FleetScope runs the agent itself and pays for it. The ADK worker
  //           uses Vertex ADC; the legacy direct-decision path still uses its
  //           API key when called.
  //   mcp     the developer's own Gemini or Antigravity CLI supplies the model
  //           on that CLI's auth. FleetScope never issues a model call on this
  //           path, so demanding a key it will not use would only force an
  //           operator to invent one, and an invented credential in an
  //           environment is worse than no credential.
  //
  // Live mode still gates admission in BOTH drivers: it is what separates a
  // deployment that may start runs from one that may only replay them.
  if (!config.liveMode && config.runs.workerMode === 'adk') {
    problems.push(
      'FLEETSCOPE_RUN_WORKER_MODE=adk requires LIVE_MODE=true; keep the worker mode pure while recorded-only',
    );
  }
  if (config.liveMode) {
    if (config.runs.workerMode === 'adk' && config.runs.driver !== 'worker') {
      problems.push('FLEETSCOPE_RUN_WORKER_MODE=adk requires FLEETSCOPE_RUN_DRIVER=worker');
    }
    if (config.runs.driver === 'worker') {
      if (config.runs.workerMode === 'adk') {
        if (!config.worker.allowModelCalls) {
          problems.push(
            'LIVE_MODE=true with FLEETSCOPE_RUN_WORKER_MODE=adk requires FLEETSCOPE_ALLOW_MODEL_CALLS=true',
          );
        }
        if (!config.worker.useVertexAi) {
          problems.push(
            'LIVE_MODE=true with FLEETSCOPE_RUN_WORKER_MODE=adk requires GOOGLE_GENAI_USE_VERTEXAI=true',
          );
        }
        if (config.gcp.projectId === null) {
          problems.push(
            'LIVE_MODE=true with FLEETSCOPE_RUN_WORKER_MODE=adk requires GOOGLE_CLOUD_PROJECT',
          );
        }
        if (config.gcp.region === null) {
          problems.push(
            'LIVE_MODE=true with FLEETSCOPE_RUN_WORKER_MODE=adk requires GOOGLE_CLOUD_LOCATION',
          );
        }
        if (config.gemini.model === null) {
          problems.push(
            'LIVE_MODE=true with FLEETSCOPE_RUN_WORKER_MODE=adk requires FLEETSCOPE_ADK_MODEL or GEMINI_MODEL',
          );
        } else if (!isGemini35OrNewer(config.gemini.model)) {
          problems.push(
            'LIVE_MODE=true with FLEETSCOPE_RUN_WORKER_MODE=adk requires a Gemini 3.5+ model id',
          );
        }
      } else {
        if (config.gemini.model === null) {
          problems.push('LIVE_MODE=true with FLEETSCOPE_RUN_DRIVER=worker requires GEMINI_MODEL');
        }
        // The message names the VARIABLE, never a value: a config error must not
        // be the thing that prints a credential into a log.
        if (config.gemini.apiKey === null) {
          problems.push('LIVE_MODE=true with FLEETSCOPE_RUN_DRIVER=worker requires GEMINI_API_KEY');
        }
      }
    }
    // Independent of the driver: this bounds the separate `/live/decision`
    // path, which is not part of the run controller at all.
    if (config.gemini.maxCallsPerCase < 1) {
      problems.push('LIVE_MODE=true requires GEMINI_MAX_CALLS_PER_CASE >= 1');
    }
  }

  return problems.length > 0 ? err(problems) : ok(config);
}

/** Thrown by the live guard. Carries no configuration values. */
export class LiveModeDisabledError extends Error {
  constructor(operation: string) {
    super(`Refused "${operation}": LIVE_MODE is disabled. FleetScope is running recorded-only.`);
    this.name = 'LiveModeDisabledError';
  }
}

/**
 * The single choke point for every outbound model or platform call.
 * Call this immediately before any such call — never behind a cached boolean.
 */
export function assertLiveModeEnabled(config: FleetScopeConfig, operation: string): void {
  if (!config.liveMode) throw new LiveModeDisabledError(operation);
}
