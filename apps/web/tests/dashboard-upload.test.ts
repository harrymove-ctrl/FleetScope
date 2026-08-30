import { describe, expect, it } from 'vitest';
import {
  companionName,
  filePath,
  isReadableSession,
  pickMainFile,
  sessionRoot,
} from '../src/features/dashboard/upload';

const file = (name: string, size: number, webkitRelativePath = '') => ({
  name,
  size,
  webkitRelativePath,
});

describe('dashboard upload handoff', () => {
  it('accepts only the session formats the Viewer can project', () => {
    expect(isReadableSession('run.jsonl')).toBe(true);
    expect(isReadableSession('run.JSON')).toBe(true);
    expect(isReadableSession('voice-note.mp3')).toBe(false);
    expect(isReadableSession('screenshot.png')).toBe(false);
  });

  it('chooses the largest shallow transcript as the main session', () => {
    const main = file('session.jsonl', 300, 'run/session.jsonl');
    const smaller = file('other.jsonl', 120, 'run/other.jsonl');
    const child = file('agent.jsonl', 900, 'run/session/agent.jsonl');
    expect(pickMainFile([smaller, child, main])).toBe(main);
  });

  it('returns null when a selection has no readable session', () => {
    expect(pickMainFile([file('image.png', 100), file('notes.txt', 200)])).toBeNull();
  });

  it('keeps companion names relative to the chosen session root', () => {
    const main = file('session.jsonl', 300, 'run/session.jsonl');
    const child = file('agent.jsonl', 100, 'run/session/agents/agent.jsonl');
    expect(filePath(main)).toBe('run/session.jsonl');
    expect(sessionRoot(main)).toBe('run/session');
    expect(companionName(child, main)).toBe('agents/agent.jsonl');
  });
});
