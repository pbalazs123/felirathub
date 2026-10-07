// The Stremio addon manifest. It stays configurable after installing, so Stremio's Configure
// button reopens the settings page with the installed settings.

const { version } = require('../package.json');
const brand = require('./brand');

module.exports = {
  id: brand.addonId,
  version,
  name: brand.name,
  description: brand.tagline + ': from SuperSubtitles (feliratok.eu) and OpenSubtitles, ranked to match what you play.',
  resources: ['subtitles'],
  types: ['movie', 'series'],
  idPrefixes: ['tt'],
  catalogs: [],
  behaviorHints: { configurable: true, configurationRequired: false }
};
