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
  behaviorHints: { configurable: true, configurationRequired: false },
  // Proves to stremio-addons.net who owns the addon's listing there.
  stremioAddonsConfig: {
    issuer: 'https://stremio-addons.net',
    signature:
      'eyJhbGciOiJkaXIiLCJlbmMiOiJBMTI4Q0JDLUhTMjU2In0..pIrM4JSodEjW6CleHgS2nw.BiG8kjECOKfjQAGVdVueiAsOJpVREz94d1U1lJiC61nM7yac2_yX6FiS0V98hyId7CXPBoL_IO46VvuVX6SHeh2VETZSGRXN9ttgIbGaSaB1OhG5Wgn6PAiagQy0Hkfu.gsP9ekh6mhPEvangPzH1cw'
  }
};
