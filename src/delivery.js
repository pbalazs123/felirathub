// Serves SuperSubtitles files at /subfile/<token>.srt: downloads them from feliratok.eu only,
// takes the right episode out of ZIP/RAR season packs (in memory), and converts the text to UTF-8
// (most Hungarian subtitles there are Windows-1250, which players show as garbage).

const JSZip = require('jszip');
const { createExtractorFromData } = require('node-unrar-js');
const net = require('./net');
const settings = require('./settings');
const { createCache } = require('./cache');
const { SITE, isNotFoundPage, markMissing } = require('./sources/supersubtitles');

const HOUR = 60 * 60 * 1000;
const SUBTITLE_FILE = /\.(srt|ass|ssa|vtt|sub)$/i;

const files = createCache('subtitle-files', { label: 'Subtitle files', maxBytes: 32 * 1024 * 1024, persist: true });
// Kept for an hour so the next episode of a season pack doesn't download the archive again.
const archives = createCache('season-packs', { label: 'Season-pack archives', maxBytes: 64 * 1024 * 1024 });

function linkFor({ url, season, episode }) {
  const token = Buffer.from(JSON.stringify({ u: url, s: season ?? null, e: episode ?? null })).toString('base64url');
  return `/subfile/${token}.srt`;
}

// Links come from the request, so only feliratok.eu downloads are accepted; otherwise anyone
// could make the server fetch arbitrary URLs. ("originalUrl" tokens are from SuperSubtitles 1.x.)
function readLink(token) {
  const data = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
  const url = data.u ?? data.originalUrl;
  if (typeof url !== 'string' || new URL(url).origin !== SITE) throw new Error('Not a SuperSubtitles link');
  return { url, season: data.s ?? data.season ?? null, episode: data.e ?? data.episode ?? null };
}

function kindOf(buffer) {
  if (buffer.length > 3 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) return 'zip';
  if (buffer.subarray(0, 6).toString('latin1') === 'Rar!\x1a\x07') return 'rar';
  return 'text';
}

// The file for the wanted episode ("S02E05", "2x05"), else the only or first subtitle file.
function chooseFile(names, season, episode) {
  const subtitles = names.filter((name) => SUBTITLE_FILE.test(name));
  if (season && episode) {
    const s = Number(season);
    const e = Number(episode);
    const patterns = [
      new RegExp(`s0*${s}[ ._-]?e0*${e}(?!\\d)`, 'i'),
      new RegExp(`(?<!\\d)0*${s}x0*${e}(?!\\d)`, 'i')
    ];
    const match = subtitles.find((name) => patterns.some((pattern) => pattern.test(name)));
    if (match) return match;
  }
  return subtitles[0] ?? null;
}

// Reads one ZIP entry, giving up as soon as it unpacks to more than the limit (zip bombs).
function readZipEntry(entry, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    const stream = entry.internalStream('uint8array');
    stream
      .on('data', (chunk) => {
        total += chunk.length;
        if (total > maxBytes) {
          stream.pause();
          reject(new Error(`Subtitle unpacks to more than ${maxBytes} bytes`));
          return;
        }
        chunks.push(Buffer.from(chunk));
      })
      .on('error', reject)
      .on('end', () => resolve(Buffer.concat(chunks)))
      .resume();
  });
}

async function fromZip(buffer, season, episode) {
  const zip = await JSZip.loadAsync(buffer);
  const name = chooseFile(Object.keys(zip.files).filter((n) => !zip.files[n].dir), season, episode);
  if (!name) throw new Error('No subtitle in the ZIP');
  return readZipEntry(zip.file(name), settings.subtitleMaxBytes);
}

async function fromRar(buffer, season, episode) {
  const data = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const extractor = await createExtractorFromData({ data });
  const headers = [...extractor.getFileList().fileHeaders];
  const name = chooseFile(headers.map((header) => header.name), season, episode);
  if (!name) throw new Error('No subtitle in the RAR');
  const size = headers.find((header) => header.name === name).unpSize;
  if (size > settings.subtitleMaxBytes) throw new Error(`Subtitle unpacks to ${size} bytes`); // RAR bombs
  const [file] = [...extractor.extract({ files: [name] }).files];
  if (!file?.extraction) throw new Error('Could not extract the subtitle from the RAR');
  return Buffer.from(file.extraction);
}

function toUtf8(buffer) {
  if (buffer.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) return buffer;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return buffer;
  } catch {
    return Buffer.from(new TextDecoder('windows-1250').decode(buffer), 'utf8');
  }
}

// At most ARCHIVE_EXTRACT_CONCURRENCY extractions at a time (they use memory and CPU).
let running = 0;
const waiting = [];
async function limited(task) {
  if (running >= settings.extractConcurrency) await new Promise((resolve) => waiting.push(resolve));
  running += 1;
  try {
    return await task();
  } finally {
    running -= 1;
    waiting.shift()?.();
  }
}

function download(url) {
  return archives.getOrLoad(url, () => net.getBuffer(url, { maxBytes: settings.downloadMaxBytes }), (buffer) =>
    kindOf(buffer) === 'text' ? 0 : HOUR
  );
}

// A downloaded file (subtitle, ZIP or RAR) -> the subtitle for the episode, as UTF-8.
async function subtitleFrom(buffer, { season, episode } = {}) {
  const kind = kindOf(buffer);
  const subtitle =
    kind === 'zip' ? await limited(() => fromZip(buffer, season, episode))
    : kind === 'rar' ? await limited(() => fromRar(buffer, season, episode))
    : buffer;
  if (subtitle.length > settings.subtitleMaxBytes) throw new Error(`Subtitle too large (${subtitle.length} bytes)`);
  return toUtf8(subtitle);
}

function getFile(link) {
  return files.getOrLoad(
    JSON.stringify([link.url, link.season, link.episode]),
    async () => {
      const buffer = await download(link.url);
      if (isNotFoundPage(buffer)) {
        markMissing(new URL(link.url).searchParams.get('felirat'));
        throw new Error('The subtitle was deleted from feliratok.eu');
      }
      return subtitleFrom(buffer, link);
    },
    24 * HOUR
  );
}

module.exports = { linkFor, readLink, getFile, subtitleFrom };
