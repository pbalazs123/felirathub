// The sites the addon depends on, and a light health check of each: once shortly after startup and
// then every 30 minutes (one small request per site), so the dashboard shows their status before
// any real request has been made.

const net = require('./net');

const SOURCES = [
  { id: 'supersubtitles', name: 'SuperSubtitles', host: 'feliratok.eu', check: 'https://feliratok.eu/index.php?action=autoname&term=Friends&nyelv=0' },
  { id: 'opensubtitles', name: 'OpenSubtitles v3', host: 'opensubtitles-v3.strem.io', check: 'https://opensubtitles-v3.strem.io/manifest.json' },
  { id: 'cinemeta', name: 'Cinemeta', host: 'v3-cinemeta.strem.io', check: 'https://v3-cinemeta.strem.io/manifest.json' }
];

const CHECK_EVERY_MS = 30 * 60 * 1000;
const checks = new Map(); // host -> { ok, ms, time, error }

async function checkAll() {
  await Promise.all(
    SOURCES.map(async (source) => {
      const startedAt = Date.now();
      try {
        await net.getBuffer(source.check, { maxBytes: 512 * 1024 });
        checks.set(source.host, { ok: true, ms: Date.now() - startedAt, time: Date.now() });
      } catch (error) {
        checks.set(source.host, { ok: false, ms: Date.now() - startedAt, time: Date.now(), error: error.message });
      }
    })
  );
}

function start() {
  setTimeout(() => checkAll().catch(() => {}), 5000).unref();
  setInterval(() => checkAll().catch(() => {}), CHECK_EVERY_MS).unref();
}

module.exports = { SOURCES, start, lastCheck: (host) => checks.get(host) || null };
