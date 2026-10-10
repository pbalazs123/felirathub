// Title, aliases and year of a movie or series from Stremio's Cinemeta, cached for a day.

const net = require('./net');
const { createCache } = require('./cache');

const titles = createCache('cinemeta', { label: 'Cinemeta titles', maxEntries: 5000, persist: true });

// Cinemeta answers for the titles it knows well and redirects the rest (new and less-known ones)
// to a second server. Redirects are never followed, so that server is asked directly instead.
const SERVERS = ['https://v3-cinemeta.strem.io', 'https://cinemeta-live.strem.io'];

async function fetchMeta(type, imdbId) {
  let lastError;
  for (const server of SERVERS) {
    try {
      return (await net.getJson(`${server}/meta/${type}/${encodeURIComponent(imdbId)}.json`)).meta;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function getMeta(type, imdbId) {
  return titles.getOrLoad(
    `${type}:${imdbId}`,
    async () => {
      const meta = await fetchMeta(type, imdbId);
      if (!meta?.name) return null;
      // The second server gives the years as "2026–2026" instead of a year.
      const year = meta.year || String(meta.releaseInfo || '').match(/\d{4}/)?.[0];
      return { name: meta.name, aliases: meta.aliases || [], originalName: meta.originalName, year };
    },
    24 * 60 * 60 * 1000
  );
}

// Names to search SuperSubtitles for, best first. "Dune: Part One" is also tried as "Dune",
// because the site often lists films without their subtitle part.
function searchNames(meta) {
  if (!meta) return [];
  const names = [meta.name, ...meta.aliases, meta.originalName].filter(Boolean);
  const shortened = names.map((name) => name.split(/:\s| - /)[0].trim()).filter((name) => name.length >= 2);
  return [...new Set([...names, ...shortened])];
}

module.exports = { getMeta, searchNames };
