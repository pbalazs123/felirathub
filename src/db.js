// The database for the dashboard: the request history and daily statistics, in SQLite (built into
// Node.js). Stored in DATA_DIR/felirathub.db when DATA_DIR is set, otherwise in memory only.

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const settings = require('./settings');

// If the folder can't be used (e.g. wrong permissions on a mounted folder), say so and keep the
// data in memory instead of refusing to start.
function open() {
  if (!settings.dataDir) return { db: new DatabaseSync(':memory:'), file: ':memory:' };
  const file = path.join(path.resolve(settings.dataDir), 'felirathub.db');
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    return { db: new DatabaseSync(file), file };
  } catch (error) {
    console.error(`[database] cannot use ${file} (${error.message}); keeping history in memory only. ` +
      'Check that the folder exists and is writable by the container user (uid 1000).');
    return { db: new DatabaseSync(':memory:'), file: ':memory:' };
  }
}

const { db, file } = open();
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;

  -- One row per request: what was requested, the country and only the first part of the IP.
  CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    time INTEGER NOT NULL,
    kind TEXT NOT NULL,
    detail TEXT,
    results INTEGER,
    status INTEGER NOT NULL,
    ms INTEGER NOT NULL,
    ip TEXT NOT NULL,
    country TEXT,
    url TEXT,
    files TEXT
  );
  CREATE INDEX IF NOT EXISTS requests_time ON requests (time);

  -- Daily totals without personal data.
  CREATE TABLE IF NOT EXISTS daily (
    day TEXT PRIMARY KEY,
    requests INTEGER NOT NULL DEFAULT 0,
    searches INTEGER NOT NULL DEFAULT 0,
    found INTEGER NOT NULL DEFAULT 0,
    downloads INTEGER NOT NULL DEFAULT 0,
    installs INTEGER NOT NULL DEFAULT 0,
    errors INTEGER NOT NULL DEFAULT 0,
    total_ms INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS daily_titles (
    day TEXT NOT NULL,
    title TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, title)
  );
  CREATE TABLE IF NOT EXISTS daily_sources (
    day TEXT NOT NULL,
    host TEXT NOT NULL,
    ok INTEGER NOT NULL DEFAULT 0,
    error INTEGER NOT NULL DEFAULT 0,
    total_ms INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, host)
  );
`);

// Columns added during the beta (older databases get them here): the request URL (without the
// domain); the subtitles sent, as JSON [[file name, source, name shown in the player, key], ...];
// the app that asked (e.g. "Stremio 4.4.168"); the video, as JSON { imdbId, type, name, year,
// season, episode, filename }; and for a subtitle download, the search it belongs to.
const columns = new Set(db.prepare('PRAGMA table_info(requests)').all().map((column) => column.name));
for (const [column, type] of [['url', 'TEXT'], ['files', 'TEXT'], ['client', 'TEXT'], ['meta', 'TEXT'], ['parent', 'INTEGER']]) {
  if (!columns.has(column)) db.exec(`ALTER TABLE requests ADD COLUMN ${column} ${type}`);
}
db.exec('CREATE INDEX IF NOT EXISTS requests_parent ON requests (parent)');

module.exports = { db, file, persistent: file !== ':memory:' };
