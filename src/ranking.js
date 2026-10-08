// Orders subtitles by how well they fit what's playing and keeps the best few per language, each
// with a match percentage: how well the subtitle's release fits the played file (0% when the player
// doesn't send the file name). Other episodes and seasons are dropped.
//
// The weights follow Bazarr (subliminal's scores): whether a subtitle is in sync depends on the
// source and the release group, and for films on the edition (cut); resolution and codecs hardly
// matter. A release group only counts together with its source, and WEB-DL, WEBRip and WEB are the
// same source. For series a subtitle for the exact episode comes before a season pack with the same
// match.

const { describeRelease } = require('./release');

const WEIGHTS = {
  episode: { source: 25, group: 20, edition: 0, resolution: 1, codec: 1 },
  movie: { source: 30, group: 15, edition: 30, resolution: 1, codec: 1 }
};
// Ordering only: the exact episode before a season pack; forced subtitles (they cover just what a
// dub doesn't translate) and extras (not the film itself) last.
const EXACT_EPISODE_BONUS = 0.5;
const FORCED_PENALTY = 100;
const BONUS_PENALTY = 200;

const FAMILIES = { webdl: 'web', webrip: 'web' };
const family = (source) => FAMILIES[source] || source;

// How well one release fits the played file.
function releasePoints(release, playing, weights) {
  let points = 0;
  const sameSource = Boolean(playing.source && release.source && family(playing.source) === family(release.source));
  if (sameSource) points += weights.source;
  if (sameSource && playing.group && release.words.has(playing.group)) points += weights.group;
  if (weights.edition && release.edition === playing.edition) points += weights.edition;
  if (playing.resolution && playing.resolution === release.resolution) points += weights.resolution;
  if (playing.codec && playing.codec === release.codec) points += weights.codec;
  return points;
}

// The most a subtitle can get for this file: only what the file name tells counts.
function maxPoints(playing, weights) {
  let points = weights.edition;
  if (playing.source) points += weights.source;
  if (playing.source && playing.group) points += weights.group;
  if (playing.resolution) points += weights.resolution;
  if (playing.codec) points += weights.codec;
  return points;
}

// Returns null for subtitles that clearly belong to another episode or season, otherwise
// { match, order }. A subtitle can fit several releases (SuperSubtitles lists them); the best
// fitting one counts.
function score(subtitle, wanted, playing, weights) {
  const release = describeRelease(subtitle.release);

  if (wanted.season !== null && release.season !== null && release.season !== wanted.season) return null;
  if (wanted.episode !== null && release.episode !== null && release.episode !== wanted.episode) return null;

  // A file without episode number that isn't a season pack comes from a search for this episode.
  const seasonPack = Boolean(subtitle.seasonPack) || (release.season !== null && release.episode === null);
  let match = 0;
  if (playing) {
    // Listed releases like "720p-REWARD" don't repeat the source; it comes from the file name.
    const fits = [release, ...(subtitle.releases || []).map((name) => {
      const fit = describeRelease(name);
      return { ...fit, source: fit.source || release.source, codec: fit.codec || release.codec, edition: fit.edition || release.edition };
    })];
    match += Math.max(...fits.map((fit) => releasePoints(fit, playing, weights)));
  }
  const exactEpisode = wanted.episode !== null && !seasonPack;
  const order = match + (exactEpisode ? EXACT_EPISODE_BONUS : 0) - (subtitle.forced ? FORCED_PENALTY : 0) - (release.bonus ? BONUS_PENALTY : 0);
  return { match, order };
}

function toNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

// options: { season, episode, filename, perLanguage, languages }
// Returns the kept subtitles, each with `match` (percent).
function rank(subtitles, options) {
  const playing = options.filename ? describeRelease(options.filename) : null;
  const wanted = {
    season: toNumber(options.season) ?? playing?.season ?? null,
    episode: toNumber(options.episode) ?? playing?.episode ?? null
  };

  const weights = wanted.episode !== null ? WEIGHTS.episode : WEIGHTS.movie;
  const byLanguage = new Map(options.languages.map((language) => [language, []]));
  subtitles.forEach((subtitle, position) => {
    const result = score(subtitle, wanted, playing, weights);
    if (result === null || !byLanguage.has(subtitle.lang)) return;
    byLanguage.get(subtitle.lang).push({ subtitle, ...result, position });
  });

  const max = playing ? maxPoints(playing, weights) : 0;
  const result = [];
  for (const entries of byLanguage.values()) {
    entries.sort((a, b) => b.order - a.order || a.position - b.position);
    // Without the played file name nothing can be matched, so every subtitle shows 0%.
    result.push(...entries.slice(0, options.perLanguage).map((entry) => ({
      ...entry.subtitle,
      match: max ? Math.round((entry.match / max) * 100) : 0
    })));
  }
  return result;
}

module.exports = { rank };
