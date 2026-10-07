// All environment settings in one place, read once at startup.

const env = process.env;

function integer(names, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  for (const name of [].concat(names)) {
    const value = Number.parseInt(env[name] ?? '', 10);
    if (Number.isFinite(value) && value >= min && value <= max) return value;
  }
  return fallback;
}

function flag(name, fallback) {
  const value = String(env[name] ?? '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(value)) return true;
  if (['0', 'false', 'no', 'off'].includes(value)) return false;
  return fallback;
}

// "/addon/" -> "/addon", "/" or "" -> ""
function basePath(value) {
  const trimmed = String(value || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

module.exports = {
  port: integer('PORT', 7000, { max: 65535 }),
  basePath: basePath(env.APP_BASE_PATH),
  // Needed behind proxies that don't pass the real host (e.g. BeamUp).
  publicUrl: String(env.PUBLIC_URL || '').trim().replace(/\/+$/, ''),
  dashboardPassword: String(env.DASHBOARD_PASSWORD || ''),

  // Defaults for users who haven't configured the addon.
  maxSubtitlesPerLanguage: integer('MAX_SUBS_PER_LANG', 2, { max: 2 }),
  openSubtitlesByDefault: flag('OPENSUBTITLES', true),

  // Politeness towards the sites the addon reads from.
  requestsPerSecond: integer('RATE_LIMIT_PER_SECOND', 2, { max: 50 }),
  searchCacheHours: integer('SEARCH_CACHE_HOURS', 12, { max: 24 * 30 }),

  // Optional folder for the database (request history and daily statistics); without it they
  // are kept in memory only. Mount a volume there.
  dataDir: String(env.DATA_DIR || '').trim(),
  historyDays: integer('HISTORY_DAYS', 30, { max: 365 }),

  // Optional disk cache that survives restarts (mount a volume there).
  cacheDir: String(env.CACHE_DIR || '').trim(),
  cacheDirMaxMegabytes: integer('CACHE_DIR_MAX_MB', 500),

  // Size limits (old CURL_* names still work).
  pageMaxBytes: integer(['PAGE_MAX_BYTES', 'CURL_MAX_STDIO_BYTES'], 6 * 1024 * 1024),
  downloadMaxBytes: integer(['DOWNLOAD_MAX_BYTES', 'CURL_MAX_DOWNLOAD_BYTES'], 25 * 1024 * 1024),
  subtitleMaxBytes: integer('SUBTITLE_MAX_BYTES', 2 * 1024 * 1024),
  extractConcurrency: integer('ARCHIVE_EXTRACT_CONCURRENCY', 1, { max: 8 }),

  debug: flag('DEBUG_SUBS', false)
};
