// SuperSubtitles (feliratok.eu). Movies: the site's search result pages, checked against the title
// and year. Series: the show is looked up by name, then the site's JSON listing of the season gives
// episode subtitles and season packs (ZIP/RAR) together, with every release each subtitle fits; the
// search result pages are only a fallback.

const cheerio = require('cheerio');
const net = require('../net');
const settings = require('../settings');
const { createCache } = require('../cache');
const { normalizeTitle } = require('../text');

const SITE = 'https://feliratok.eu';
const LANGUAGES = { Magyar: 'hun', Angol: 'eng' };
const HOUR = 60 * 60 * 1000;

const searches = createCache('supersubtitles-searches', { label: 'SuperSubtitles searches', maxEntries: 5000, persist: true });

// The season listing can still contain deleted subtitles, whose download is a short "Felirat nem
// talalhato!" (not found) page. After such a download the subtitle is left out for a day.
const MISSING_MS = 24 * HOUR;
const missing = new Map(); // subtitle ID -> until
const isMissing = (id) => (missing.get(String(id)) ?? 0) > Date.now();

function isNotFoundPage(buffer) {
  return buffer.length < 4096 && /felirat nem tal[aá]lhat/i.test(buffer.toString('utf8'));
}

function markMissing(id) {
  if (!id) return;
  missing.set(String(id), Date.now() + MISSING_MS);
  if (missing.size > 10000) missing.delete(missing.keys().next().value);
}

function pageUrl(params) {
  const url = new URL('/index.php', SITE);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  return url.toString();
}

// One subtitle per result row. "original" is the original title with year and release info,
// e.g. "The Report (2019) (HMAX.WEBRip)"; "hungarian" is the Hungarian title, which says
// "(szinkronoshoz)" for forced subtitles meant for the Hungarian dub.
function readResults(html, { seasonPack = false } = {}) {
  const $ = cheerio.load(html);
  const results = [];

  $('tr#vilagit').each((_, element) => {
    const row = $(element);
    const lang = LANGUAGES[row.find('td.lang').first().text().trim()];
    const link = row.find('a[href*="action=letolt"]').first().attr('href');
    if (!lang || !link) return;

    const download = new URL(link, SITE);
    const file = download.searchParams.get('fnev') || '';
    const id = download.searchParams.get('felirat');
    if (!id) return;

    const hungarian = row.find('.magyar').first().text().trim();
    const original = row.find('.eredeti').first().text().trim();
    const titleAndYear = original.match(/^(.*?)\s*\((\d{4})\)/);
    const forced = /szinkronoshoz/i.test(hungarian) || /\bforced\b/i.test(`${original} ${file}`);

    results.push({
      source: 'supersubtitles',
      sourceId: id,
      lang,
      release: file || original || hungarian,
      url: download.toString(),
      needsProxy: true,
      forced,
      seasonPack: seasonPack || /\.(zip|rar)$/i.test(file),
      title: normalizeTitle(titleAndYear ? titleAndYear[1] : original || hungarian),
      year: titleAndYear ? Number(titleAndYear[2]) : null
    });
  });
  return results;
}

function unique(subtitles) {
  const seen = new Set();
  return subtitles.filter((subtitle) => !seen.has(subtitle.sourceId) && seen.add(subtitle.sourceId));
}

// A movie search finds every film containing the words ("The Matrix" also finds The Matrix
// Revolutions), so a row must carry one of the film's names exactly, within a year of Cinemeta's.
async function searchMovie({ names, year }) {
  const wanted = new Set(names.map(normalizeTitle));
  for (const name of names) {
    const rows = readResults(await net.getText(pageUrl({ search: name, tab: 'film' })));
    const matching = rows.filter(
      (row) => wanted.has(row.title) && (!year || row.year === null || Math.abs(row.year - year) <= 1)
    );
    if (matching.length) return unique(matching);
  }
  return [];
}

// Show IDs for a name, best match first.
async function findShows(name) {
  const shows = await net.getJson(pageUrl({ action: 'autoname', term: name, nyelv: 0 }));
  if (!Array.isArray(shows)) return [];
  const wanted = normalizeTitle(name);
  const closeness = (show) => {
    const title = normalizeTitle(show.name);
    if (title === wanted) return 3;
    if (title.startsWith(wanted)) return 2;
    return title.includes(wanted) ? 1 : 0;
  };
  return shows
    .map((show, position) => ({ id: String(show.ID), score: closeness(show), position }))
    .sort((a, b) => b.score - a.score || a.position - b.position)
    .map((show) => show.id);
}

// One row per subtitle and compatible release, e.g. { language: 'Magyar', nev: 'Show - 6x04
// (WEB.1080p-GROUP)', fnev: file name, felirat: subtitle ID, ep: '4', evadpakk: '0' }. The episode
// number of season packs is unreliable, so packs are kept for any episode (the episode is taken
// out of the pack on download); episode 0 rows are specials.
async function seasonListing(showId, season, episode) {
  const rows = await net.getJson(pageUrl({ action: 'xbmc', sid: showId, ev: season }));
  if (!rows || typeof rows !== 'object' || Array.isArray(rows)) return []; // [] when there is nothing
  const subtitles = new Map();
  for (const row of Object.values(rows)) {
    const lang = LANGUAGES[row?.language];
    const id = String(row?.felirat ?? '');
    if (!lang || !/^\d+$/.test(id) || !row.fnev) continue;
    const seasonPack = String(row.evadpakk) === '1';
    if (!seasonPack && Number(row.ep) !== Number(episode)) continue;
    const release = String(row.nev || '').match(/\(([^()]*)\)\s*$/)?.[1];
    const known = subtitles.get(id);
    if (known) {
      if (release) known.releases.push(release);
      continue;
    }
    subtitles.set(id, {
      source: 'supersubtitles',
      sourceId: id,
      lang,
      release: row.fnev,
      releases: release ? [release] : [],
      url: pageUrl({ action: 'letolt', fnev: row.fnev, felirat: id }),
      needsProxy: true,
      forced: /\bforced\b|szinkronoshoz/i.test(`${row.fnev} ${row.nev}`),
      seasonPack
    });
  }
  return [...subtitles.values()];
}

// The old way, two search result pages: the episode and the season packs.
async function seasonPages(showId, season, episode) {
  const show = { sid: showId, tab: 'sorozat', complexsearch: 'true', evad: season };
  const found = readResults(await net.getText(pageUrl({ ...show, epizod1: episode })));
  found.push(...readResults(await net.getText(pageUrl({ ...show, evadpakk: 'on' })), { seasonPack: true }));
  return unique(found);
}

async function searchSeries({ names, season, episode }) {
  if (!season || !episode) return [];
  for (const name of names) {
    for (const showId of await findShows(name)) {
      let found;
      try {
        found = await seasonListing(showId, season, episode);
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error; // the site is down: don't ask it again
        found = await seasonPages(showId, season, episode); // the listing changed format
      }
      if (found.length) return found;
    }
  }
  return [];
}

// query: { type, names, year, season, episode }
function search(query) {
  if (!query.names.length) return Promise.resolve([]);
  const key = JSON.stringify([query.type, query.names, query.year, query.season, query.episode]);
  return searches
    .getOrLoad(
      key,
      () => (query.type === 'movie' ? searchMovie(query) : searchSeries(query)),
      (found) => (found.length ? settings.searchCacheHours * HOUR : HOUR)
    )
    .then((found) => found.filter((subtitle) => !isMissing(subtitle.sourceId)));
}

module.exports = { name: 'SuperSubtitles', search, SITE, isNotFoundPage, markMissing };
