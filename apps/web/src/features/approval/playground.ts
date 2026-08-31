import type { ApprovalCardQuestion } from './types';

/** Local UI rehearsal only — never written to a Case or backend. */
export const PLAYGROUND_QUESTIONS: readonly ApprovalCardQuestion[] = [
  {
    id: 'scope',
    title: 'How focused should the first release be?',
    options: [
      { value: 'focused', label: 'A focused starter set' },
      { value: 'broad', label: 'A broader collection' },
      { value: 'flagship', label: 'One flagship experience' },
    ],
    allowCustom: true,
    customPlaceholder: 'Describe another scope…',
  },
  {
    id: 'checks',
    title: 'Which checks should block publishing?',
    description: 'Select every check the agent must pass before it can continue.',
    multiple: true,
    options: [
      { value: 'types', label: 'Type safety' },
      { value: 'accessibility', label: 'Accessibility' },
      { value: 'registry', label: 'Registry validation' },
    ],
  },
  {
    id: 'preserve',
    title: 'Anything the agent should preserve?',
    allowCustom: true,
    customPlaceholder: 'Add a final constraint…',
  },
];
