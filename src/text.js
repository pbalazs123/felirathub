// Text helpers shared by the sources and the subtitle delivery.

// "Spider-Man: No Way Home (2021)" -> "spider man no way home"; accents removed, so titles
// written slightly differently on different sites still compare equal.
function normalizeTitle(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function pad(number) {
  return String(number).padStart(2, '0');
}

// Subtitle text as UTF-8: most Hungarian subtitles are Windows-1250, which players show as garbage.
function toUtf8(buffer) {
  if (buffer.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) return buffer;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return buffer;
  } catch {
    return Buffer.from(new TextDecoder('windows-1250').decode(buffer), 'utf8');
  }
}

module.exports = { normalizeTitle, pad, toUtf8 };
