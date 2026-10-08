// Reads what a release or file name says about itself, e.g.
// "Show.S02E05.1080p.WEB-DL.x265-GROUP.srt" -> season 2, episode 5, 1080p, webdl, hevc, "group";
// films also have an edition ("Movie.2010.Extended.1080p..." -> "extended", the normal cut -> "").

const FILE_EXTENSION = /\.(srt|ass|ssa|vtt|sub|zip|rar|mkv|mp4|avi|m4v|ts)$/i;

const RESOLUTIONS = [
  ['2160p', /\b(2160p|4k|uhd)\b/],
  ['1080p', /\b1080[pi]\b/],
  ['720p', /\b720p\b/],
  ['sd', /\b(480p|576p|sd)\b/]
];

const SOURCES = [
  ['webdl', /\bweb[ ._-]?dl\b/],
  ['webrip', /\bweb[ ._-]?rip\b/],
  ['web', /\bweb\b/],
  ['bluray', /\b(blu[ ._-]?ray|bd[ ._-]?rip|br[ ._-]?rip|remux|bdremux)\b/],
  ['hdtv', /\b(hdtv|pdtv|dsr|tvrip)\b/],
  ['dvd', /\b(dvd[ ._-]?rip|dvd)\b/]
];

// Cuts of a film that differ in length (and so in subtitle timing). A remaster keeps the cut, so it
// isn't one.
const EDITIONS = [
  ['extended', /\bextended\b/],
  ['directors', /\bdirector'?s?[ ._-]?cut\b|\bdc\b/],
  ['uncut', /\buncut\b/],
  ['unrated', /\bunrated\b/],
  ['final', /\bfinal[ ._-]cut\b/],
  ['imax', /\bimax\b/],
  ['special', /\bspecial[ ._-]edition\b/]
];

const CODECS = [
  ['hevc', /\b(x265|h[ ._]?265|hevc)\b/],
  ['avc', /\b(x264|h[ ._]?264|avc)\b/]
];

function firstMatch(table, text) {
  const hit = table.find(([, pattern]) => pattern.test(text));
  return hit ? hit[0] : '';
}

function describeRelease(name) {
  const text = String(name || '').toLowerCase().replace(FILE_EXTENSION, '');

  let season = null;
  let episode = null;
  const episodeMatch = text.match(/\bs(\d{1,2})[ ._-]?e(\d{1,3})\b/) || text.match(/\b(\d{1,2})x(\d{2,3})\b/);
  if (episodeMatch) {
    season = Number(episodeMatch[1]);
    episode = Number(episodeMatch[2]);
  } else {
    const seasonMatch = text.match(/\bs(\d{1,2})\b/) || text.match(/\bseason[ ._-]?(\d{1,2})\b/);
    if (seasonMatch) season = Number(seasonMatch[1]); // a season pack
  }

  const groupMatch = text.match(/-([a-z0-9]+)(?:\[[^\]]*\])?$/);

  return {
    season,
    episode,
    resolution: firstMatch(RESOLUTIONS, text),
    source: firstMatch(SOURCES, text),
    codec: firstMatch(CODECS, text),
    edition: firstMatch(EDITIONS, text),
    group: groupMatch ? groupMatch[1] : '',
    words: new Set(text.split(/[^a-z0-9]+/).filter(Boolean)),
    forced: /\bforced\b/.test(text),
    bonus: /\b(extras?|bonus|featurettes?|behind[ ._-]the[ ._-]scenes|making[ ._-]of)\b/.test(text)
  };
}

module.exports = { describeRelease };
