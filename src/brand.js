// The addon's own name and links, in one place so it can be renamed easily. (The SuperSubtitles
// *source*, i.e. feliratok.eu, keeps its name in src/sources/supersubtitles.js.)

module.exports = {
  name: 'FeliratHUB',
  tagline: 'Hungarian & English subtitles for Stremio',
  description:
    'FeliratHUB brings subtitles from several sources into one list: SuperSubtitles (feliratok.eu), the largest ' +
    'Hungarian subtitle site, and OpenSubtitles. It finds the right episode, takes subtitles out of season packs, ' +
    'fixes Hungarian accents, and puts the subtitles that best match the release you are playing first.',
  repository: 'https://github.com/pbalazs123/felirathub',
  // Stremio identifies installed addons by this ID; changing it forces everyone to reinstall.
  addonId: 'community.felirathub'
};
