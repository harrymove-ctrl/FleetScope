import type { ApprovalCardAnswer, ApprovalCardQuestion, ApprovalCardStatus } from './types';
import { statusLabel } from './types';

const EMPTY: ApprovalCardAnswer = { selected: [], custom: '' };

function mount(card: HTMLElement): void {
  if (card.dataset.acMounted === '1') return;
  card.dataset.acMounted = '1';

  const mode = card.dataset.mode;
  if (mode === 'recorded') return;

  const badge = card.querySelector<HTMLElement>('[data-ac-badge]');
  const resultEl = card.querySelector<HTMLElement>('[data-ac-result]');
  const titleEl = card.querySelector<HTMLElement>('[data-ac-title]');
  let status = (card.dataset.status || 'pending') as ApprovalCardStatus;
  let timer = 0;

  const setStatus = (next: ApprovalCardStatus, resultText?: string) => {
    status = next;
    card.dataset.status = next;
    if (badge) badge.textContent = statusLabel(next);
    if (resultEl && resultText) {
      resultEl.hidden = false;
      resultEl.textContent = resultText;
    }
    card.querySelectorAll<HTMLButtonElement>('[data-ac-action]').forEach((btn) => {
      btn.disabled = next !== 'pending';
    });
  };

  const finish = (next: ApprovalCardStatus, resultText: string) => {
    window.clearTimeout(timer);
    setStatus('submitting');
    timer = window.setTimeout(() => setStatus(next, resultText), 700);
  };

  if (mode === 'review') {
    card.querySelector('[data-ac-action="approve"]')?.addEventListener('click', () => {
      finish('approved', 'Publishing was approved. (Local UI only — no Case write.)');
    });
    card.querySelector('[data-ac-action="reject"]')?.addEventListener('click', () => {
      finish('rejected', 'Publishing was declined. (Local UI only — no Case write.)');
    });
    card.querySelector('[data-ac-action="changes"]')?.addEventListener('click', () => {
      finish('changes-requested', 'The agent will wait for revision notes. (Local UI only.)');
    });
    return;
  }

  if (mode !== 'questions') return;

  let questions: ApprovalCardQuestion[] = [];
  try {
    questions = JSON.parse(card.dataset.questions || '[]') as ApprovalCardQuestion[];
  } catch {
    questions = [];
  }
  if (questions.length === 0) return;

  let step = 0;
  const answers: Record<string, ApprovalCardAnswer> = {};
  const progress = card.querySelector<HTMLElement>('[data-ac-progress]');
  const qDesc = card.querySelector<HTMLElement>('[data-ac-q-desc]');
  const optionsEl = card.querySelector<HTMLElement>('[data-ac-options]');
  const customInput = card.querySelector<HTMLInputElement>('[data-ac-custom]');
  const backBtn = card.querySelector<HTMLButtonElement>('[data-ac-action="back"]');
  const continueBtn = card.querySelector<HTMLButtonElement>('[data-ac-action="continue"]');

  const currentAnswer = (): ApprovalCardAnswer => {
    const q = questions[step];
    return q ? (answers[q.id] ?? EMPTY) : EMPTY;
  };

  const answered = (answer: ApprovalCardAnswer) =>
    answer.selected.length > 0 || Boolean(answer.custom?.trim());

  const syncContinue = () => {
    if (continueBtn) continueBtn.disabled = status !== 'pending' || !answered(currentAnswer());
    if (backBtn) backBtn.disabled = status !== 'pending' || step === 0;
  };

  const render = () => {
    const q = questions[step];
    if (!q || !optionsEl || !customInput) return;
    if (titleEl) titleEl.textContent = q.title;
    if (qDesc) {
      qDesc.hidden = !q.description;
      qDesc.textContent = q.description ?? '';
    }
    if (progress) {
      progress.replaceChildren(
        ...questions.map((_, i) => {
          const dot = document.createElement('span');
          dot.className = 'ac__dot';
          dot.dataset.on = i <= step ? '1' : '0';
          return dot;
        }),
      );
    }

    const answer = currentAnswer();
    optionsEl.replaceChildren();
    for (const option of q.options ?? []) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ac__option';
      btn.dataset.multi = q.multiple ? '1' : '0';
      btn.dataset.selected = answer.selected.includes(option.value) ? '1' : '0';
      btn.disabled = status !== 'pending' || Boolean(option.disabled);
      btn.innerHTML = `<span class="ac__mark" aria-hidden="true"></span><span>${option.label}</span>`;
      btn.addEventListener('click', () => {
        const prev = currentAnswer();
        const next: ApprovalCardAnswer = q.multiple
          ? {
              selected: prev.selected.includes(option.value)
                ? prev.selected.filter((v) => v !== option.value)
                : [...prev.selected, option.value],
              custom: prev.custom,
            }
          : { selected: [option.value], custom: '' };
        answers[q.id] = next;
        if (!q.multiple) customInput.value = '';
        render();
      });
      optionsEl.append(btn);
    }

    customInput.hidden = !q.allowCustom;
    customInput.disabled = status !== 'pending';
    customInput.placeholder = q.customPlaceholder ?? 'Add another response…';
    customInput.value = answer.custom ?? '';
    syncContinue();
  };

  customInput?.addEventListener('input', () => {
    const q = questions[step];
    if (!q) return;
    const prev = currentAnswer();
    answers[q.id] = {
      selected: q.multiple ? prev.selected : [],
      custom: customInput.value,
    };
    syncContinue();
  });

  backBtn?.addEventListener('click', () => {
    if (step > 0) {
      step -= 1;
      render();
    }
  });

  continueBtn?.addEventListener('click', () => {
    if (!answered(currentAnswer())) return;
    if (step < questions.length - 1) {
      step += 1;
      render();
      return;
    }
    finish('answered', `${questions.length} responses captured locally. No Case write.`);
  });

  render();
}

export function mountApprovalCards(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-approval-card]').forEach(mount);
}
