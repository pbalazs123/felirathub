// Statistics for the dashboard: the request history (one line per request, newest first), daily totals, the
// health of the sites the addon reads from, CPU and memory. Stored in the database (src/db.js).
// Privacy (GDPR): nothing is recorded unless the dashboard is enabled; requests are deleted after
// HISTORY_DAYS (default 30); only the first part of an IP address is kept ("203.•••.•.•",
// "2001:•••"), one of a few hundred large blocks, which doesn't identify anyone; the full IP is
// used only to look up the country and is never stored; of the User-Agent only a short app label
// ("Stremio 4.4.168") is kept. Daily totals contain no personal data and are kept for 90 days.

const os = require('node:os');
const settings = require('./settings');
const { db, persistent } = require('./db');
const { countryOf } = require('./geo');

const ENABLED = Boolean(settings.dashboardPassword);
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
// A subtitle download belongs to the latest search from the same IP block that offered that
// subtitle, within this time.
const PARENT_WINDOW_MS = 6 * 60 * 60 * 1000;
const DAILY_KEEP_DAYS = 90;
const PAGE_SIZE = 50;
// Without DATA_DIR the history lives in memory, so it is also capped by size: at most this many
// requests (roughly 50 MB), the oldest are deleted first.
const MEMORY_HISTORY_ROWS = 50000;

const startedAt = Date.now();
const sites = new Map();
const dayOf = (time = Date.now()) => new Date(time).toISOString().slice(0, 10);

// 203.0.113.17 -> "203.•••.•.•", 2001:db8::1 -> "2001:•••"
function maskIp(ip) {
  if (ip.includes(':')) return `${ip.split(':')[0] || '::'}:•••`;
  const first = ip.split('.')[0];
  return /^\d+$/.test(first) ? `${first}.•••.•.•` : '•••';
}

// Installs and configure page visits count in the totals but aren't listed in Live and History.
const LISTED = "kind NOT IN ('manifest', 'configure')";

