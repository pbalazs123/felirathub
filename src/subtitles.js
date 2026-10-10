// Finds subtitles for one video: the server's own uploaded subtitles, OpenSubtitles, and
// SuperSubtitles only for the languages still without a subtitle (or without one that fits the
// played file well), to keep the load on feliratok.eu low; drops other episodes and returns the
// best few per language in Stremio's format.

const cinemeta = require('./cinemeta');
const delivery = require('./delivery');
const openSubtitles = require('./sources/opensubtitles');
const superSubtitles = require('./sources/supersubtitles');
const uploads = require('./uploads');
const settings = require('./settings');
const { rank } = require('./ranking');
const { pad } = require('./text');

const SOURCES = { uploaded: uploads, opensubtitles: openSubtitles, supersubtitles: superSubtitles };
const LANGUAGE_NAMES = { hun: 'Magyar', eng: 'English' };
// With a file name from the player, SuperSubtitles is also asked when OpenSubtitles' best match in a
// language is below this.
const GOOD_MATCH = 70;
// With a file name, the best this many per language are listed; without one, all of them.
const PER_LANGUAGE = 2;

// "tt0903747:1:2" -> { imdbId, season, episode }. Some players send season and episode
// only in the video ID, others only in `extra`, so both are read.
function readVideo(type, id, extra) {
  const [imdbId, idSeason, idEpisode] = String(id || '').split(':');
  const isSeries = type === 'series';
  return {
    imdbId,
    season: isSeries ? extra.season || idSeason || null : null,
    episode: isSeries ? extra.episode || idEpisode || null : null
  };
}

function describe(meta, { season, episode }) {
  if (!meta?.name) return '';
  if (season && episode) return `${meta.name} S${pad(season)}E${pad(episode)}`;
  return meta.year ? `${meta.name} (${meta.year})` : meta.name;
}

// What players get. Apps show the ID or the label as the subtitle's name, so both read like
// "Magyar · 92%" or "Magyar · Forced · 64%"; `name` is unique within the answer. Forced subtitles
// stay under their language, which every app understands.
function forPlayers(subtitle, name, video) {
  return {
    id: name,
    url: subtitle.needsProxy ? delivery.linkFor({ url: subtitle.url, ...video }) : subtitle.url,
    lang: subtitle.lang,
    label: name
  };
}

// "Magyar · 92%"; when several cards would read the same, they are numbered "#1", "#2", ...
function namesOf(subtitles) {
  const bases = subtitles.map((subtitle) =>
    [LANGUAGE_NAMES[subtitle.lang] || subtitle.lang, subtitle.forced ? 'Forced' : null, `${subtitle.match}%`].filter(Boolean).join(' · ')
  );
  const total = new Map();
  bases.forEach((base) => total.set(base, (total.get(base) || 0) + 1));
  const used = new Map();
  return bases.map((base) => {
    if (total.get(base) === 1) return base;
    used.set(base, (used.get(base) || 0) + 1);
    return `${base} #${used.get(base)}`;
  });
}

async function searchSource(source, query) {
  try {
    return await SOURCES[source].search(query);
  } catch (error) {
    console.error(`[${source}]`, error?.message || error);
    return [];
  }
}

// Returns { subtitles } for players, and for the dashboard `title`, `video` ({ imdbId, type, name,
// year, season, episode }) and `served` ([[file name, source, name shown in the player, key], ...]).
async function findSubtitles({ type, id, extra = {}, config }) {
  const video = readVideo(type, id, extra);
  if (!/^tt\d+$/.test(video.imdbId)) return { subtitles: [], title: '', video: null, served: [] };

  const meta = await cinemeta.getMeta(type, video.imdbId).catch((error) => {
    console.error('[cinemeta]', error.message);
    return null;
  });
  const query = {
    type,
    ...video,
    names: cinemeta.searchNames(meta),
    year: Number.parseInt(meta?.year, 10) || null
  };

  const ranking = {
    season: video.season,
    episode: video.episode,
    filename: extra.filename,
    // Without a file name there is nothing to rank by, so every subtitle for the video is listed.
    perLanguage: extra.filename ? PER_LANGUAGE : Infinity,
    languages: config.languages
  };

  // Uploaded subtitles and OpenSubtitles first; SuperSubtitles only for the languages still without
  // a (non-forced) subtitle, or, when the player sent the file name, without one that matches it at
  // least GOOD_MATCH %. All are then ranked together, so the better fit comes first.
  const uploaded = uploads.search(query);
  const firstChoice = [...uploaded, ...(config.sources.opensubtitles ? await searchSource('opensubtitles', query) : [])];
  let ranked = rank(firstChoice, ranking);
  const missing = config.languages.filter((language) => {
    const best = Math.max(-1, ...ranked.filter((subtitle) => subtitle.lang === language && !subtitle.forced).map((subtitle) => subtitle.match));
    return best < 0 || (extra.filename && best < GOOD_MATCH);
  });
  if (missing.length && config.sources.supersubtitles) {
    const fromSuperSubtitles = (await searchSource('supersubtitles', query)).filter((subtitle) => missing.includes(subtitle.lang));
    ranked = rank([...firstChoice, ...fromSuperSubtitles], ranking);
  }

  if (settings.debug) {
    console.log('[subtitles]', JSON.stringify({ type, id, extra, missing, returned: ranked.length }));
  }
  const names = namesOf(ranked);
  return {
    subtitles: ranked.map((subtitle, index) => forPlayers(subtitle, names[index], video)),
    title: describe(meta, video),
    video: { type, ...video, name: meta?.name || null, year: Number.parseInt(meta?.year, 10) || null },
    served: ranked.map((subtitle, index) => [subtitle.filename || subtitle.release, SOURCES[subtitle.source].name, names[index], `${subtitle.source}:${subtitle.sourceId}`])
  };
}

module.exports = { findSubtitles };
