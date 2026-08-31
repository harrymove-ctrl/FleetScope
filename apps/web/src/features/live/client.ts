/**
 * The browser half of the Story surface.
 *
 * It does three things and nothing else: admit a run using the fixed scenario
 * id, poll the canonical cursor, and render whatever `deriveLive` says. There
 * is no local notion of progress; if the API returns no events, the page shows
 * no story.
 */

import {
  deriveLive,
  REPLAY_NOTE,
  TRUTH_LABEL,
  type Capability,
  type EventsPage,
  type LiveView,
  type RunSnapshot,
  type Truth,
} from './state';

const SCENARIO_ID = 'dependency_onboarding';
const POLL_MS = 400;

/**
 * Where the API lives.
 *
 * `?api=` is a local development affordance and is honoured ONLY for a loopback
 * host. A page that would POST to any origin a query string named could be
 * pointed at someone else's service by a link, so the check is on the parsed
 * hostname rather than on the string.
 */
export function resolveApiBase(built: string | null, search: string): string | null {
  const requested = new URLSearchParams(search).get('api');
  if (requested !== null) {
    try {
      const url = new URL(requested);
      const host = url.hostname.toLowerCase();
      if (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '::1' ||
        host.startsWith('127.')
      ) {
        return url.origin;
      }
    } catch {
      /* not a URL: fall through to the built-in value */
    }
  }
  return built;
}

const $ = (id: string): HTMLElement | null => document.getElementById(id);

const setText = (id: string, value: string | null, fallback = ''): void => {
  const node = $(id);
  if (node !== null) node.textContent = value ?? fallback;
};

function renderBeats(view: LiveView): void {
  const list = $('live-beats');
  if (list === null) return;
  list.innerHTML = '';
  for (const beat of view.beats) {
    const item = document.createElement('li');
    item.className = 'live-beat';
    item.dataset['beat'] = beat.id;
    item.dataset['status'] = beat.status;

    const label = document.createElement('span');
    label.className = 'live-beat__label';
    label.textContent = beat.label;
    item.append(label);

    const status = document.createElement('span');
    status.className = 'live-beat__status';
    // Never colour alone: the status word is always present as text.
    status.textContent =
      beat.status === 'done'
        ? beat.truth !== null
          ? TRUTH_LABEL[beat.truth]
          : 'Done'
        : beat.status === 'unknown'
          ? 'Unknown'
          : 'Pending';
    item.append(status);

    if (beat.sequence !== null) {
      const sequence = document.createElement('span');
      sequence.className = 'live-beat__seq';
      sequence.textContent = `event ${beat.sequence}`;
      item.append(sequence);
    }
    list.append(item);
  }
}

function render(view: LiveView): void {
  const root = $('live-root');
  if (root !== null) root.dataset['state'] = view.state;

  setText('live-sentence', view.sentence);
  setText('live-agent', view.agent, 'not yet observed');
  setText('live-incident', view.incidentReason, 'none');
  setText('live-policy', view.policyRationale, 'none');
  setText('live-result', view.result, 'not yet');
  setText('live-cursor', String(view.cursor));
  setText(
    'live-budget',
    view.budget === null ? null : `${view.budget.used} / ${view.budget.limit} model calls`,
    'unknown',
  );

  const delegation = $('live-delegation');
  if (delegation !== null) {
    delegation.textContent = view.delegation.text;
    delegation.dataset['observed'] = String(view.delegation.observed);
  }

  renderBeats(view);

  const cta = $('live-start') as HTMLButtonElement | null;
  if (cta !== null) {
    cta.disabled = !view.canStart;
    cta.dataset['enabled'] = String(view.canStart);
  }
  const replay = $('live-replay') as HTMLButtonElement | null;
  if (replay !== null) {
    replay.hidden = !view.canReplay;
    replay.disabled = !view.canReplay;
  }
  const blocked = $('live-blocked');
  if (blocked !== null) {
    blocked.hidden = view.blockedReason === null;
    blocked.textContent = view.blockedReason ?? '';
  }
  const waiting = $('live-awaiting');
  if (waiting !== null) waiting.hidden = view.state !== 'awaiting_agent';
  const replayNote = $('live-replay-note');
  if (replayNote !== null) replayNote.hidden = view.state !== 'historical_replay';
}

interface Session {
  capability: Capability | null;
  run: RunSnapshot | null;
  page: EventsPage | null;
  runId: string | null;
  starting: boolean;
  replaying: boolean;
  unavailableReason: string | null;
}

export function startLive(apiBase: string | null): void {
  const session: Session = {
    capability: null,
    run: null,
    page: null,
    runId: null,
    starting: false,
    replaying: false,
    unavailableReason:
      apiBase === null
        ? 'PUBLIC_API_BASE_URL is not set, so this page has no API to talk to.'
        : null,
  };

  const paint = (): void =>
    render(
      deriveLive({
        capability: session.capability,
        run: session.run,
        page: session.page,
        starting: session.starting,
        replaying: session.replaying,
        unavailableReason: session.unavailableReason,
      }),
    );

  const get = async <T>(path: string): Promise<T | null> => {
    if (apiBase === null) return null;
    try {
      const response = await fetch(`${apiBase}${path}`);
      if (!response.ok) return null;
      return (await response.json()) as T;
    } catch {
      return null;
    }
  };

  async function refreshCapability(): Promise<void> {
    const capability = await get<Capability>('/runs/capability');
    session.capability = capability;
    if (capability === null && apiBase !== null) {
      session.unavailableReason = 'The FleetScope API did not answer, so nothing can be started.';
    }
  }

  async function refreshRun(): Promise<void> {
    if (session.runId === null) return;
    const detail = await get<{ run: RunSnapshot }>(`/runs/${session.runId}`);
    session.run = detail?.run ?? null;
    // Always from zero: the page shows the whole story, and the cursor is what
    // proves a poller could resume from any point.
    session.page = await get<EventsPage>(`/runs/${session.runId}/events?after=0`);
  }

  async function tick(): Promise<void> {
    await refreshCapability();
    await refreshRun();
    paint();
  }

  $('live-start')?.addEventListener('click', () => {
    void (async () => {
      if (apiBase === null) return;
      session.starting = true;
      session.replaying = false;
      paint();
      try {
        const response = await fetch(`${apiBase}/runs`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          // The ONLY field. No prompt, target, budget or model can be sent.
          body: JSON.stringify({ scenarioId: SCENARIO_ID }),
        });
        const body = (await response.json()) as { run?: { runId?: string } };
        if (typeof body.run?.runId === 'string') session.runId = body.run.runId;
      } catch {
        session.unavailableReason = 'Starting the run failed: the API did not answer.';
      } finally {
        session.starting = false;
        await tick();
      }
    })();
  });

  $('live-replay')?.addEventListener('click', () => {
    void (async () => {
      session.replaying = true;
      // Re-reading storage is the whole of a replay. Nothing else runs.
      await tick();
      const note = $('live-replay-note');
      if (note !== null) note.textContent = REPLAY_NOTE;
    })();
  });

  void tick();
  window.setInterval(() => void tick(), POLL_MS);
}

export type { Truth };
