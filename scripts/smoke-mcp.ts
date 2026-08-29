/**
 * The MCP-governed path, end to end, against a REAL API and a REAL MCP server.
 *
 * # What this proves that a unit test cannot
 *
 * Three separate processes have to agree: the API (TypeScript), the MCP server
 * (Python), and a JSON-RPC client speaking the actual MCP wire protocol over
 * stdio. Unit tests on either side can pass while the contract between them is
 * broken, which is exactly how `/runs` once 404'd with a green suite.
 *
 * # Cost
 *
 * Zero, and structurally so. The API runs with **no Gemini credential at all**,
 * which is the point of the `mcp` driver: the model would run in the developer's
 * own CLI, on that CLI's auth. Here no model runs, and the allowlisted read is
 * answered from a recorded fixture.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORKER_DIR = join(REPO_ROOT, 'apps/adk-worker');
const WORKER_PYTHON = join(WORKER_DIR, '.venv/bin/python');

let pass = 0;
let fail = 0;

function check(name: string, ok: boolean, detail = ''): void {
  const suffix = detail === '' ? '' : `  ::  ${detail}`;
  console.log(`   ${ok ? 'PASS' : 'FAIL'}  ${name}${suffix}`);
  if (ok) pass += 1;
  else fail += 1;
}

function freePort(): Promise<number> {
  return new Promise((ok, no) => {
    const probe = createServer();
    probe.on('error', no);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (address === null || typeof address === 'string') return no(new Error('no port'));
      const { port } = address;
      probe.close(() => ok(port));
    });
  });
}

// ── the real API ────────────────────────────────────────────────────────────

interface Api {
  readonly port: number;
  readonly child: ChildProcess;
}

async function startApi(): Promise<Api> {
  const port = await freePort();
  const ledger = join(mkdtempSync(join(tmpdir(), 'fleetscope-mcp-')), 'runs.jsonl');
  const child = spawn('pnpm', ['--filter', '@fleetscope/api', 'start'], {
    env: {
      ...process.env,
      PORT: String(port),
      API_LOG_LEVEL: 'silent',
      FLEETSCOPE_RUN_LEDGER: ledger,
      FLEETSCOPE_RUN_DRIVER: 'mcp',
      LIVE_MODE: 'true',
      // Deliberately absent: GEMINI_MODEL and GEMINI_API_KEY. If the config
      // still demanded them, this process would refuse to boot and the whole
      // script would fail at the first fetch.
      GEMINI_MODEL: '',
      GEMINI_API_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`API refused to boot without a Gemini key:\n${stderr.trim()}`);
    }
    try {
      if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) return { port, child };
    } catch {
      /* not listening yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  child.kill('SIGKILL');
  throw new Error('API did not become ready');
}

// ── a real MCP client, speaking JSON-RPC over stdio ─────────────────────────

interface JsonRpcResponse<T> {
  readonly id?: number;
  readonly result?: T;
  readonly error?: { readonly message?: string };
}

interface InitializeResult {
  readonly serverInfo?: { readonly name?: string };
}

interface ToolsListResult {
  readonly tools?: readonly { readonly name: string }[];
}

interface ToolCallResult {
  readonly content?: readonly { readonly text?: string }[];
}

class McpClient {
  private readonly child: ChildProcess;
  private buffered = '';
  private nextId = 1;
  private readonly waiting = new Map<number, (value: unknown) => void>();

  constructor(apiBase: string) {
    this.child = spawn(WORKER_PYTHON, ['-m', 'fleetscope_worker.mcp_server'], {
      cwd: WORKER_DIR,
      env: {
        PATH: process.env['PATH'] ?? '',
        PYTHONPATH: join(WORKER_DIR, 'src'),
        FLEETSCOPE_API: apiBase,
        // The allowlisted read is answered from a recorded fixture: this script
        // must not depend on GitHub being reachable.
        FLEETSCOPE_WORKER_OFFLINE: 'true',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.child.stdout?.setEncoding('utf8');
    this.child.stdout?.on('data', (chunk: string) => this.consume(chunk));
    this.child.stderr?.resume();
  }

  private consume(chunk: string): void {
    this.buffered += chunk;
    let newline = this.buffered.indexOf('\n');
    while (newline !== -1) {
      const line = this.buffered.slice(0, newline).trim();
      this.buffered = this.buffered.slice(newline + 1);
      if (line !== '') {
        try {
          const message = JSON.parse(line) as { id?: number };
          if (typeof message.id === 'number') {
            this.waiting.get(message.id)?.(message);
            this.waiting.delete(message.id);
          }
        } catch {
          /* not a JSON-RPC frame */
        }
      }
      newline = this.buffered.indexOf('\n');
    }
  }

  private send(payload: Record<string, unknown>): void {
    this.child.stdin?.write(`${JSON.stringify(payload)}\n`);
  }

  notify(method: string, params: Record<string, unknown> = {}): void {
    this.send({ jsonrpc: '2.0', method, params });
  }

  request<T>(method: string, params: Record<string, unknown> = {}): Promise<JsonRpcResponse<T>> {
    const id = this.nextId++;
    return new Promise((resolveOne, rejectOne) => {
      const timer = setTimeout(() => rejectOne(new Error(`${method} timed out`)), 30_000);
      this.waiting.set(id, (value) => {
        clearTimeout(timer);
        resolveOne(value as JsonRpcResponse<T>);
      });
      this.send({ jsonrpc: '2.0', id, method, params });
    });
  }

  async handshake(): Promise<JsonRpcResponse<InitializeResult>> {
    const result = await this.request<InitializeResult>('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'antigravity-cli', version: '1.0' },
    });
    this.notify('notifications/initialized');
    return result;
  }

  async callTool(target: string): Promise<string> {
    const response = await this.request<ToolCallResult>('tools/call', {
      name: 'read_repository_metadata',
      arguments: { target },
    });
    return (response.result?.content ?? []).map((part) => part.text ?? '').join('');
  }

  stop(): void {
    this.child.kill('SIGKILL');
  }
}

