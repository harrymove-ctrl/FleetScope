import { describe, expect, it } from 'vitest';
import { assertLiveModeEnabled, LiveModeDisabledError, parseConfig } from '../src/index.js';

const unwrap = (source: Record<string, string | undefined>) => {
  const result = parseConfig(source);
  if (!result.ok) throw new Error(`expected ok, got: ${result.error.join('; ')}`);
  return result.value;
};

describe('parseConfig', () => {
  it('defaults to recorded-only on an empty environment', () => {
    const config = unwrap({});
    expect(config.liveMode).toBe(false);
    expect(config.appEnv).toBe('development');
    expect(config.defaultCaseId).toBe('CASE-1042');
    expect(config.port).toBe(8080);
  });

  it('fails closed for any LIVE_MODE value that is not exactly "true"', () => {
    for (const raw of ['false', 'TRUE', '1', 'yes', '', ' true', undefined]) {
      expect(unwrap({ LIVE_MODE: raw }).liveMode).toBe(false);
    }
  });

  it('enables live mode only with its full prerequisites', () => {
    const config = unwrap({
      LIVE_MODE: 'true',
      GEMINI_MODEL: 'gemini-2.5-flash',
      GEMINI_API_KEY: 'not-a-real-key',
    });
    expect(config.liveMode).toBe(true);
  });

  it('rejects live mode without a model or a credential', () => {
    const result = parseConfig({ LIVE_MODE: 'true' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain(
      'LIVE_MODE=true with FLEETSCOPE_RUN_DRIVER=worker requires GEMINI_MODEL',
    );
    expect(result.error).toContain(
      'LIVE_MODE=true with FLEETSCOPE_RUN_DRIVER=worker requires GEMINI_API_KEY',
    );
  });

  it('names the missing variable and never a value', () => {
    // A configuration error must not be the thing that prints a credential.
    const result = parseConfig({ LIVE_MODE: 'true', GEMINI_API_KEY: 'super-secret-value' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.join(' ')).not.toContain('super-secret-value');
  });

  it('reports invalid numeric and enum values', () => {
    const result = parseConfig({ APP_ENV: 'staging', GEMINI_MAX_OUTPUT_TOKENS: 'lots' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toHaveLength(2);
  });

  it('applies the documented budget guardrail defaults', () => {
    const config = unwrap({});
    expect(config.gemini.maxInputTokens).toBe(2000);
    expect(config.gemini.maxOutputTokens).toBe(300);
    expect(config.gemini.maxCallsPerCase).toBe(2);
    expect(config.gemini.temperature).toBe(0);
  });
});

describe('assertLiveModeEnabled', () => {
  it('throws when live mode is disabled', () => {
    const config = unwrap({});
    expect(() => assertLiveModeEnabled(config, 'gemini.generate')).toThrow(LiveModeDisabledError);
  });

  it('passes when live mode is fully configured', () => {
    const config = unwrap({
      LIVE_MODE: 'true',
      GEMINI_MODEL: 'gemini-2.5-flash',
      GEMINI_API_KEY: 'not-a-real-key',
    });
    expect(() => assertLiveModeEnabled(config, 'gemini.generate')).not.toThrow();
  });
});

describe('the run driver decides which credentials live mode needs', () => {
  // Who issues the model call decides who must hold the credential.
  //
  //   worker  FleetScope runs the agent and pays for it.
  //   mcp     the developer's own CLI supplies the model on its own auth, so
  //           FleetScope never issues a model call and needs no key.

  const live = (over: Record<string, string> = {}) => parseConfig({ LIVE_MODE: 'true', ...over });

  it('lets MCP live mode start with no Gemini credential at all', () => {
    // The production bug this replaces: an operator on the MCP path was forced
    // to invent a key FleetScope would never use, and an invented credential in
    // an environment is worse than no credential.
    const result = live({ FLEETSCOPE_RUN_DRIVER: 'mcp' });
    expect(result.ok, result.ok ? '' : result.error.join('; ')).toBe(true);
    if (!result.ok) return;
    expect(result.value.liveMode).toBe(true);
    expect(result.value.runs.driver).toBe('mcp');
    expect(result.value.gemini.apiKey).toBeNull();
  });

  it('still refuses worker live mode without a credential', () => {
    const result = live({ FLEETSCOPE_RUN_DRIVER: 'worker', GEMINI_MODEL: 'gemini-2.5-flash' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.join(' ')).toContain('GEMINI_API_KEY');
  });

  it('defaults to the worker driver, so the strict rule is the default', () => {
    // Fail closed: an unset or misspelled driver must not silently become the
    // one that needs no credential.
    for (const over of [{}, { FLEETSCOPE_RUN_DRIVER: 'MCP' }, { FLEETSCOPE_RUN_DRIVER: 'x' }]) {
      const result = live(over);
      expect(result.ok, JSON.stringify(over)).toBe(false);
    }
  });

  it('selects the driver deterministically from the exact string', () => {
    const cases: readonly [string | undefined, 'worker' | 'mcp'][] = [
      ['mcp', 'mcp'],
      ['worker', 'worker'],
      ['MCP', 'worker'],
      ['', 'worker'],
      [undefined, 'worker'],
    ];
    for (const [raw, expected] of cases) {
      const source: Record<string, string> = { LIVE_MODE: 'false' };
      if (raw !== undefined) source['FLEETSCOPE_RUN_DRIVER'] = raw;
      const result = parseConfig(source);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.runs.driver, String(raw)).toBe(expected);
    }
  });

  it('keeps recorded mode safe on either driver', () => {
    // No credential, no live mode, nothing admitted. The safe default does not
    // depend on which driver a deployment picked.
    for (const driver of ['worker', 'mcp']) {
      const result = parseConfig({ FLEETSCOPE_RUN_DRIVER: driver });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.liveMode).toBe(false);
      expect(result.value.gemini.apiKey).toBeNull();
    }
  });

  it('never echoes a credential when refusing the worker driver', () => {
    const result = live({
      FLEETSCOPE_RUN_DRIVER: 'worker',
      GEMINI_API_KEY: 'sk-super-secret-value',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.join(' ')).not.toContain('sk-super-secret-value');
  });

  it('does not carry a credential into the MCP configuration it returns', () => {
    const result = live({ FLEETSCOPE_RUN_DRIVER: 'mcp', GEMINI_API_KEY: 'sk-should-be-unused' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Present because the operator set it, but nothing on the MCP path reads it.
    expect(result.value.runs.driver).toBe('mcp');
    expect(JSON.stringify(result.value.runs)).not.toContain('sk-should-be-unused');
  });

  it('accepts the explicit Vertex ADC configuration for the ADK worker without an API key', () => {
    const result = live({
      FLEETSCOPE_RUN_DRIVER: 'worker',
      FLEETSCOPE_RUN_WORKER_MODE: 'adk',
      FLEETSCOPE_ALLOW_MODEL_CALLS: 'true',
      GOOGLE_GENAI_USE_VERTEXAI: 'true',
      GOOGLE_CLOUD_PROJECT: 'demo-project',
      GOOGLE_CLOUD_LOCATION: 'us-central1',
      FLEETSCOPE_ADK_MODEL: 'gemini-3.7-flash',
    });
    expect(result.ok, result.ok ? '' : result.error.join('; ')).toBe(true);
    if (!result.ok) return;
    expect(result.value.runs.workerMode).toBe('adk');
    expect(result.value.worker.allowModelCalls).toBe(true);
    expect(result.value.worker.useVertexAi).toBe(true);
    expect(result.value.gcp).toEqual({ projectId: 'demo-project', region: 'us-central1' });
    expect(result.value.gemini.model).toBe('gemini-3.7-flash');
    expect(result.value.gemini.apiKey).toBeNull();
  });

  it('refuses ADK mode until every live Vertex gate is explicit', () => {
    const result = live({ FLEETSCOPE_RUN_WORKER_MODE: 'adk' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual(
      expect.arrayContaining([
        'LIVE_MODE=true with FLEETSCOPE_RUN_WORKER_MODE=adk requires FLEETSCOPE_ALLOW_MODEL_CALLS=true',
        'LIVE_MODE=true with FLEETSCOPE_RUN_WORKER_MODE=adk requires GOOGLE_GENAI_USE_VERTEXAI=true',
        'LIVE_MODE=true with FLEETSCOPE_RUN_WORKER_MODE=adk requires GOOGLE_CLOUD_PROJECT',
        'LIVE_MODE=true with FLEETSCOPE_RUN_WORKER_MODE=adk requires GOOGLE_CLOUD_LOCATION',
        'LIVE_MODE=true with FLEETSCOPE_RUN_WORKER_MODE=adk requires FLEETSCOPE_ADK_MODEL or GEMINI_MODEL',
      ]),
    );
  });

  it('refuses a pre-enabled ADK worker while LIVE_MODE is still off', () => {
    const result = parseConfig({ FLEETSCOPE_RUN_WORKER_MODE: 'adk' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain(
      'FLEETSCOPE_RUN_WORKER_MODE=adk requires LIVE_MODE=true; keep the worker mode pure while recorded-only',
    );
  });

  it('refuses an ADK model below the hackathon Gemini 3.5 floor', () => {
    const result = live({
      FLEETSCOPE_RUN_WORKER_MODE: 'adk',
      FLEETSCOPE_ALLOW_MODEL_CALLS: 'true',
      GOOGLE_GENAI_USE_VERTEXAI: 'true',
      GOOGLE_CLOUD_PROJECT: 'demo-project',
      GOOGLE_CLOUD_LOCATION: 'us-central1',
      FLEETSCOPE_ADK_MODEL: 'gemini-2.5-flash',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain(
      'LIVE_MODE=true with FLEETSCOPE_RUN_WORKER_MODE=adk requires a Gemini 3.5+ model id',
    );
  });
});
