// The HTTP server: Stremio addon routes (manifest, subtitles), subtitle file delivery, the
// configure page, the dashboard and /health. Optional settings are the first path segment:
// /<settings>/manifest.json, /<settings>/subtitles/..., /<settings>/configure.

const http = require('node:http');
const querystring = require('node:querystring');
const settings = require('../settings');
const manifest = require('../manifest');
const stats = require('../stats');
const auth = require('./auth');
const delivery = require('../delivery');
const { clientOf } = require('../client');
const superSubtitles = require('../sources/supersubtitles');
const userConfig = require('../userConfig');
const { findSubtitles } = require('../subtitles');
const { whatsNew } = require('../whatsNew');
const { dashboardData } = require('../dashboardData');
const health = require('../health');
const { logoSvg, logoPng } = require('./logo');
const { configurePage } = require('./configurePage');
const { loginPage, dashboardPage } = require('./dashboardPage');
const { version } = require('../../package.json');

const PRIVACY_NOTICE =
  `to protect this service from abuse and overload, it keeps a request log for at most ${settings.historyDays} days: what ` +
  'was requested, by which app (e.g. Stremio), the country, and only the first part of the IP address (e.g. 203.•••.•.•), which does not identify ' +
  'you. Full IP addresses are never stored and nothing is shared. The hosting provider may keep its own access logs.';

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.statusCode = status;
  res.setHeader('Content-Type', type);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (type.startsWith('text/html')) {
    // Pages must be checked for a new version on every visit; otherwise BeamUp/Cloudflare and
    // browsers keep an old copy for hours after an update.
    // ("no-store, private": BeamUp replaces weaker values such as "no-cache" with 4 hours.)
    if (!res.hasHeader('Cache-Control')) res.setHeader('Cache-Control', 'no-store, private, max-age=0');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    res.setHeader('Referrer-Policy', 'no-referrer');
  }
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

// Dashboard responses must never be cached by a proxy or CDN (e.g. Cloudflare on BeamUp).
function noStore(res) {
  res.setHeader('Cache-Control', 'no-store, private, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex');
}

function decode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function clientAddress(req) {
  const forwarded = req.headers['cf-connecting-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0];
  return String(forwarded || req.headers['x-real-ip'] || req.socket.remoteAddress || 'unknown').trim().replace(/^::ffff:/, '');
}

function isHttps(req) {
  return String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https' || Boolean(req.socket.encrypted);
}

// Host headers are client input that ends up in pages and links (and in CDN caches), so only
// plain host names are accepted.
const VALID_HOST = /^[a-z0-9.-]+(:\d{1,5})?$|^\[[0-9a-f:.]+\](:\d{1,5})?$/i;

function publicBaseUrl(req) {
  if (settings.publicUrl) return settings.publicUrl + settings.basePath;
  const candidate = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  const host = VALID_HOST.test(candidate) ? candidate : `127.0.0.1:${settings.port}`;
  return `${isHttps(req) ? 'https' : 'http'}://${host}${settings.basePath}`;
}

async function readJsonBody(req, limit = 4096) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > limit) throw new Error('Body too large');
  }
  return JSON.parse(body || '{}');
}


const MANIFEST = /^(?:\/([^/]+))?\/manifest\.json$/;
const SUBTITLES = /^(?:\/([^/]+))?\/subtitles\/([^/]+)\/([^/]+?)(?:\/([^/]+))?\.json$/;
const CONFIGURE = /^(?:\/([^/]+))?\/configure\/?$/;
const SUBFILE = /^\/subfile\/([A-Za-z0-9_-]+)\.srt$/;

