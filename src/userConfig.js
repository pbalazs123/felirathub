// Per-user settings, carried in the addon URL as JSON: /<settings>/manifest.json.
// Missing or invalid values fall back to the defaults. SuperSubtitles 1.x URLs ({"lang":"hun"}) still work;
// settings older URLs may still carry (perLanguage, forced) are ignored, as those are fixed now.

const settings = require('./settings');

const LANGUAGES = ['hun', 'eng'];
const SOURCES = ['opensubtitles', 'supersubtitles'];

function defaults() {
  return {
    languages: [...LANGUAGES],
    sources: { opensubtitles: settings.openSubtitlesByDefault, supersubtitles: true }
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
