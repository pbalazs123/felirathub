// Outgoing HTTP: Node's built-in fetch with a timeout, response size limits, an honest user agent
// and a per-site rate limit (requests to one site start at most N per second; a request that
// would have to wait too long fails instead of piling up). Redirects are refused: none of the
// sites use them, and following one could lead the subtitle proxy elsewhere.
// A site that keeps failing is left alone for a while: "429 Too Many Requests" pauses it at once
// (for its Retry-After, 5 to 60 minutes), 3 failures in a row (5xx, timeouts, network errors) for
// 15 minutes. Requests during a pause fail at once, without touching the site.

const settings = require('./settings');
const stats = require('./stats');
const { version } = require('../package.json');
const brand = require('./brand');

const USER_AGENT = `${brand.name.replace(/\s+/g, '')}/${version} (+${brand.repository})`;
const TIMEOUT_MS = 30 * 1000;
const MAX_QUEUE_WAIT_MS = 15 * 1000;

const PAUSE_MS = 15 * 60 * 1000;
const FAILURES_BEFORE_PAUSE = 3;

const nextStartByHost = new Map();
const trouble = new Map(); // host -> { failures, pausedUntil }

function pausedUntil(host) {
  const until = trouble.get(host)?.pausedUntil ?? 0;
  return until > Date.now() ? until : null;
}

function pause(host, ms, reason) {
  const until = Date.now() + ms;
  trouble.set(host, { failures: 0, pausedUntil: until });
  console.error(`[net] ${host}: ${reason}, pausing requests until ${new Date(until).toISOString()}`);
}

function failed(host) {
  const failures = (trouble.get(host)?.failures ?? 0) + 1;
  if (failures >= FAILURES_BEFORE_PAUSE) pause(host, PAUSE_MS, `${failures} failures in a row`);
  else trouble.set(host, { failures, pausedUntil: 0 });
}

function retryAfterMs(response) {
  const seconds = Number(response.headers.get('retry-after'));
  return Math.min(60 * 60 * 1000, Math.max(5 * 60 * 1000, Number.isFinite(seconds) ? seconds * 1000 : 0));
}

async function waitForTurn(host) {
  const now = Date.now();
  const start = Math.max(now, nextStartByHost.get(host) ?? 0);
  if (start - now > MAX_QUEUE_WAIT_MS) {
    stats.recordOutgoing(host, 'rate-limited');
    throw new Error(`Too many requests queued for ${host}`);
  }
  nextStartByHost.set(host, start + 1000 / settings.requestsPerSecond);
  if (start > now) await new Promise((resolve) => setTimeout(resolve, start - now));
}

async function readBody(response, maxBytes) {
  const declared = Number(response.headers.get('content-length'));
  if (declared > maxBytes) throw new Error(`Response too large (${declared} bytes)`);

  const chunks = [];
  let total = 0;
  for await (const chunk of response.body) {
    total += chunk.length;
    if (total > maxBytes) throw new Error(`Response larger than ${maxBytes} bytes`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function get(url, { maxBytes = settings.pageMaxBytes } = {}) {
  const { protocol, host } = new URL(url);
  if (protocol !== 'https:' && protocol !== 'http:') throw new Error(`Unsupported URL: ${url}`);

  const paused = pausedUntil(host);
  if (paused) throw new Error(`${host} is paused until ${new Date(paused).toISOString()} after errors`);

  await waitForTurn(host);
  const startedAt = Date.now();
  let response;
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
  } catch (error) {
    // Timeouts and network errors (a refused redirect is our rule, not the site's fault).
    stats.recordOutgoing(host, 'error', Date.now() - startedAt);
    if (!/redirect/i.test(String(error.cause?.message || error.message))) failed(host);
    throw error;
  }
  try {
    if (response.status === 429) pause(host, retryAfterMs(response), 'HTTP 429');
    else if (response.status >= 500) failed(host);
    else trouble.delete(host);
    if (!response.ok) throw new Error(`HTTP ${response.status} from ${host}`);
    const body = await readBody(response, maxBytes);
    stats.recordOutgoing(host, 'ok', Date.now() - startedAt);
    return body;
  } catch (error) {
    stats.recordOutgoing(host, 'error', Date.now() - startedAt);
    throw error;
  }
}

module.exports = {
  USER_AGENT,
  pausedUntil,
  getBuffer: (url, options) => get(url, options),
  getText: async (url) => (await get(url)).toString('utf8'),
  getJson: async (url) => JSON.parse((await get(url)).toString('utf8'))
};
