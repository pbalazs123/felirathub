// Per-user settings, carried in the addon URL as JSON: /<settings>/manifest.json.
// Missing or invalid values fall back to the defaults. SuperSubtitles 1.x URLs ({"lang":"hun"}) still work.

const settings = require('./settings');

const LANGUAGES = ['hun', 'eng'];
const SOURCES = ['opensubtitles', 'supersubtitles'];

function defaults() {
  return {
    languages: [...LANGUAGES],
    sources: { opensubtitles: settings.openSubtitlesByDefault, supersubtitles: true },
    perLanguage: settings.maxSubtitlesPerLanguage,
    forced: 'show'
  };
}

function normalize(input) {
  const config = defaults();
  if (!input || typeof input !== 'object') return config;

  if (typeof input.lang === 'string' && LANGUAGES.includes(input.lang)) config.languages = [input.lang]; // 1.x
  if (Array.isArray(input.languages)) {
    const languages = input.languages.filter((language) => LANGUAGES.includes(language));
    if (languages.length) config.languages = [...new Set(languages)];
  }
  if (input.sources && typeof input.sources === 'object') {
    for (const source of SOURCES) {
      if (typeof input.sources[source] === 'boolean') config.sources[source] = input.sources[source];
    }
    if (!SOURCES.some((source) => config.sources[source])) config.sources.supersubtitles = true;
  }
  const perLanguage = Number(input.perLanguage);
  // At most 2 (older addon URLs may ask for up to 10).
  if (Number.isInteger(perLanguage) && perLanguage >= 1) config.perLanguage = Math.min(perLanguage, 2);
  // show: under their language with a [FORCED] label (works in every app); group: their own "forced"
  // language (Nuvio shows it as "Forced"; Stremio doesn't know it); hide: left out.
  if (['show', 'group', 'hide'].includes(input.forced)) config.forced = input.forced;
  return config;
}

// From the URL segment; anything unreadable gives the defaults.
function fromSegment(segment) {
  if (!segment) return defaults();
  try {
    return normalize(JSON.parse(decodeURIComponent(segment)));
  } catch {
    return defaults();
  }
}

module.exports = { defaults, normalize, fromSegment, LANGUAGES, SOURCES };
