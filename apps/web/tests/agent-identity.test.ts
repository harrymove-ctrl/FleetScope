import { describe, expect, it } from 'vitest';
import { agentIdentityEye, agentIdentityVariant } from '../src/lib/agent-identity';

describe('agent identity', () => {
  it('is deterministic for a canonical agent id', () => {
    expect(agentIdentityVariant('coordinator/hotel_search')).toBe(
      agentIdentityVariant('coordinator/hotel_search'),
    );
    expect(agentIdentityEye('coordinator/hotel_search')).toBe(
      agentIdentityEye('coordinator/hotel_search'),
    );
  });

  it('stays within the finite visual vocabulary', () => {
    for (const id of ['coordinator', 'coordinator/hotel_search', 'agent-runtime', '']) {
      expect(agentIdentityVariant(id)).toBeGreaterThanOrEqual(0);
      expect(agentIdentityVariant(id)).toBeLessThan(6);
      expect(agentIdentityEye(id)).toBeGreaterThanOrEqual(0);
      expect(agentIdentityEye(id)).toBeLessThan(3);
    }
  });

  it('does not use array position as identity', () => {
    const ids = ['agent-a', 'agent-b', 'agent-c'];
    const before = ids.map(agentIdentityVariant);
    const after = [...ids].reverse().map(agentIdentityVariant).reverse();
    expect(after).toEqual(before);
  });
});
