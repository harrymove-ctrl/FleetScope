/**
 * HTML poster of an ADK JSONL session — the boxed-card TUI without WASM.
 * Used by /demo so a live agy run is visible there, not only on /viewer.
 */

export type LiveTuiCard = {
  readonly id: string;
  readonly lastText: string;
  readonly tools: readonly string[];
  readonly msgs: number;
  readonly spawned: readonly string[];
};

export function parseAdkSession(jsonl: string): readonly LiveTuiCard[] {
  const cards = new Map<
    string,
    { texts: string[]; tools: string[]; spawned: string[]; msgs: number }
  >();
  const ensure = (id: string) => {
    let card = cards.get(id);
    if (!card) {
      card = { texts: [], tools: [], spawned: [], msgs: 0 };
      cards.set(id, card);
    }
    return card;
  };

  for (const line of jsonl.split('\n')) {
    if (!line.startsWith('{')) continue;
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    const author = String(event.author ?? '');
    if (!author || author === 'user') continue;
    const card = ensure(author);
    const actions = event.actions as { transferToAgent?: string } | undefined;
    if (actions?.transferToAgent) {
      card.spawned.push(actions.transferToAgent);
      ensure(actions.transferToAgent);
    }
    const content = event.content as { parts?: Array<Record<string, unknown>> } | undefined;
    for (const part of content?.parts ?? []) {
      if (typeof part.text === 'string' && part.text.trim()) {
        card.texts.push(part.text.trim());
        card.msgs += 1;
      }
      const call = part.functionCall as { name?: string } | undefined;
      if (call?.name) card.tools.push(call.name);
    }
  }

  return [...cards.entries()].map(([id, card]) => ({
    id,
    lastText: card.texts.at(-1) ?? '',
    tools: summarizeTools(card.tools),
    msgs: card.msgs,
    spawned: [...new Set(card.spawned)],
  }));
}

function summarizeTools(names: readonly string[]): readonly string[] {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts.entries()].map(([name, n]) => (n > 1 ? `${name} ×${n}` : name));
}

export function renderLiveTuiHtml(sessionId: string, cards: readonly LiveTuiCard[]): string {
  if (cards.length === 0) {
    return `<p class="live-tui__empty">Session ${escapeHtml(sessionId)} has no agent events yet.</p>`;
  }
  const root = cards.find((card) => card.id === 'chat') ?? cards[0];
  const children = cards.filter((card) => card !== root);
  return [
    `<p class="live-tui__meta">${escapeHtml(sessionId)} · ${cards.length} agents</p>`,
    `<div class="live-tui__row">${renderCard(root)}</div>`,
    children.length
      ? `<div class="live-tui__row">${children.map(renderCard).join('')}</div>`
      : '',
  ].join('');
}

function renderCard(card: LiveTuiCard): string {
  const tools = card.tools
    .slice(0, 8)
    .map((tool) => `<li>${escapeHtml(tool)}</li>`)
    .join('');
  const excerpt = card.lastText ? escapeHtml(card.lastText.slice(0, 220)) : 'no output yet';
  const spawned = card.spawned.length ? ` · ${card.spawned.length} spawned` : '';
  return `<article class="live-tui__card">
  <h3>● ${escapeHtml(card.id)}</h3>
  <p>${excerpt}</p>
  <p class="live-tui__stats">${card.msgs} msgs · ${card.tools.length} tools${spawned}</p>
  ${tools ? `<ul>${tools}</ul>` : ''}
</article>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
