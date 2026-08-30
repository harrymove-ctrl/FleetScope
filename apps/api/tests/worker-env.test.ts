import { describe, expect, it } from 'vitest';

import { parseConfig } from '@fleetscope/shared';

import { productionRunDependencies } from '../src/runs/dependencies.js';
import { workerEnvironment } from '../src/runs/worker.js';

const config = (source: Record<string, string> = {}) => {
  const result = parseConfig(source);
  if (!result.ok) throw new Error(result.error.join('; '));
  return result.value;
};

const adkSource = {
  LIVE_MODE: 'true',
  FLEETSCOPE_RUN_DRIVER: 'worker',
  FLEETSCOPE_RUN_WORKER_MODE: 'adk',
  FLEETSCOPE_ALLOW_MODEL_CALLS: 'true',
  GOOGLE_GENAI_USE_VERTEXAI: 'true',
  GOOGLE_CLOUD_PROJECT: 'demo-project',
  GOOGLE_CLOUD_LOCATION: 'us-central1',
  FLEETSCOPE_ADK_MODEL: 'gemini-3.7-flash',
  FLEETSCOPE_WORKER_PYTHON: '/opt/fleetscope-venv/bin/python',
  FLEETSCOPE_WORKER_DIR: '/repo',
  FLEETSCOPE_WORKER_PYTHONPATH: '/opt/fleetscope-venv/lib/python3.11/site-packages',
  FLEETSCOPE_RUN_LEDGER: '/tmp/fleetscope/test-runs.jsonl',
  FLEETSCOPE_ATTEMPT_LEDGER: '/tmp/fleetscope/attempts.jsonl',
};

describe('API-owned worker configuration', () => {
  it('keeps the default worker environment recorded-only and minimal', () => {
    const environment = workerEnvironment(config());

    expect(environment).toEqual({ PYTHONPATH: 'apps/adk-worker/src' });
    expect(environment).not.toHaveProperty('FLEETSCOPE_ALLOW_MODEL_CALLS');
    expect(environment).not.toHaveProperty('GOOGLE_GENAI_USE_VERTEXAI');
    expect(environment).not.toHaveProperty('GEMINI_API_KEY');
  });

  it('passes only the explicit Vertex/ADK values to an ADK worker', () => {
    const environment = workerEnvironment(config(adkSource));

    expect(environment).toEqual({
      PYTHONPATH: '/opt/fleetscope-venv/lib/python3.11/site-packages',
      FLEETSCOPE_ALLOW_MODEL_CALLS: 'true',
      FLEETSCOPE_ADK_MODEL: 'gemini-3.7-flash',
      GOOGLE_GENAI_USE_VERTEXAI: 'true',
      GOOGLE_CLOUD_PROJECT: 'demo-project',
      GOOGLE_CLOUD_LOCATION: 'us-central1',
      FLEETSCOPE_ATTEMPT_LEDGER: '/tmp/fleetscope/attempts.jsonl',
    });
    expect(environment).not.toHaveProperty('GEMINI_API_KEY');
    expect(environment).not.toHaveProperty('GOOGLE_APPLICATION_CREDENTIALS');
    expect(environment).not.toHaveProperty('PATH');
  });

  it('wires the parsed ADK mode into production run dependencies', () => {
    const dependencies = productionRunDependencies(config(adkSource));

    expect(dependencies.workerMode).toBe('adk');
    expect(dependencies.runDriver).toBe('worker');
  });
});
