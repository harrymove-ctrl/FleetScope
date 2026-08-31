import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import {
  isLoopbackAddress,
  listLocalSessions,
  readLocalSessionJsonl,
} from '../src/lib/local-sessions';
import {
  buildNativeTuiCommand,
  resolveTuiSessionId,
  repoRootFromSessions,
} from '../src/lib/local-tui';

const tmp = mkdtempSync(join(tmpdir(), 'fleetscope-sessions-'));
const repo = join(tmp, 'FleetScope');
const root = join(repo, '.fleetscope', 'sessions');
mkdirSync(join(root, 'antigravity-live-cu'), { recursive: true });
writeFileSync(
  join(root, 'antigravity-live-cu', 'session.jsonl'),
  '{"invocationId":"e-test"}\n',
  'utf8',
);

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe('local session listing', () => {
  it('lists the recorded Antigravity folder when it exists', () => {
    const rows = listLocalSessions(root);
    expect(rows.some((row) => row.id === 'antigravity-live-cu')).toBe(true);
    const agy = rows.find((row) => row.id === 'antigravity-live-cu');
    expect(agy?.bytes).toBeGreaterThan(0);
  });

  it('reads that JSONL and refuses traversal', () => {
    const body = readLocalSessionJsonl('antigravity-live-cu', root);
    expect(body).toContain('invocationId');
    expect(readLocalSessionJsonl('../etc', root)).toBeNull();
    expect(readLocalSessionJsonl('foo/bar', root)).toBeNull();
    expect(readLocalSessionJsonl('', root)).toBeNull();
  });

  it('names loopback addresses only', () => {
    expect(isLoopbackAddress('127.0.0.1')).toBe(true);
    expect(isLoopbackAddress('::1')).toBe(true);
    expect(isLoopbackAddress('::ffff:127.0.0.1')).toBe(true);
    expect(isLoopbackAddress('8.8.8.8')).toBe(false);
    expect(isLoopbackAddress(undefined)).toBe(false);
  });
});

describe('native TUI launch command', () => {
  it('cds into the repo and follows a validated session id', () => {
    const command = buildNativeTuiCommand('antigravity-live-cu', root);
    expect(command).toContain(`cd '${repo}'`);
    expect(command).toContain('.fleetscope/sessions/antigravity-live-cu --follow --tiny');
    expect(command).toMatch(/target\/debug\/fleetscope|cargo run -p fleetscope-cli/);
    expect(command).not.toContain('pnpm demo:google-session -- --run');
    expect(buildNativeTuiCommand('../etc', root)).toBeNull();
  });

  it('uses the newest local session when none is named', () => {
    const id = resolveTuiSessionId(null, root);
    expect(id).toBe('antigravity-live-cu');
    expect(repoRootFromSessions(root)).toBe(repo);
  });
});
