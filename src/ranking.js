// Orders subtitles by how well they fit what's playing and keeps the best few per language, each
// with a match percentage. Without a file name from the player, only the
// episode check applies.

const { describeRelease } = require('./release');

const WEB_SOURCES = new Set(['web', 'webdl', 'webrip']);

// How well one release fits the file being played (group, source, resolution, codec).
function releasePoints(release, playing) {
  let points = 0;
  if (playing.group && release.words.has(playing.group)) points += 3;
  if (playing.source && release.source) {
    if (playing.source === release.source) points += 2;
    else if (WEB_SOURCES.has(playing.source) && WEB_SOURCES.has(release.source)) points += 1;
  }
  if (playing.resolution && playing.resolution === release.resolution) points += 1.5;
  if (playing.codec && playing.codec === release.codec) points += 1;
  return points;
}

// Returns null for subtitles that clearly belong to another episode or season. A subtitle can fit
// several releases (SuperSubtitles lists them); the best fitting one counts.
function score(subtitle, wanted, playing) {
  const release = describeRelease(subtitle.release);

  if (wanted.season !== null && release.season !== null && release.season !== wanted.season) return null;
  if (wanted.episode !== null && release.episode !== null && release.episode !== wanted.episode) return null;

  let points = 0;
  if (wanted.episode !== null && release.episode === wanted.episode) points += 4;
  else if (release.season !== null && release.episode === null) points += 1; // season pack

  if (playing) {
    const fits = [release, ...(subtitle.releases || []).map(describeRelease)];
    points += Math.max(...fits.map((fit) => releasePoints(fit, playing)));
  }

  if (subtitle.forced) points -= 3; // only covers what a dub doesn't translate
  if (release.bonus) points -= 5; // extras, not the film or episode itself
  return points;
}

// The most points a subtitle can get for this video: the episode, plus whatever the player's file
// name tells (group, source, resolution, codec).
function maxPoints(wanted, playing) {
  let points = wanted.episode !== null ? 4 : 0;
  if (playing) {
    if (playing.group) points += 3;
    if (playing.source) points += 2;
    if (playing.resolution) points += 1.5;
    if (playing.codec) points += 1;
  }
  return points;
}

// 0-100. Being for the right title already counts as BASE points, so a subtitle for the right
// film without any matching release details isn't shown as 0%.
const BASE = 4;
function percentOf(points, max) {
  return Math.max(0, Math.min(100, Math.round(((BASE + points) / (BASE + max)) * 100)));
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

  const byLanguage = new Map(options.languages.map((language) => [language, []]));
  subtitles.forEach((subtitle, position) => {
    const points = score(subtitle, wanted, playing);
    if (points === null || !byLanguage.has(subtitle.lang)) return;
    byLanguage.get(subtitle.lang).push({ subtitle, points, position });
  });

  const max = maxPoints(wanted, playing);
  const result = [];
  for (const entries of byLanguage.values()) {
    entries.sort((a, b) => b.points - a.points || a.position - b.position);
    // Without the played file name nothing can be matched, so every subtitle shows 0%.
    result.push(...entries.slice(0, options.perLanguage).map((entry) => ({ ...entry.subtitle, match: playing ? percentOf(entry.points, max) : 0 })));
  }
  return result;
}

module.exports = { rank };
