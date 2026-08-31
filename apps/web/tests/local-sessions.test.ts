import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  isLoopbackAddress,
  listLocalSessions,
  readLocalSessionJsonl,
} from '../src/lib/local-sessions';

const root = join(process.cwd(), '.fleetscope/sessions');

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
