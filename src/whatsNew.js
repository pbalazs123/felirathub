// Release notes for the "What's new" dialog: published GitHub releases (cached for an hour), plus
// CHANGELOG.md entries for versions that have no release yet.

const fs = require('node:fs');
const path = require('node:path');
const net = require('./net');
const brand = require('./brand');
const { createCache } = require('./cache');
const { version } = require('../package.json');

const cache = createCache('release-notes', { label: 'Release notes', maxEntries: 5, persist: true, hidden: true });

// "1.0.0-beta.1" -> [1, 0, 0, "beta.1"]; a version without a suffix is newer than one with it.
function parseVersion(text) {
  const match = String(text || '').replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3]), match[4] || ''] : null;
}

function compareVersions(a, b) {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x || !y) return 0;
  for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] - y[i];
  if (x[3] === y[3]) return 0;
  if (!x[3]) return 1;
  if (!y[3]) return -1;
  return x[3].localeCompare(y[3], undefined, { numeric: true });
}

// "## 1.0.0-beta.1" sections of CHANGELOG.md
function changelogEntries() {
  try {
    const text = fs.readFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), 'utf8');
    return text.split(/^## /m).slice(1).map((section) => {
      const [heading, ...body] = section.split('\n');
      return { version: heading.trim(), date: null, notes: body.join('\n').trim(), url: null };
    });
  } catch {
    return [];
  }
}

async function githubReleases() {
  const repository = new URL(brand.repository).pathname.replace(/^\/|\/$/g, '');
  return cache.getOrLoad(
    'github',
    async () => {
      const releases = await net.getJson(`https://api.github.com/repos/${repository}/releases?per_page=15`);
      return releases
        .filter((release) => !release.draft)
        .map((release) => ({
          version: release.tag_name.replace(/^v/, ''),
          date: release.published_at,
          notes: release.body || '',
          url: release.html_url
        }));
    },
    60 * 60 * 1000 // an hour, so a new release shows up soon
  );
}

async function whatsNew() {
  const releases = await githubReleases().catch((error) => {
    console.error('[whats-new]', error.message);
    return [];
  });
  const published = new Set(releases.map((release) => release.version));
  const entries = [...changelogEntries().filter((entry) => !published.has(entry.version)), ...releases]
    .sort((a, b) => compareVersions(b.version, a.version))
    .map((entry) => ({
      ...entry,
      current: entry.version === version,
      newer: compareVersions(entry.version, version) > 0
    }));
  return { current: version, development: Boolean(parseVersion(version)?.[3]), entries };
}

module.exports = { whatsNew, compareVersions };
