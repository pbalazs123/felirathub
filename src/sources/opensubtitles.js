// OpenSubtitles through Stremio's public OpenSubtitles v3 addon (no account or API key needed).
// Its download links already convert subtitles to UTF-8, so they are passed to players directly.

const net = require('../net');
const settings = require('../settings');
const { createCache } = require('../cache');

const ADDON = 'https://opensubtitles-v3.strem.io';
const LANGUAGES = new Set(['hun', 'eng']);
const HOUR = 60 * 60 * 1000;

const searches = createCache('opensubtitles-searches', { label: 'OpenSubtitles searches', maxEntries: 5000, persist: true });

function videoId({ type, imdbId, season, episode }) {
  return type === 'series' && season && episode ? `${imdbId}:${season}:${episode}` : imdbId;
}

function toSubtitle(item, query) {
  if (!item?.url || !LANGUAGES.has(item.lang)) return null;
  // Skip results for other episodes, should the service ever return them.
  if (query.type === 'series' && item.season && item.episode) {
    if (Number(item.season) !== Number(query.season) || Number(item.episode) !== Number(query.episode)) return null;
  }
  const release = item.subtitleFileName || item.movieReleaseName || `OpenSubtitles ${item.id}`;
  return {
    source: 'opensubtitles',
    sourceId: String(item.id),
    lang: item.lang,
    release,
    url: item.url,
    needsProxy: false,
    forced: /\bforced\b/i.test(release),
    seasonPack: false
  };
}

// query: { type, imdbId, season, episode }
function search(query) {
  const id = videoId(query);
  return searches.getOrLoad(
    `${query.type}:${id}`,
    async () => {
      const response = await net.getJson(`${ADDON}/subtitles/${query.type}/${encodeURIComponent(id)}.json`);
      return (response.subtitles || []).map((item) => toSubtitle(item, query)).filter(Boolean);
    },
    (found) => (found.length ? settings.searchCacheHours * HOUR : HOUR)
  );
}

module.exports = { name: 'OpenSubtitles', search };
