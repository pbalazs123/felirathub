// Title, aliases and year of a movie or series from Stremio's Cinemeta, cached for a day.

const net = require('./net');
const { createCache } = require('./cache');

const titles = createCache('cinemeta', { label: 'Cinemeta titles', maxEntries: 5000, persist: true });

async function getMeta(type, imdbId) {
  return titles.getOrLoad(
    `${type}:${imdbId}`,
    async () => {
      const { meta } = await net.getJson(`https://v3-cinemeta.strem.io/meta/${type}/${encodeURIComponent(imdbId)}.json`);
      return meta ? { name: meta.name, aliases: meta.aliases || [], originalName: meta.originalName, year: meta.year } : null;
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
