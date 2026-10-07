// Text helpers shared by the sources.

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

module.exports = { normalizeTitle, pad };
