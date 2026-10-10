// Subtitles the server's owner uploads on the dashboard: offered for their film or episode as the
// source "Uploaded", ranked together with the other sources. The files are kept in DATA_DIR/uploads
// (as UTF-8) and listed in the database, so uploads need a writable data folder; without one (e.g.
// when everything is kept in memory) the feature is off.

const fs = require('node:fs');
const path = require('node:path');
const settings = require('./settings');
const { db, persistent } = require('./db');
const { toUtf8 } = require('./text');

const NAME = 'Uploaded';
const LANGUAGES = ['hun', 'eng'];
const TYPES = ['movie', 'series'];
// Text subtitle formats players can load; the stored file keeps its format.
const FORMATS = {
  srt: 'application/x-subrip; charset=utf-8',
  vtt: 'text/vtt; charset=utf-8',
  ass: 'text/x-ssa; charset=utf-8',
  ssa: 'text/x-ssa; charset=utf-8'
};

function usableFolder() {
  if (!persistent || !settings.dataDir) return '';
  const folder = path.join(path.resolve(settings.dataDir), 'uploads');
  try {
    fs.mkdirSync(folder, { recursive: true });
    fs.accessSync(folder, fs.constants.W_OK);
    return folder;
  } catch (error) {
    console.error(`[uploads] cannot use ${folder} (${error.message}); uploading subtitles is off.`);
    return '';
  }
}

const folder = usableFolder();
const enabled = Boolean(folder);

db.exec(`
  -- One row per uploaded subtitle; the file is DATA_DIR/uploads/<id>.<format>.
  CREATE TABLE IF NOT EXISTS uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    time INTEGER NOT NULL,
    imdb TEXT NOT NULL,
    type TEXT NOT NULL,
    season INTEGER,
    episode INTEGER,
    title TEXT,
    year INTEGER,
    lang TEXT NOT NULL,
    forced INTEGER NOT NULL DEFAULT 0,
    release TEXT,
    filename TEXT NOT NULL,
    format TEXT NOT NULL,
    size INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS uploads_video ON uploads (imdb, season, episode);
`);

const sql = {
  insert: db.prepare(`INSERT INTO uploads (time, imdb, type, season, episode, title, year, lang, forced, release, filename, format, size)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  forMovie: db.prepare("SELECT * FROM uploads WHERE imdb = ? AND type = 'movie' ORDER BY id"),
  forEpisode: db.prepare("SELECT * FROM uploads WHERE imdb = ? AND type = 'series' AND season = ? AND episode = ? ORDER BY id"),
  byId: db.prepare('SELECT * FROM uploads WHERE id = ?'),
  all: db.prepare('SELECT * FROM uploads ORDER BY id DESC LIMIT 1000'),
  remove: db.prepare('DELETE FROM uploads WHERE id = ?')
};

const fileOf = (row) => path.join(folder, `${row.id}.${row.format}`);

function wholeNumber(value) {
  const number = Number(value);
  return value !== null && value !== undefined && value !== '' && Number.isInteger(number) && number >= 0 && number < 10000 ? number : null;
}

// One line of plain text, without control characters or path separators.
function cleanText(value, maxLength) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[\\/]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

// Stores one subtitle. Throws an Error with a message for the dashboard when something is wrong.
// input: { imdbId, type, season, episode, title, year, lang, forced, release, filename }, buffer: the file
function add(input, buffer) {
  if (!enabled) throw new Error('Uploading needs a writable data folder (DATA_DIR)');
  const imdb = String(input.imdbId || '').trim();
  if (!/^tt\d{5,10}$/.test(imdb)) throw new Error('The IMDb ID must look like tt0133093');
  if (!TYPES.includes(input.type)) throw new Error('The type must be movie or series');
  const season = input.type === 'series' ? wholeNumber(input.season) : null;
  const episode = input.type === 'series' ? wholeNumber(input.episode) : null;
  if (input.type === 'series' && (season === null || episode === null)) throw new Error('A series needs a season and an episode number');
  if (!LANGUAGES.includes(input.lang)) throw new Error('The language must be Hungarian or English');

  const filename = cleanText(path.basename(String(input.filename || '').replace(/\\/g, '/')), 200);
  const format = (filename.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
  if (!FORMATS[format]) throw new Error('The file must be an .srt, .vtt, .ass or .ssa subtitle');
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error('The file is empty');
  if (buffer.length > settings.subtitleMaxBytes) throw new Error(`The file is larger than ${Math.round(settings.subtitleMaxBytes / 1024)} KB`);
  // Subtitles are text: no archives, videos or other binary files (a zero byte gives those away;
  // UTF-16 text has them too, and players can't use that either).
  if (buffer.includes(0)) throw new Error('This is not a text subtitle file');
  const text = toUtf8(buffer);

  const row = sql.insert.run(Date.now(), imdb, input.type, season, episode, cleanText(input.title, 200) || null, wholeNumber(input.year),
    input.lang, input.forced ? 1 : 0, cleanText(input.release, 160) || null, filename, format, text.length);
  const id = Number(row.lastInsertRowid);
  try {
    fs.writeFileSync(path.join(folder, `${id}.${format}`), text);
  } catch (error) {
    sql.remove.run(id);
    throw new Error(`Could not save the file (${error.message})`);
  }
  return sql.byId.get(id);
}

// Deletes uploads by ID; returns how many were deleted.
function remove(ids) {
  let deleted = 0;
  for (const id of (Array.isArray(ids) ? ids : []).map(Number).filter(Number.isInteger).slice(0, 1000)) {
    const row = sql.byId.get(id);
    if (!row) continue;
    if (folder) fs.rmSync(fileOf(row), { force: true });
    deleted += Number(sql.remove.run(id).changes);
  }
  return deleted;
}

function list() {
  return sql.all.all();
}

// The file of an upload, for /uploaded/<id>.<format>: { content, type, filename }, or null.
function read(id, format) {
  if (!enabled) return null;
  const row = sql.byId.get(Number(id));
  if (!row || row.format !== String(format).toLowerCase()) return null;
  try {
    return { content: fs.readFileSync(fileOf(row)), type: FORMATS[row.format], filename: row.filename, id: row.id };
  } catch {
    return null;
  }
}

// The uploads for one video, as subtitles for the ranking. An upload without a release fits any
// release of the video. query: { type, imdbId, season, episode }
function search({ type, imdbId, season, episode }) {
  if (!enabled) return [];
  const rows = type === 'series'
    ? (wholeNumber(season) !== null && wholeNumber(episode) !== null ? sql.forEpisode.all(imdbId, wholeNumber(season), wholeNumber(episode)) : [])
    : sql.forMovie.all(imdbId);
  return rows.map((row) => ({
    source: 'uploaded',
    sourceId: String(row.id),
    lang: row.lang,
    release: row.release || row.filename,
    anyRelease: !row.release,
    exact: true, // assigned to this video by hand: never dropped because of its file name
    url: `/uploaded/${row.id}.${row.format}`,
    needsProxy: false,
    forced: Boolean(row.forced),
    seasonPack: false,
    filename: row.filename
  }));
}

module.exports = { name: NAME, enabled, add, remove, list, read, search, LANGUAGES, FORMATS };