const sql = {
  insertRequest: db.prepare(`INSERT INTO requests (time, kind, detail, results, status, ms, ip, country, url, files, client, meta, parent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  parentOf: db.prepare(`SELECT id FROM requests WHERE kind = 'subtitles' AND ip = ? AND time >= ? AND files LIKE ? ESCAPE '\\'
    ORDER BY time DESC LIMIT 1`),
  addDaily: db.prepare(`INSERT INTO daily (day, requests, searches, found, downloads, installs, errors, total_ms) VALUES (?, 1, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (day) DO UPDATE SET requests = requests + 1, searches = searches + excluded.searches, found = found + excluded.found,
    downloads = downloads + excluded.downloads, installs = installs + excluded.installs, errors = errors + excluded.errors, total_ms = total_ms + excluded.total_ms`),
  addTitle: db.prepare('INSERT INTO daily_titles (day, title, count) VALUES (?, ?, 1) ON CONFLICT (day, title) DO UPDATE SET count = count + 1'),
  addSource: db.prepare(`INSERT INTO daily_sources (day, host, ok, error, total_ms) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (day, host) DO UPDATE SET ok = ok + excluded.ok, error = error + excluded.error, total_ms = total_ms + excluded.total_ms`),
  sourcesOfDay: db.prepare('SELECT host, ok, error, total_ms FROM daily_sources WHERE day = ?'),
  countSince: db.prepare('SELECT COUNT(*) AS n FROM requests WHERE time >= ?'),
  searchesSince: db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(results > 0), 0) AS found, COALESCE(ROUND(AVG(ms)), 0) AS ms
    FROM requests WHERE kind = 'subtitles' AND time >= ?`),
  errorsSince: db.prepare('SELECT COUNT(*) AS n FROM requests WHERE status >= 500 AND time >= ?'),
  popular: db.prepare(`SELECT detail AS title, COUNT(*) AS count FROM requests WHERE kind = 'subtitles' AND detail IS NOT NULL AND time >= ?
    GROUP BY detail ORDER BY count DESC LIMIT 10`),
  blocks: db.prepare(`SELECT ip, country, COUNT(*) AS requests, SUM(kind = 'subtitles') AS searches, MAX(time) AS lastSeen
    FROM requests WHERE time >= ? GROUP BY ip, country ORDER BY requests DESC LIMIT 20`),
  hourly: db.prepare('SELECT (time - ?) / ? AS bucket, COUNT(*) AS count, ROUND(AVG(ms)) AS ms FROM requests WHERE time >= ? GROUP BY bucket'),
  daily: db.prepare('SELECT * FROM daily WHERE day >= ? ORDER BY day'),
  deleteOld: db.prepare('DELETE FROM requests WHERE time < ?'),
  deleteBeyond: db.prepare('DELETE FROM requests WHERE id <= (SELECT id FROM requests ORDER BY id DESC LIMIT 1 OFFSET ?)'),
  deleteOldDaily: [
    db.prepare('DELETE FROM daily WHERE day < ?'),
    db.prepare('DELETE FROM daily_titles WHERE day < ?'),
    db.prepare('DELETE FROM daily_sources WHERE day < ?')
  ]
};

// The search a subtitle download came from (its file key, e.g. "supersubtitles:1791385505").
function parentOf(ip, time, key) {
  if (!key) return null;
  const like = `%"${String(key).replace(/[\\%_"]/g, (c) => `\\${c}`)}"%`;
  return sql.parentOf.get(ip, time - PARENT_WINDOW_MS, like)?.id ?? null;
}

// request: { time, ip, headers, kind, detail, results, status, ms, url, client,
//   files: [[file name, source, name shown in the player, key], ...], meta: { imdbId, name, year, ... } }
function recordRequest({ ip, headers, time, kind, detail, results, status, ms, url, client, files, meta }) {
  if (!ENABLED) return;
  const masked = maskIp(ip);
  const parent = kind === 'subtitle file' ? parentOf(masked, time, files?.[0]?.[3]) : null;
  sql.insertRequest.run(time, kind, detail ?? null, results ?? null, status, ms, masked, countryOf(ip, headers) || null,
    url ?? null, files?.length ? JSON.stringify(files) : null, client ?? null, meta ? JSON.stringify(meta) : null, parent);
  const search = kind === 'subtitles';
  sql.addDaily.run(dayOf(time), search ? 1 : 0, search && results > 0 ? 1 : 0, kind === 'subtitle file' ? 1 : 0,
    kind === 'manifest' ? 1 : 0, status >= 500 ? 1 : 0, ms);
  if (search && detail) sql.addTitle.run(dayOf(time), detail);
}

// Today's counters per site, continued from the database after a restart.
function siteFor(host) {
  let site = sites.get(host);
  if (!site || site.day !== dayOf()) {
    const stored = sql.sourcesOfDay.all(dayOf()).find((row) => row.host === host);
    site = { host, day: dayOf(), okToday: stored?.ok ?? 0, errorToday: stored?.error ?? 0, totalMs: stored?.total_ms ?? 0,
      timed: (stored?.ok ?? 0) + (stored?.error ?? 0), rateLimited: 0, last: null };
    sites.set(host, site);
  }
  return site;
}

// result: 'ok', 'error' or 'rate-limited' (anonymous counters about the sites the addon reads from)
function recordOutgoing(host, result, ms = 0) {
  const site = siteFor(host);
  if (result === 'rate-limited') {
    site.rateLimited += 1;
    return;
  }
  if (result === 'ok') site.okToday += 1;
  else site.errorToday += 1;
  site.totalMs += ms;
  site.timed += 1;
  site.last = { ok: result === 'ok', time: Date.now() };
  if (ENABLED) sql.addSource.run(dayOf(), host, result === 'ok' ? 1 : 0, result === 'ok' ? 0 : 1, ms);
}

function siteStats(host) {
  const site = siteFor(host);
  return {
    host,
    okToday: site.okToday,
    errorToday: site.errorToday,
    rateLimited: site.rateLimited,
    averageMs: site.timed ? Math.round(site.totalMs / site.timed) : 0,
    last: site.last
  };
}

function cleanUp() {
  sql.deleteOld.run(Date.now() - settings.historyDays * DAY);
  if (!persistent) sql.deleteBeyond.run(MEMORY_HISTORY_ROWS);
  const oldestDay = dayOf(Date.now() - DAILY_KEEP_DAYS * DAY);
  sql.deleteOldDaily.forEach((statement) => statement.run(oldestDay));
}
setInterval(cleanUp, HOUR).unref();
setTimeout(cleanUp, 10 * 1000).unref();

let cpuPercent = 0;
let lastCpu = process.cpuUsage();
let lastSample = process.hrtime.bigint();
setInterval(() => {
  const now = process.hrtime.bigint();
  const used = process.cpuUsage(lastCpu);
  const elapsedMicros = Number(now - lastSample) / 1000;
  cpuPercent = elapsedMicros > 0 ? ((used.user + used.system) / elapsedMicros) * 100 : 0;
  lastCpu = process.cpuUsage();
  lastSample = now;
}, 5000).unref();

function snapshot() {
  const now = Date.now();
  const since = (ms) => now - ms;
  const searches = sql.searchesSince.get(since(DAY));

  // The last 24 hours, one bucket per hour.
  const firstHour = Math.floor(now / HOUR) * HOUR - 23 * HOUR;
  const buckets = new Map(sql.hourly.all(firstHour, HOUR, firstHour).map((row) => [row.bucket, row]));
  const hourly = Array.from({ length: 24 }, (_, i) => ({ start: firstHour + i * HOUR, count: buckets.get(i)?.count ?? 0, averageMs: buckets.get(i)?.ms ?? 0 }));

  // The last 30 days, one entry per day (days without requests included).
  const stored = new Map(sql.daily.all(dayOf(now - 29 * DAY)).map((row) => [row.day, row]));
  const daily = Array.from({ length: 30 }, (_, i) => {
    const day = dayOf(now - (29 - i) * DAY);
    const row = stored.get(day);
    return {
      day,
      requests: row?.requests ?? 0,
      searches: row?.searches ?? 0,
      found: row?.found ?? 0,
      downloads: row?.downloads ?? 0,
      averageMs: row?.requests ? Math.round(row.total_ms / row.requests) : 0
    };
  });
  const memory = process.memoryUsage();

  return {
    now,
    startedAt,
    historyDays: settings.historyDays,
    hourly,
    daily,
    requests: {
      lastMinute: sql.countSince.get(since(60 * 1000)).n,
      last15Minutes: sql.countSince.get(since(15 * 60 * 1000)).n,
      last24Hours: sql.countSince.get(since(DAY)).n,
      searches: searches.n,
      searchesWithResults: searches.found,
      averageSearchMs: searches.ms,
      errors: sql.errorsSince.get(since(DAY)).n
    },
    popular: sql.popular.all(since(DAY)),
    blocks: sql.blocks.all(since(DAY)),
    process: { cpuPercent: Math.round(cpuPercent * 10) / 10, rss: memory.rss, heapUsed: memory.heapUsed, node: process.version },
    system: { cpus: os.cpus().length, loadAverage: os.loadavg(), totalMemory: os.totalmem(), freeMemory: os.freemem() }
  };
}

// History filter as SQL: one line per request (downloads that belong to a search are shown with
// it), optional type ("request" or "not found") and text (searched in title, URL, subtitles, app,
// IP, country and type).
function historyFilter({ search = '', kind = '' }) {
  const where = [LISTED, 'parent IS NULL'];
  const params = [];
  if (kind === 'request') where.push("kind IN ('subtitles', 'subtitle file')");
  else if (kind) {
    where.push('kind = ?');
    params.push(String(kind));
  }
  const text = String(search).trim().toLowerCase();
  if (text) {
    const like = `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const columns = ["COALESCE(detail, '')", "COALESCE(url, '')", "COALESCE(files, '')", "COALESCE(meta, '')", "COALESCE(client, '')", 'ip', "COALESCE(country, '')", 'kind'];
    where.push(`(${columns.map((column) => `LOWER(${column}) LIKE ? ESCAPE '\\'`).join(' OR ')})`);
    params.push(...columns.map(() => like));
  }
  return { where: where.join(' AND '), params };
}

// Newest first, 50 per page.
function history({ page = 1, search = '', kind = '' } = {}) {
  const { where, params } = historyFilter({ search, kind });
  const total = db.prepare(`SELECT COUNT(*) AS n FROM requests WHERE ${where}`).get(...params).n;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(Math.max(1, Number(page) || 1), pages);
  const entries = db
    .prepare(`SELECT * FROM requests WHERE ${where} ORDER BY time DESC LIMIT ? OFFSET ?`)
    .all(...params, PAGE_SIZE, (current - 1) * PAGE_SIZE);
  // The subtitle downloads of the searches on this page.
  const ids = entries.filter((entry) => entry.kind === 'subtitles').map((entry) => entry.id);
  const downloads = ids.length
    ? db.prepare(`SELECT * FROM requests WHERE parent IN (${ids.map(() => '?').join(',')}) ORDER BY time`).all(...ids)
    : [];
  for (const entry of entries) entry.downloads = downloads.filter((download) => download.parent === entry.id);
  return { total, page: current, pages, pageSize: PAGE_SIZE, entries };
}

// Deletes the given requests (with their downloads), or the whole history.
function deleteHistory(ids) {
  if (!Array.isArray(ids)) return Number(db.prepare(`DELETE FROM requests WHERE ${LISTED}`).run().changes);
  const numbers = ids.map(Number).filter(Number.isInteger).slice(0, 1000);
  if (!numbers.length) return 0;
  const list = numbers.map(() => '?').join(',');
  return Number(db.prepare(`DELETE FROM requests WHERE id IN (${list}) OR parent IN (${list})`).run(...numbers, ...numbers).changes);
}

module.exports = { MEMORY_HISTORY_ROWS, ENABLED, recordRequest, recordOutgoing, snapshot, history, deleteHistory, maskIp, siteStats };
