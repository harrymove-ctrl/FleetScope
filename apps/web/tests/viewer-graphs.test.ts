import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BUNDLED_EVENTS,
  BUNDLED_TRANSFERS,
  checkRows,
  flowSteps,
  ganttRows,
  specRows,
  timelineRows,
  treeRows,
  unansweredCalls,
  uptimeCells,
} from '../src/features/viewer/graphs';

/**
 * The literals in `graphs.ts` were generated from the fixture. This recomputes
 * them from the same file, so the panels cannot quietly describe a session
 * that is not the one on disk.
 */
interface RawEvent {
  readonly id: string;
  readonly author: string;
  readonly timestamp: number;
  readonly errorCode?: string;
  readonly actions?: { readonly transferToAgent?: string };
  readonly content?: { readonly parts?: readonly Record<string, unknown>[] };
}

const raw: RawEvent[] = readFileSync(
  new URL(
    '../../../crates/fleetscope-cli/tests/fixtures/gemini-multi-agent/session.jsonl',
    import.meta.url,
  ),
  'utf8',
)
  .split('\n')
  .filter((line) => line.trim().length > 0)
  .map((line) => JSON.parse(line) as RawEvent);

describe('the panels describe the session on disk', () => {
  it('has one row per recorded event, in order, at the right offset', () => {
    expect(BUNDLED_EVENTS).toHaveLength(raw.length);
    const origin = Math.min(...raw.map((event) => event.timestamp));
    raw.forEach((event, index) => {
      const mine = BUNDLED_EVENTS[index];
      expect(mine?.id).toBe(event.id);
      expect(mine?.agent).toBe(event.author);
      expect(mine?.at).toBeCloseTo(Math.round((event.timestamp - origin) * 10) / 10, 5);
    });
  });

  it('marks exactly the events the run recorded as failed', () => {
    const failed = new Set(raw.filter((event) => event.errorCode).map((event) => event.id));
    for (const event of BUNDLED_EVENTS) {
      if (failed.has(event.id)) expect(event.ok).toBe(false);
    }
    expect(uptimeCells().filter((cell) => cell === 'down').length).toBeGreaterThan(0);
  });

  it('takes the handoff chain from transferToAgent, not from a guess', () => {
    const transfers = raw
      .map((event) => event.actions?.transferToAgent)
      .filter((id): id is string => Boolean(id));
    expect(BUNDLED_TRANSFERS.slice(1)).toEqual(transfers);
    expect(flowSteps().at(-1)?.last).toBe(true);
    expect(flowSteps().filter((step) => step.last)).toHaveLength(1);
  });

  it('finds the call that never came back', () => {
    const calls = new Set<string>();
    const results = new Set<string>();
    for (const event of raw) {
      for (const part of event.content?.parts ?? []) {
        const call = part['functionCall'] as { id?: string } | undefined;
        const result = part['functionResponse'] as { id?: string } | undefined;
        if (call?.id) calls.add(call.id);
        if (result?.id) results.add(result.id);
      }
    }
    const orphans = [...calls].filter((id) => !results.has(id));
    expect(orphans).toHaveLength(1);
    expect(unansweredCalls()).toBe(orphans.length);
    expect(checkRows().filter((row) => !row.done)).toHaveLength(1);
  });
});

describe('glyph geometry', () => {
  it('keeps every gantt bar inside its width', () => {
    for (const width of [12, 28, 60]) {
      for (const row of ganttRows(width)) {
        expect(row.pad).toBeGreaterThanOrEqual(0);
        expect(row.fill).toBeGreaterThanOrEqual(1);
        expect(row.pad + row.fill).toBeLessThanOrEqual(width);
      }
    }
  });

  it('marks the stalled agent and only it', () => {
    const faulted = ganttRows().filter((row) => row.faulted);
    expect(faulted).toHaveLength(1);
    expect(faulted[0]?.label).toBe('hotel_search');
  });

  it('draws the tree from the branch paths', () => {
    const rows = treeRows();
    expect(rows[0]?.label).toBe('coordinator');
    expect(rows[0]?.glyph).toBe('');
    expect(rows.at(-1)?.glyph).toBe('└─');
    expect(rows.filter((row) => row.glyph === '└─')).toHaveLength(1);
    expect(rows.every((row) => row.events > 0)).toBe(true);
  });

  it('gives every timeline row a time, an agent and a verb', () => {
    for (const row of timelineRows()) {
      expect(row.at).toMatch(/^\d+\.\ds$/);
      expect(row.agent.length).toBeGreaterThan(0);
      expect(row.note.length).toBeGreaterThan(0);
    }
  });

  it('reports counts that agree with the rows they summarise', () => {
    const spec = new Map(specRows().map((row) => [row.label, row.value]));
    expect(spec.get('events')).toBe(String(BUNDLED_EVENTS.length));
    expect(spec.get('unanswered')).toBe(String(unansweredCalls()));
    expect(spec.get('agents')).toBe(String(treeRows().length));
  });
});
