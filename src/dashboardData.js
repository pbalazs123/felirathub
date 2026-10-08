// Everything the dashboard shows, in one response: statistics, sources with their status,
// caches and system health.

const stats = require('./stats');
const health = require('./health');
const net = require('./net');
const settings = require('./settings');
const { file: databaseFile, persistent } = require('./db');
const { cacheStats } = require('./cache');
const { systemHealth } = require('./system');
const { version } = require('../package.json');

// From today's success rate, health checks included: under 50% down, under 90% degraded,
// no calls yet unknown.
function statusOf(site) {
  const calls = site.okToday + site.errorToday;
  if (!calls) return 'unknown';
  const successRate = site.okToday / calls;
  if (successRate < 0.5) return 'down';
  return successRate < 0.9 ? 'degraded' : 'healthy';
}

function sources() {
  return health.SOURCES.map((source) => {
    const site = stats.siteStats(source.host);
    const check = health.lastCheck(source.host);
    return {
      id: source.id,
      name: source.name,
      host: source.host,
      rateLimited: site.rateLimited,
      averageMs: site.averageMs,
      callsToday: site.okToday + site.errorToday,
      successRate: site.okToday + site.errorToday ? Math.round((site.okToday / (site.okToday + site.errorToday)) * 1000) / 10 : null,
      lastCheck: check,
      pausedUntil: net.pausedUntil(source.host),
      status: statusOf(site)
    };
  });
}

function settingsSummary() {
  return [
    ['Requests per second to each site', String(settings.requestsPerSecond)],
    ['Search results cached for', `${settings.searchCacheHours} hours (1 hour without results)`],
    ['Request history kept for', `${settings.historyDays} days${persistent ? '' : `, at most ${stats.MEMORY_HISTORY_ROWS.toLocaleString('en')} requests while in memory`} (daily totals: 90 days)`],
    ['Database', persistent ? databaseFile : settings.dataDir ? `memory only (${settings.dataDir} isn't writable)` : 'memory only (set DATA_DIR to keep history across restarts)'],
    ['Disk cache', cacheStats().disk.enabled ? `${settings.cacheDir} (max ${settings.cacheDirMaxMegabytes} MB)` : settings.cacheDir ? `off (${settings.cacheDir} isn't writable)` : 'off'],
    ['OpenSubtitles for new installs', settings.openSubtitlesByDefault ? 'on' : 'off'],
    ['Public URL', settings.publicUrl || 'from request headers'],
    ['Base path', settings.basePath || '/']
  ];
}

function dashboardData() {
  return {
    ...stats.snapshot(),
    version,
    sources: sources(),
    cache: cacheStats(),
    health: systemHealth(),
    settings: settingsSummary()
  };
}

module.exports = { dashboardData };