// ── the run ─────────────────────────────────────────────────────────────────

interface EventsPage {
  readonly state: string;
  readonly phase: string;
  readonly complete: boolean;
  readonly highWaterMark: number;
  readonly replay: { modelCalls: number; toolCalls: number; wardenActions: number };
  readonly events: readonly {
    sequence: number;
    kind: string;
    agent: string;
    truth: string;
    payload: Record<string, unknown>;
  }[];
}

const TARGET = 'google/adk-python';

async function main(): Promise<number> {
  console.log('\n== a real API with NO Gemini credential, driver=mcp');
  const api = await startApi();
  const base = `http://127.0.0.1:${api.port}`;
  const client = new McpClient(base);

  try {
    const capability = (await (await fetch(`${base}/runs/capability`)).json()) as {
      liveMode: boolean;
      runDriver: string;
    };
    check(
      'the API boots in live mode with no Gemini key',
      capability.liveMode === true && capability.runDriver === 'mcp',
      `liveMode ${capability.liveMode}, driver ${capability.runDriver}`,
    );

    // ── the tool refuses before a run is admitted ──────────────────────────
    console.log('\n== the MCP server');
    const initialised = await client.handshake();
    check(
      'initialize',
      initialised.result?.serverInfo?.name === 'fleetscope',
      `server ${initialised.result?.serverInfo?.name ?? 'unknown'}`,
    );

    const tools = await client.request<ToolsListResult>('tools/list');
    const names = (tools.result?.tools ?? []).map((tool) => tool.name);
    check('tools/list', names.includes('read_repository_metadata'), names.join(', '));

    const ungoverned = await client.callTool(TARGET);
    check(
      'the tool refuses when no run is admitted',
      ungoverned.startsWith('Refused: no FleetScope run'),
      ungoverned.slice(0, 60),
    );

    // ── admit a run ────────────────────────────────────────────────────────
    console.log('\n== POST /runs (only the fixed scenario id)');
    const started = await fetch(`${base}/runs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scenarioId: 'dependency_onboarding' }),
    });
    const run = (await started.json()) as {
      run: { runId: string; state: string };
      executing: boolean;
      awaitingAgent: boolean;
      mode: string;
    };
    check('POST /runs is admitted', started.status === 201, `HTTP ${started.status}`);
    check(
      'nothing is executing until the agent calls the tool',
      run.executing === false && run.awaitingAgent === true && run.run.state === 'admitted',
      `state ${run.run.state}, executing ${run.executing}, awaitingAgent ${run.awaitingAgent}`,
    );

    // ── a target the admitted run does not cover ───────────────────────────
    const refused = await client.callTool('attacker/exfiltrate');
    check(
      'a non-allowlisted target is refused',
      refused.includes('not an allowlisted target'),
      refused.slice(0, 60),
    );

    // That refusal ends the run, so admit a fresh one for the happy path.
    const second = await fetch(`${base}/runs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scenarioId: 'dependency_onboarding' }),
    });
    const good = (await second.json()) as { run: { runId: string } };
    const runId = good.run.runId;

    // ── the governed read ──────────────────────────────────────────────────
    console.log('\n== the agent calls the governed tool');
    const answer = await client.callTool(TARGET);
    check(
      'the agent receives the authoritative result',
      answer.includes('Apache-2.0'),
      answer.slice(0, 70),
    );

    const page = (await (await fetch(`${base}/runs/${runId}/events?after=0`)).json()) as EventsPage;

    console.log('\n   --- canonical events, ingested over real HTTP ---');
    for (const event of page.events) {
      const label = event.truth === 'live' ? '' : `  [${event.truth.toUpperCase()}]`;
      console.log(
        `      ${String(event.sequence).padStart(2)}  ${event.agent.padEnd(16)} ${event.kind}${label}`,
      );
    }
    console.log('');

    check('the run completed', page.state === 'completed', page.state);
    check('the phase is derived from events', page.phase === 'finished', page.phase);

    const first = page.events.find((e) => e.kind === 'tool_result');
    check(
      'the first attempt is a Controlled Fault',
      first?.truth === 'controlled_fault' && first?.payload['status'] === 'failed',
      `${first?.truth}, ${String(first?.payload['status'])}`,
    );
    check(
      'an incident is emitted',
      page.events.some((e) => e.kind === 'incident' && e.truth === 'controlled_fault'),
    );

    const interventions = page.events.filter((e) => e.kind === 'intervention');
    check('policy authorises exactly one retry', interventions.length === 1);
    check(
      'the retry is the one the policy named',
      interventions[0]?.payload['outcome'] === 'retry_once',
      String(interventions[0]?.payload['outcome']),
    );

    const keys = new Set(
      page.events
        .filter((e) => e.kind === 'tool_call' || e.kind === 'intervention')
        .map((e) => String(e.payload['idempotencyKey'])),
    );
    check('every attempt reuses one idempotency key', keys.size === 1, [...keys].join(''));

    const last = page.events.filter((e) => e.kind === 'tool_result').at(-1);
    check(
      'the final result is authoritative and live',
      last?.payload['status'] === 'ok' && last?.truth === 'live',
      `${String(last?.payload['status'])}, ${last?.truth}`,
    );
    check(
      'delegation is reported as unobserved, not asserted',
      !page.events.some((e) => e.kind === 'delegation') &&
        page.events.find((e) => e.kind === 'run_end')?.payload['delegationObserved'] === false,
    );
    check(
      'events are dense from one',
      page.events.every((event, index) => event.sequence === index + 1),
      `${page.events.length} events`,
    );
    check(
      'replay performs no model, tool or Warden call',
      page.replay.modelCalls === 0 &&
        page.replay.toolCalls === 0 &&
        page.replay.wardenActions === 0,
    );
  } finally {
    client.stop();
    api.child.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 300));
    if (api.child.exitCode === null) api.child.kill('SIGKILL');
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  return fail === 0 ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(`\nsmoke aborted: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  },
);
