import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';

type Resolver = (hostname: string, options: { all: true; verbatim: true }) =>
  Promise<Array<{ address: string; family: number }>>;

async function resolveWithTimeout(hostname: string, resolve: Resolver) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      resolve(hostname, { all: true, verbatim: true }),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Webhook DNS lookup timed out.')), 5_000);
      }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}
export interface WebhookDestination {
  url: URL;
  address: string;
  family: number;
}

/** Only globally routable addresses may receive server-originated webhooks. */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) ||
        (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113));
  }
  if (family !== 6) return false;
  // Restrict IPv6 to global unicast, excluding special-purpose allocations
  // (including Teredo, benchmarking, documentation, and 6to4 tunnels).
  const first = Number.parseInt(address.split(':')[0], 16);
  if (!Number.isFinite(first) || first < 0x2000 || first > 0x3fff) return false;
  const normalized = new URL('http://[' + address + ']').hostname.slice(1, -1);
  const second = Number.parseInt(normalized.split(':')[1] || '0', 16);
  return !(first === 0x2001 && (second < 0x200 || second === 0xdb8)) &&
    first !== 0x2002 && first !== 0x3fff;
}

export async function validateWebhookTarget(
  target: string,
  allowLocal = false,
  resolve: Resolver = lookup,
): Promise<WebhookDestination> {
  let url: URL;
  try { url = new URL(target); } catch { throw new Error('Webhook target must be a valid HTTPS URL.'); }
  if (url.username || url.password) throw new Error('Webhook URLs cannot contain credentials.');
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const local = allowLocal && ['127.0.0.1', '::1'].includes(hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new Error('Webhook target must use HTTPS.');
  }
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await resolveWithTimeout(hostname, resolve);
  if (!addresses.length || addresses.some(({ address }) => !(local || isPublicAddress(address)))) {
    throw new Error('Webhook target must resolve exclusively to public IP addresses.');
  }
  return { url, ...addresses[0] };
}

export async function postWebhook(target: string, payload: unknown, allowLocal = false): Promise<void> {
  // Revalidate at delivery and pin the checked IP: a second DNS lookup must
  // never turn a public destination into an internal one (DNS rebinding).
  const { url, address, family } = await validateWebhookTarget(target, allowLocal);
  const body = JSON.stringify(payload);
  await new Promise<void>((resolve, reject) => {
    const request = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = request(url, {
      method: 'POST',
      agent: false,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      lookup: (_hostname, options, callback) => {
        if (options.all) callback(null, [{ address, family }]);
        else callback(null, address, family);
      },
    }, (res) => {
      const status = res.statusCode ?? 0;
      // We only need the status; never follow redirects or retain response bodies.
      res.destroy();
      if (status >= 200 && status < 300) resolve();
      else reject(new Error('Webhook delivery failed (' + status + '). Redirects are not allowed.'));
    });
    const timer = setTimeout(() => req.destroy(new Error('Webhook delivery timed out.')), 15_000);
    req.once('close', () => clearTimeout(timer));
    req.once('error', reject);
    req.end(body);
  });
}
