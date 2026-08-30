/**
 * Stable visual identity for an agent.
 *
 * The canonical id is the seed. Keeping this calculation in one small module
 * means server-rendered cockpit rows and the browser-rendered viewer rail use
 * the same face after a refresh, reorder, or viewport change.
 */
function agentIdentityHash(agentId: string): number {
  let hash = 2166136261;
  for (const char of agentId) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

export function agentIdentityVariant(agentId: string): number {
  return agentIdentityHash(agentId) % 6;
}

export function agentIdentityEye(agentId: string): number {
  return (agentIdentityHash(agentId) >>> 8) % 3;
}
