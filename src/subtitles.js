// Finds subtitles for one video: asks OpenSubtitles first and SuperSubtitles only for the languages
// OpenSubtitles has nothing in (to keep the load on feliratok.eu low), drops other episodes and
// returns the best few per language in Stremio's format.

const cinemeta = require('./cinemeta');
const delivery = require('./delivery');
const openSubtitles = require('./sources/opensubtitles');
const superSubtitles = require('./sources/supersubtitles');
const settings = require('./settings');
const { rank } = require('./ranking');
const { pad } = require('./text');

const SOURCES = { opensubtitles: openSubtitles, supersubtitles: superSubtitles };
const LANGUAGE_NAMES = { hun: 'Magyar', eng: 'English' };

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
// stay under their language, which every app understands; with the "group" setting they get the
// language code "forced" instead, which Nuvio shows as "Forced" but Stremio as "Unknown".
function forPlayers(subtitle, name, video, config) {
  return {
    id: name,
    url: subtitle.needsProxy ? delivery.linkFor({ url: subtitle.url, ...video }) : subtitle.url,
    lang: subtitle.forced && config.forced === 'group' ? 'forced' : subtitle.lang,
    label: name
  };
}

// "Magyar · 92%"; a second card with the same text gets "#2".
function namesOf(subtitles) {
  const used = new Map();
  return subtitles.map((subtitle) => {
    const base = [LANGUAGE_NAMES[subtitle.lang] || subtitle.lang, subtitle.forced ? 'Forced' : null, `${subtitle.match}%`]
      .filter(Boolean)
      .join(' · ');
    const count = (used.get(base) || 0) + 1;
    used.set(base, count);
    return count === 1 ? base : `${base} #${count}`;
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
    perLanguage: extra.filename ? config.perLanguage : Infinity,
    languages: config.languages
  };
  const usable = (found) => (config.forced === 'hide' ? found.filter((subtitle) => !subtitle.forced) : found);

  // OpenSubtitles first; SuperSubtitles only for the languages still without a (non-forced)
  // subtitle, ranked together with what OpenSubtitles found in those languages.
  const fromOpenSubtitles = config.sources.opensubtitles ? usable(await searchSource('opensubtitles', query)) : [];
  let ranked = rank(fromOpenSubtitles, ranking);
  const missing = config.languages.filter((language) => !ranked.some((subtitle) => subtitle.lang === language && !subtitle.forced));
  if (missing.length && config.sources.supersubtitles) {
    const fromSuperSubtitles = usable(await searchSource('supersubtitles', query)).filter((subtitle) => missing.includes(subtitle.lang));
    ranked = rank([...fromOpenSubtitles, ...fromSuperSubtitles], ranking);
  }

  if (settings.debug) {
    console.log('[subtitles]', JSON.stringify({ type, id, extra, missing, returned: ranked.length }));
  }
  const names = namesOf(ranked);
  return {
    subtitles: ranked.map((subtitle, index) => forPlayers(subtitle, names[index], video, config)),
    title: describe(meta, video),
    video: { type, ...video, name: meta?.name || null, year: Number.parseInt(meta?.year, 10) || null },
    served: ranked.map((subtitle, index) => [subtitle.release, SOURCES[subtitle.source].name, names[index], `${subtitle.source}:${subtitle.sourceId}`])
  };
}

module.exports = { findSubtitles };
