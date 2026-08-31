import type { Context } from 'hono';

/**
 * Whether a request reached this service over the loopback interface.
 *
 * # Why a mutation endpoint is loopback-only
 *
 * Starting a run spends money and reaches the public internet. That control
 * belongs to whoever is sitting at the machine, not to anything that can route
 * a packet to it. The service binds where it binds; this is the second gate.
 *
 * # How it decides
 *
 * The socket's remote address is authoritative and is used whenever the runtime
 * exposes it. The Host header is only a fallback for runtimes that do not, and
 * it is spoofable — which is why it is the fallback and not the check. A
 * request whose origin cannot be established at all is refused rather than
 * assumed local.
 */
export function isLoopbackRequest(context: Context): boolean {
  const remote = remoteAddress(context);
  if (remote !== null) {
    return isLoopbackAddress(remote);
  }

  const host = context.req.header('host');
  if (host === undefined) return false;
  return isLoopbackAddress(stripPort(host));
}

function remoteAddress(context: Context): string | null {
  // `@hono/node-server` exposes the original IncomingMessage on env. Other
  // runtimes do not, hence the careful optional walk rather than a cast.
  const env = context.env as { incoming?: { socket?: { remoteAddress?: unknown } } } | undefined;
  const address = env?.incoming?.socket?.remoteAddress;
  return typeof address === 'string' && address !== '' ? address : null;
}

function stripPort(host: string): string {
  if (host.startsWith('[')) {
    const close = host.indexOf(']');
    return close === -1 ? host : host.slice(1, close);
  }
  const colon = host.lastIndexOf(':');
  return colon === -1 ? host : host.slice(0, colon);
}

export function isLoopbackAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^::ffff:/, '');
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized.startsWith('127.')
  );
}
