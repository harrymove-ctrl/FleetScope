/**
 * Loopback listing of `.fleetscope/sessions` for Agent Viewer auto-follow.
 *
 * The browser never uploads. Astro on 127.0.0.1 reads the same JSONL the CLI
 * tails. Path traversal and non-loopback callers are refused.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export type LocalSessionInfo = {
  readonly id: string;
  readonly mtimeMs: number;
  readonly bytes: number;
};

const SESSION_ID = /^[A-Za-z0-9._-]+$/;

export function sessionsRoot(): string {
  return fileURLToPath(new URL('../../../../.fleetscope/sessions', import.meta.url));
}

export function isLoopbackAddress(address: string | undefined): boolean {
  if (!address) return false;
  return (
    address === '127.0.0.1' ||
    address === '::1' ||
    address === ':1' ||
    address === '::ffff:127.0.0.1' ||
    address.endsWith('127.0.0.1')
  );
}

export function listLocalSessions(root = sessionsRoot()): readonly LocalSessionInfo[] {
  let names: string[] = [];
  try {
    names = readdirSync(root);
  } catch {
    return [];
  }
  const rows: LocalSessionInfo[] = [];
  for (const id of names) {
    if (!SESSION_ID.test(id)) continue;
    const jsonl = join(root, id, 'session.jsonl');
    try {
      const st = statSync(jsonl);
      if (!st.isFile()) continue;
      rows.push({ id, mtimeMs: st.mtimeMs, bytes: st.size });
    } catch {
      // Missing session.jsonl is normal for an empty or incomplete folder.
    }
  }
  return rows.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

export function localSessionsVitePlugin(root = sessionsRoot()) {
  return {
    name: 'fleetscope-local-sessions',
    configureServer(server: { middlewares: { use: (fn: unknown) => void } }) {
      server.middlewares.use(
        (req: { url?: string; socket: { remoteAddress?: string } }, res: {
          statusCode: number;
          setHeader: (k: string, v: string) => void;
          end: (s?: string) => void;
        }, next: () => void) => {
          const url = (req.url ?? '').split('?')[0] ?? '';
          if (!url.startsWith('/local-sessions')) {
            next();
            return;
          }
          if (!isLoopbackAddress(req.socket.remoteAddress)) {
            res.statusCode = 403;
            res.end('loopback only');
            return;
          }
          if (url === '/local-sessions.json' || url === '/local-sessions') {
            res.setHeader('content-type', 'application/json; charset=utf-8');
            res.end(JSON.stringify(listLocalSessions(root)));
            return;
          }
          const match = /^\/local-sessions\/([^/]+)\/session\.jsonl$/.exec(url);
          if (!match) {
            res.statusCode = 404;
            res.end();
            return;
          }
          const body = readLocalSessionJsonl(decodeURIComponent(match[1] ?? ''), root);
          if (body === null) {
            res.statusCode = 404;
            res.end();
            return;
          }
          res.setHeader('content-type', 'text/plain; charset=utf-8');
          res.end(body);
        },
      );
    },
  };
}

export function readLocalSessionJsonl(id: string, root = sessionsRoot()): string | null {
  if (!SESSION_ID.test(id)) return null;
  const jsonl = resolve(root, id, 'session.jsonl');
  const base = resolve(root) + sep;
  if (!jsonl.startsWith(base)) return null;
  try {
    return readFileSync(jsonl, 'utf8');
  } catch {
    return null;
  }
}