async function route(req, res, path) {
  const baseUrl = publicBaseUrl(req);

  if (path === '/health') {
    res.track = null;
    return send(res, 200, { status: 'ok', version });
  }

  let match = path === '/' ? [] : path.match(CONFIGURE);
  if (match) {
    res.track = { kind: 'configure' };
    const initial = userConfig.fromSegment(match[1]);
    return send(res, 200, configurePage({
      baseUrl,
      initial,
      defaults: userConfig.defaults(),
      privacyNotice: stats.ENABLED ? PRIVACY_NOTICE : ''
    }), 'text/html; charset=utf-8');
  }

  if ((match = path.match(MANIFEST))) {
    res.track = { kind: 'manifest' };
    return send(res, 200, { ...manifest, logo: `${baseUrl}/logo.png` }); // shown in the apps' addon list
  }

  if ((match = path.match(SUBTITLES))) {
    const [, segment, rawType, rawId, rawExtra] = match;
    const type = decode(rawType);
    const id = decode(rawId);
    if (!manifest.types.includes(type) || !id) return false;
    // `extra` is parsed from the raw segment, so an encoded "&" inside a file name stays intact.
    const extra = rawExtra ? querystring.parse(rawExtra) : {};
    const config = userConfig.fromSegment(segment);
    res.track = { kind: 'subtitles', detail: [type, id].join(' · ') };
    const { subtitles, title, video, served } = await findSubtitles({ type, id, extra, config });
    if (title) res.track.detail = [title, extra.filename].filter(Boolean).join(' · ');
    res.track.results = subtitles.length;
    res.track.files = served;
    if (video) res.track.meta = { ...video, filename: extra.filename || null };
    return send(res, 200, {
      subtitles: subtitles.map((s) => (s.url.startsWith('/') ? { ...s, url: baseUrl + s.url } : s))
    });
  }

  if ((match = path.match(SUBFILE))) {
    res.track = { kind: 'subtitle file' };
    try {
      const link = delivery.readLink(match[1]);
      res.track.detail = new URL(link.url).searchParams.get('fnev') || '';
      res.track.files = [[res.track.detail || link.url, superSubtitles.name, null, `supersubtitles:${new URL(link.url).searchParams.get('felirat')}`]];
      const file = await delivery.getFile(link);
      return send(res, 200, file, 'application/x-subrip; charset=utf-8');
    } catch (error) {
      console.error('[subfile]', error.message);
      return send(res, 502, { error: 'Could not get the subtitle' });
    }
  }

  // /favicon.ico is asked for by browsers on non-page addresses (e.g. the manifest) and by crawlers;
  // browsers accept a PNG there.
  if (path === '/logo.svg' || path === '/logo.png' || path === '/favicon.ico') {
    res.track = null;
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return path === '/logo.svg' ? send(res, 200, logoSvg, 'image/svg+xml') : send(res, 200, logoPng, 'image/png');
  }

  if (path === '/api/whats-new') {
    res.track = null;
    res.setHeader('Cache-Control', 'no-store, private, max-age=0');
    return send(res, 200, await whatsNew());
  }

  if (path === '/dashboard' || path === '/dashboard/') {
    res.track = null;
    noStore(res);
    const html = auth.isSignedIn(req) ? dashboardPage({ baseUrl }) : loginPage({ enabled: auth.enabled, baseUrl });
    return send(res, 200, html, 'text/html; charset=utf-8');
  }

  if (path === '/dashboard/login' && req.method === 'POST') {
    res.track = null;
    noStore(res);
    let password = '';
    try {
      password = String((await readJsonBody(req)).password || '');
    } catch {
      return send(res, 400, { error: 'Bad request' });
    }
    const result = auth.signIn(password, clientAddress(req), isHttps(req));
    if (result.cookie) res.setHeader('Set-Cookie', result.cookie);
    return send(res, result.status, { ok: result.status === 200 });
  }

  if (path === '/dashboard/logout' && req.method === 'POST') {
    res.track = null;
    noStore(res);
    res.setHeader('Set-Cookie', auth.signOutCookie(isHttps(req)));
    return send(res, 200, { ok: true });
  }

  if (path === '/dashboard/api/history') {
    res.track = null;
    noStore(res);
    if (!auth.isSignedIn(req)) return send(res, 401, { error: 'Sign in first' });
    const query = querystring.parse((req.url || '').split('?')[1] || '');
    return send(res, 200, stats.history({ page: query.page, search: query.search, kind: query.kind }));
  }

  if (path === '/dashboard/api/history/delete' && req.method === 'POST') {
    res.track = null;
    noStore(res);
    if (!auth.isSignedIn(req)) return send(res, 401, { error: 'Sign in first' });
    let body;
    try {
      body = await readJsonBody(req, 64 * 1024);
    } catch {
      return send(res, 400, { error: 'Bad request' });
    }
    return send(res, 200, { deleted: stats.deleteHistory(body.all ? null : body.ids || []) });
  }

  if (path === '/dashboard/api') {
    res.track = null;
    noStore(res);
    if (!auth.isSignedIn(req)) return send(res, 401, { error: 'Sign in first' });
    return send(res, 200, dashboardData());
  }

  return false;
}

function handler(req, res) {
  const startedAt = Date.now();
  res.setHeader('Access-Control-Allow-Origin', '*'); // required by the Stremio addon protocol
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || '*');
    res.statusCode = 204;
    return res.end();
  }

  let path = (req.url || '/').split('?')[0];
  if (settings.basePath) {
    if (path !== settings.basePath && !path.startsWith(`${settings.basePath}/`)) return send(res, 404, { error: 'Not found' });
    path = path.slice(settings.basePath.length) || '/';
  }

  res.on('finish', () => {
    if (!res.track) return;
    stats.recordRequest({ time: startedAt, ip: clientAddress(req), headers: req.headers, url: req.url, client: clientOf(req.headers), ...res.track, status: res.statusCode, ms: Date.now() - startedAt });
  });
  res.track = { kind: 'not found', detail: path };

  route(req, res, path)
    .then((handled) => {
      if (handled === false) send(res, 404, { error: 'Not found' });
    })
    .catch((error) => {
      console.error('[server]', error);
      if (!res.headersSent) send(res, 500, { error: 'Internal server error' });
    });
}

function start() {
  health.start();
  const server = http.createServer(handler);
  server.listen(settings.port);
  return server;
}

module.exports = { start };
