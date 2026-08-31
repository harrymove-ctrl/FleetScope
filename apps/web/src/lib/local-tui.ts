/**
 * Loopback-only launch of the native FleetScope TUI.
 *
 * The browser cannot spawn a terminal. On 127.0.0.1 the Vite plugin can, so
 * Open TUI actually opens Terminal.app instead of silently copying a command.
 */
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';

import { isLoopbackAddress, listLocalSessions, sessionsRoot } from './local-sessions';

const SESSION_ID = /^[A-Za-z0-9._-]+$/;

export function repoRootFromSessions(root = sessionsRoot()): string {
  return resolve(root, '..', '..');
}

export function resolveTuiSessionId(
  requested: string | null | undefined,
  root = sessionsRoot(),
): string {
  if (requested && SESSION_ID.test(requested)) return requested;
  return listLocalSessions(root)[0]?.id ?? 'antigravity-live-cu';
}

export function buildNativeTuiCommand(
  sessionId: string,
  root = sessionsRoot(),
): string | null {
  if (!SESSION_ID.test(sessionId)) return null;
  const repo = repoRootFromSessions(root);
  const sessionPath = `.fleetscope/sessions/${sessionId}`;
  const debugBin = join(repo, 'target/debug/fleetscope');
  if (existsSync(debugBin)) {
    return `cd ${shellSingleQuote(repo)} && ./target/debug/fleetscope ${sessionPath} --follow --tiny`;
  }
  return `cd ${shellSingleQuote(repo)} && cargo run -p fleetscope-cli --bin fleetscope -- ${sessionPath} --follow --tiny`;
}

export function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export type TuiLauncher = (command: string) => void;

export function launchNativeTui(
  sessionId: string,
  root = sessionsRoot(),
  launcher: TuiLauncher = launchInTerminalApp,
): { ok: true; command: string; sessionId: string } | { ok: false; error: string; command: string } {
  const command = buildNativeTuiCommand(sessionId, root);
  if (command === null) {
    return { ok: false, error: 'invalid_session', command: '' };
  }
  try {
    launcher(command);
    return { ok: true, command, sessionId };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      command,
    };
  }
}

function launchInTerminalApp(command: string): void {
  const script = `tell application "Terminal"\nactivate\ndo script ${appleString(command)}\nend tell`;
  const child = spawn('osascript', ['-e', script], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

function appleString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

type MiddlewareReq = {
  url?: string;
  method?: string;
  socket: { remoteAddress?: string };
};

type MiddlewareRes = {
  statusCode: number;
  setHeader: (k: string, v: string) => void;
  end: (s?: string) => void;
};

export function localTuiVitePlugin(root = sessionsRoot()) {
  return {
    name: 'fleetscope-local-tui',
    configureServer(server: { middlewares: { use: (fn: unknown) => void } }) {
      server.middlewares.use((req: MiddlewareReq, res: MiddlewareRes, next: () => void) => {
        const rawUrl = req.url ?? '';
        const url = rawUrl.split('?')[0] ?? '';
        if (url !== '/local-tui/open') {
          next();
          return;
        }
        if (!isLoopbackAddress(req.socket.remoteAddress)) {
          res.statusCode = 403;
          res.end('loopback only');
          return;
        }
        if (String(req.method ?? 'GET').toUpperCase() !== 'POST') {
          res.statusCode = 405;
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: 'POST only' }));
          return;
        }
        const query = new URL(rawUrl, 'http://127.0.0.1').searchParams.get('session');
        const result = launchNativeTui(resolveTuiSessionId(query, root), root);
        res.statusCode = result.ok ? 200 : 400;
        res.setHeader('content-type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(result));
      });
    },
  };
}
