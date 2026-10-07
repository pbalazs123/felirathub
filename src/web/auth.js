// Dashboard sign-in: one admin password (DASHBOARD_PASSWORD), a signed session cookie, and a limit
// on failed attempts. Without DASHBOARD_PASSWORD admin sign-in is disabled.

const crypto = require('node:crypto');
const settings = require('../settings');

const COOKIE = 'ss_session';
const SESSION_MS = 12 * 60 * 60 * 1000;
const MAX_FAILURES = 5; // per client address
const MAX_TOTAL_FAILURES = 20; // overall, because client addresses can be forged
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const secret = crypto.randomBytes(32); // sessions end when the server restarts
const failures = new Map(); // client address -> recent failure times (memory only, 15 minutes)
let allFailures = []; // recent failure times from everyone

const enabled = Boolean(settings.dashboardPassword);

function sign(value) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function sameText(a, b) {
  const hash = (text) => crypto.createHash('sha256').update(String(text)).digest();
  return crypto.timingSafeEqual(hash(a), hash(b));
}

function readCookie(req, name) {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return '';
}

function isSignedIn(req) {
  if (!enabled) return false;
  const [expires, signature] = readCookie(req, COOKIE).split('.');
  if (!expires || !signature || Number(expires) < Date.now()) return false;
  return sameText(signature, sign(expires));
}

function cookie(value, maxAgeSeconds, secure) {
  return [
    `${COOKIE}=${value}`,
    `Path=${settings.basePath || '/'}`,
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAgeSeconds}`,
    secure ? 'Secure' : ''
  ].filter(Boolean).join('; ');
}

function tooManyFailures(client) {
  const recent = (time) => Date.now() - time < FAILURE_WINDOW_MS;
  failures.set(client, (failures.get(client) || []).filter(recent));
  allFailures = allFailures.filter(recent);
  return failures.get(client).length >= MAX_FAILURES || allFailures.length >= MAX_TOTAL_FAILURES;
}

// Returns { status, cookie? } for a sign-in attempt.
function signIn(password, client, secure) {
  if (!enabled) return { status: 403 };
  if (tooManyFailures(client)) return { status: 429 };
  if (!sameText(password, settings.dashboardPassword)) {
    failures.get(client).push(Date.now());
    allFailures.push(Date.now());
    return { status: 401 };
  }
  failures.delete(client);
  const expires = String(Date.now() + SESSION_MS);
  return { status: 200, cookie: cookie(`${expires}.${sign(expires)}`, SESSION_MS / 1000, secure) };
}

function signOutCookie(secure) {
  return cookie('', 0, secure);
}

setInterval(() => {
  for (const [client, times] of failures) {
    if (times.every((time) => Date.now() - time >= FAILURE_WINDOW_MS)) failures.delete(client);
  }
}, FAILURE_WINDOW_MS).unref();

module.exports = { enabled, isSignedIn, signIn, signOutCookie };
