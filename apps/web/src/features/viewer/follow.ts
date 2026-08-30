/**
 * Follow-folder pairing: pick a transcript, parse view.json, decide applies.
 *
 * IO stays in the page. This module is the pure contract so the 750ms poll
 * cannot invent a second playhead or write view state into session.jsonl.
 */

import type { Snapshot } from './shell';

export const FOLLOW_POLL_MS = 750;

export const JUMP_TO_AGENT_LATEST_LABEL = 'Jump to this agent’s latest event';

export interface FollowedFileRef {
  readonly name: string;
  readonly path: string;
  readonly size: number;
}

export type ViewCamera = 'overview' | 'follow' | 'manual';

export interface ViewState {
  readonly v: 1;
  readonly playhead: number;
  readonly paused: boolean;
  readonly selectedAgent: string | null;
  readonly camera: ViewCamera;
  readonly updatedAt: number;
  readonly writer: string;
}

function basename(path: string): string {
  const parts = path.split('/').filter((part) => part.length > 0);
  return parts[parts.length - 1] ?? path;
}

function depthOf(path: string): number {
  return path.split('/').filter((part) => part.length > 0).length;
}

/** True for the sidecar; never treat it as a session companion. */
export function isViewSidecar(path: string): boolean {
  return basename(path) === 'view.json';
}

/**
 * Prefer `session.jsonl`, else the shallowest then largest `.jsonl`.
 *
 * `.json` companions stay out of the pick: the pairing path follows a
 * transcript, not a summary file that happens to be bigger.
 */
export function pickFollowedTranscript<T extends FollowedFileRef>(files: readonly T[]): T | null {
  const jsonl = files.filter((file) => {
    if (isViewSidecar(file.path) || isViewSidecar(file.name)) return false;
    return /\.jsonl$/i.test(basename(file.path) || file.name);
  });
  if (jsonl.length === 0) return null;
  const named = jsonl.filter((file) => basename(file.path) === 'session.jsonl');
  const pool = named.length > 0 ? named : jsonl;
  const shallowest = Math.min(...pool.map((file) => depthOf(file.path)));
  const atDepth = pool.filter((file) => depthOf(file.path) === shallowest);
  return atDepth.reduce((a, b) => (a.size >= b.size ? a : b));
}

export function parseViewState(text: string): ViewState | null {
  try {
    const raw = JSON.parse(text) as Record<string, unknown>;
    if (raw.v !== 1) return null;
    if (typeof raw.playhead !== 'number' || !Number.isFinite(raw.playhead)) return null;
    if (typeof raw.paused !== 'boolean') return null;
    if (typeof raw.updatedAt !== 'number' || !Number.isFinite(raw.updatedAt)) return null;
    if (typeof raw.writer !== 'string' || raw.writer.length === 0) return null;
    if (
      raw.selectedAgent !== null &&
      raw.selectedAgent !== undefined &&
      typeof raw.selectedAgent !== 'string'
    ) {
      return null;
    }
    if (raw.camera !== 'overview' && raw.camera !== 'follow' && raw.camera !== 'manual') {
      return null;
    }
    return {
      v: 1,
      playhead: Math.trunc(raw.playhead),
      paused: raw.paused,
      selectedAgent: typeof raw.selectedAgent === 'string' ? raw.selectedAgent : null,
      camera: raw.camera,
      updatedAt: raw.updatedAt,
      writer: raw.writer,
    };
  } catch {
    return null;
  }
}

/** Apply TUI (and any non-web) writes that are newer than the last applied copy. */
export function shouldApplyRemoteView(incoming: ViewState, lastAppliedAt: number): boolean {
  return incoming.updatedAt > lastAppliedAt && incoming.writer !== 'web';
}

/**
 * Whether `agent_viewer_toggle_play` is needed to match `paused`.
 *
 * Prefer `agent_viewer_set_paused` / `agent_viewer_apply_view` when present;
 * this is the fallback so a second toggle cannot invert the intent.
 */
export function needsPlayToggle(transport: Snapshot['transport'], paused: boolean): boolean {
  const playing = transport === 'playing' || transport === 'live';
  if (paused) return playing;
  if (playing) return false;
  // Idle has nothing to resume; leave it rather than toggling into a surprise replay.
  return transport !== 'idle';
}

export function playheadIsPastLocalEvents(playhead: number, sequences: readonly number[]): boolean {
  if (sequences.length === 0) return true;
  let max = sequences[0]!;
  for (const sequence of sequences) {
    if (sequence > max) max = sequence;
  }
  return playhead > max;
}

export function serializeViewState(input: {
  playhead: number;
  paused: boolean;
  selectedAgent: string | null;
  camera: ViewCamera;
  updatedAt: number;
}): string {
  const state: ViewState = {
    v: 1,
    playhead: input.playhead,
    paused: input.paused,
    selectedAgent: input.selectedAgent,
    camera: input.camera,
    updatedAt: input.updatedAt,
    writer: 'web',
  };
  return JSON.stringify(state);
}

export function viewPausedFromTransport(transport: Snapshot['transport']): boolean {
  return transport !== 'playing' && transport !== 'live';
}
