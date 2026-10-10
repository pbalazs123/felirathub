// Browser script of the dashboard: refreshes the statistics every 5 seconds and fills the tabs.
(function () {
  var data = JSON.parse(document.getElementById('data').textContent);
  var $ = function (id) { return document.getElementById(id); };
  var api = data.baseUrl + '/dashboard/api';
  var last = null;

  var KINDS = {
    'subtitles': ['search', 'REQUEST'],
    'subtitle file': ['search', 'REQUEST'],
    'manifest': ['install', 'INSTALL'],
    'configure': ['page', 'PAGE'],
    'not found': ['missing', '404']
  };

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function bytes(n) {
    if (n == null) return '–';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB';
    return (n / 1073741824).toFixed(2) + ' GB';
  }
  function ago(time, now) {
    var s = Math.max(0, Math.round((now - time) / 1000));
    if (s < 60) return s + 's ago';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    return Math.floor(s / 3600) + 'h ago';
  }
  function duration(ms) { return ms < 1000 ? ms + ' ms' : (ms / 1000).toFixed(1) + ' s'; }
  function uptime(ms) {
    var s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    return (d ? d + 'd ' : '') + h + 'h ' + m + 'm';
  }
  function percent(part, total) { return total ? Math.round((part / total) * 100) + '%' : '–'; }
  // Flag images from flagcdn.com; only the two-letter country code is requested.
  function flag(code) {
    if (!/^[A-Z]{2}$/.test(code || '')) return '';
    return '<span class="flag"><img src="https://flagcdn.com/20x15/' + code.toLowerCase() + '.png" width="20" height="15" alt="' + code + '" title="' + code + '"></span>';
  }
  function who(r) { return flag(r.country) + ' <span class="ip">' + esc(r.ip) + '</span>'; }
  function kind(k) { var x = KINDS[k] || ['page', String(k).toUpperCase()]; return '<span class="kind ' + x[0] + '">' + esc(x[1]) + '</span>'; }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function dateTime(time) {
    var d = new Date(time);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }
  function readableUrl(url) { try { return decodeURIComponent(url || ''); } catch (e) { return url || ''; } }
  function files(r) { try { return r.files ? JSON.parse(r.files) : []; } catch (e) { return []; } }

  function meta(r) { try { return r.meta ? JSON.parse(r.meta) : null; } catch (e) { return null; } }
  function episodeOf(m) { return m && m.season && m.episode ? ' S' + pad2(m.season) + 'E' + pad2(m.episode) : ''; }
  // "The Matrix (tt0133093)", "Slow Horses S06E04 (tt5875444)"; older lines without it show their URL.
  function titleOf(r, m) {
    if (m && m.imdbId) return (m.name ? m.name + episodeOf(m) + ' (' + m.imdbId + ')' : m.imdbId + episodeOf(m));
    return r.detail || readableUrl(r.url);
  }
  // Posters from Stremio's image service, loaded only when a line is opened; the IMDb logo is the
  // official one, from Wikimedia Commons.
  function posterUrl(m) { return m && /^tt\d+$/.test(m.imdbId || '') ? 'https://images.metahub.space/poster/small/' + m.imdbId + '/img' : ''; }
  function fileLine(f, after) {
    return '<div class="file"><span class="pill">' + esc(f[1]) + '</span>' + (f[2] ? '<span class="shown">' + esc(f[2]) + '</span>' : '') +
      '<span class="fname">' + esc(f[0]) + '</span>' + (after || '') + '</div>';
  }
  // Badges: HTTP status (green 2xx, amber 4xx, red 5xx) and response time (blue under 0.5 s,
  // yellow under 2 s, red from 2 s).
  function statusBadge(status) { return '<span class="kind ' + (status >= 500 ? 'error' : status >= 400 ? 'missing' : status >= 300 ? 'page' : 'ok') + '">' + status + '</span>'; }
  function timeBadge(ms) { return '<span class="kind ' + (ms < 500 ? 'fast' : ms < 2000 ? 'medium' : 'slow') + '">' + duration(ms) + '</span>'; }
  function imdbBadge(id) {
    if (!/^tt\d+$/.test(id || '')) return '';
    return '<a class="imdb" href="https://www.imdb.com/title/' + id + '/" target="_blank" rel="noopener noreferrer" title="Open on IMDb">' +
      '<img src="https://upload.wikimedia.org/wikipedia/commons/6/69/IMDB_Logo_2016.svg" width="52" height="26" alt="IMDb"></a>';
  }
  function fact(label, value, cls) { return '<div class="fact"><span class="muted">' + label + '</span><span class="' + (cls || '') + '">' + value + '</span></div>'; }

  // Requests tab: one line per request (a search together with the subtitle downloads that followed it);
  // a click opens the poster, the app, the request and the subtitles sent and downloaded.
  var REQUEST_HEAD = [['Type'], ['IP'], ['Client ID'], ['Title'], ['Status', 'num'], ['Ended', 'num']];
  var expanded = {};
  function requestRows(r, now, first) {
    var m = meta(r);
    var open = Boolean(expanded[r.id]);
    var columns = REQUEST_HEAD.length + (first ? 1 : 0);
    var sent = r.kind === 'subtitles' ? files(r) : [];
    var byKey = {};
    sent.forEach(function (f) { if (f[3]) byKey[f[3]] = f; });
    var downloads = r.kind === 'subtitle file' ? [r] : (r.downloads || []);
    var got = downloads.map(function (d) {
      var f = files(d)[0] || [d.detail, 'SuperSubtitles'];
      var match = f[3] && byKey[f[3]];
      return fileLine([f[0], f[1], match ? match[2] : f[2]],
        '<span class="badges">' + statusBadge(d.status) + timeBadge(d.ms) + '</span><span class="muted small">' + ago(d.time + d.ms, now) + '</span>');
    });
    var poster = posterUrl(m);
    var details = '';
    if (poster || (m && m.name)) {
      // The poster opens the title on IMDb.
      var image = poster ? '<img class="cover" ' + (open ? 'src' : 'data-src') + '="' + esc(poster) + '" alt="" onerror="this.remove()">' : '';
      details += '<div class="poster">' + (image && /^tt\d+$/.test(m.imdbId || '') ? '<a href="https://www.imdb.com/title/' + m.imdbId + '/" target="_blank" rel="noopener noreferrer" title="Open on IMDb">' + image + '</a>' : image) +
        '<div class="caption"><div class="name">' + esc((m && m.name ? m.name : '') + episodeOf(m)) + '</div>' +
        (m && m.year ? '<div class="muted small">(' + esc(m.year) + ')</div>' : '') + '</div></div>';
    }
    details += '<div class="facts">' + fact('Client ID', esc(r.client || 'unknown')) + fact('Request', esc(readableUrl(r.url)), 'mono') +
      (m ? fact('File', m.filename ? esc(m.filename) : '<span class="muted">not available</span>', m.filename ? 'mono' : '') : '');
    if (r.kind === 'subtitles') {
      details += '<h4>Sent to the player (' + sent.length + ')</h4>' +
        (sent.length ? sent.map(function (f) { return fileLine(f); }).join('') : '<div class="muted">' + (r.results === 0 ? 'No subtitles found' : 'Not recorded (older request)') + '</div>');
    }
    if (r.kind === 'subtitles' || r.kind === 'subtitle file') {
      details += '<h4>Downloaded through FeliratHUB (' + got.length + ')</h4>' + (got.join('') ||
        '<div class="muted small">Nothing yet. OpenSubtitles files go straight from OpenSubtitles to the player, so only SuperSubtitles downloads show up here.</div>');
    }
    details += '</div>';
    return '<tr class="request' + (open ? ' open' : '') + '" data-request="' + r.id + '">' + (first || '') +
      '<td class="type">' + kind(r.kind) + '</td><td class="from">' + who(r) + '</td><td class="client"><span class="clip">' + esc(r.client || '–') + '</span></td><td class="title"><span class="clip">' + esc(titleOf(r, m)) + '</span></td>' +
      '<td class="status num"><span class="badges">' + statusBadge(r.status) + timeBadge(r.ms) + '</span></td>' +
      '<td class="ended num muted" title="' + dateTime(r.time) + '">' + ago(r.time + r.ms, now) + '</td></tr>' +
      '<tr class="details"' + (open ? '' : ' hidden') + '><td colspan="' + columns + '"><div class="request-details">' + details + '</div></td></tr>';
  }
  function toggleRequest(e) {
    var row = e.target.closest('tr.request');
    if (!row || e.target.closest('input')) return;
    var id = row.getAttribute('data-request');
    if (expanded[id]) delete expanded[id]; else expanded[id] = true;
    row.classList.toggle('open', Boolean(expanded[id]));
    row.nextElementSibling.hidden = !expanded[id];
    var img = row.nextElementSibling.querySelector('img[data-src]');
    if (expanded[id] && img) { img.src = img.getAttribute('data-src'); img.removeAttribute('data-src'); }
  }
  function stat(label, value, hint, cls) {
    return '<div class="card stat"><div class="label">' + label + '</div><div class="value ' + (cls || '') + '">' + value + '</div>' + (hint ? '<div class="hint">' + hint + '</div>' : '') + '</div>';
  }
  function table(head, rows, empty) {
    var header = '<tr>' + head.map(function (h) { return '<th class="' + (h[1] || '') + '">' + h[0] + '</th>'; }).join('') + '</tr>';
    return header + (rows.length ? rows.join('') : '<tr><td colspan="' + head.length + '" class="muted">' + (empty || 'Nothing yet') + '</td></tr>');
  }

  // Tabs: a tab bar on wide screens, a picker + Previous/Next on small ones (like the sections of the
  // configure page). The tab is in the address (#overview, #requests, ...), so links and the back
  // button work.
  var tabs = data.tabs;
  var tabButtons = document.querySelectorAll('#tabs button');
  var currentTab = tabs[0].id;
  function hashOf(tab) { return tab.hash || tab.id; }
  function tabFromHash() {
    var hash = location.hash.replace('#', '');
    var found = tabs.filter(function (tab) { return hashOf(tab) === hash || tab.id === hash; })[0];
    return (found || tabs[0]).id;
  }
  function goToTab(id) {
    var tab = tabs.filter(function (t) { return t.id === id; })[0];
    if (!tab) return;
    if (location.hash !== '#' + hashOf(tab)) location.hash = hashOf(tab); else showTab(id);
  }
  function showTab(id) {
    currentTab = id;
    tabButtons.forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === id); });
    document.querySelectorAll('section[data-tab]').forEach(function (section) { section.classList.toggle('active', section.getAttribute('data-tab') === id); });
    $('tab-picker').value = id;
    var ids = tabs.map(function (tab) { return tab.id; });
    var previous = tabs[ids.indexOf(id) - 1], next = tabs[ids.indexOf(id) + 1];
    $('tab-prev').disabled = !previous;
    $('tab-next').disabled = !next;
    $('tab-prev').querySelector('span').textContent = previous ? previous.title : '—';
    $('tab-next').querySelector('span').textContent = next ? next.title : '—';
    if (id === 'history') loadHistory();
  }
  function stepTab(by) {
    var ids = tabs.map(function (tab) { return tab.id; });
    goToTab(ids[ids.indexOf(currentTab) + by]);
    window.scrollTo(0, 0);
  }
  tabButtons.forEach(function (button) { button.addEventListener('click', function () { goToTab(button.getAttribute('data-tab')); }); });
  $('tab-picker').addEventListener('change', function (e) { goToTab(e.target.value); });
  $('tab-prev').addEventListener('click', function () { stepTab(-1); });
  $('tab-next').addEventListener('click', function () { stepTab(1); });
  window.addEventListener('hashchange', function () { showTab(tabFromHash()); });

  var range = 30;
  function renderDays(s) {
    var days = s.daily.slice(-range);
    $('range-label').textContent = range;
    $('chart-days-requests').innerHTML = chart(days, function (d) { return d.requests; }, String, 'hsl(262 83% 66%)', dayLabel, range > 7 ? 5 : 1);
    $('chart-days-searches').innerHTML = chart(days, function (d) { return d.searches; }, String, 'hsl(160 84% 39%)', dayLabel, range > 7 ? 5 : 1, function (d) { return d.found; });
  }
  function renderOverview(s) {
    renderDays(s);
    var r = s.requests;
    $('overview-cards').innerHTML = [
      stat('Uptime', uptime(s.now - s.startedAt), esc(data.name) + ' v' + esc(s.version)),
      stat('Requests (24 h)', r.last24Hours, r.lastMinute + ' last minute · ' + r.last15Minutes + ' last 15 min'),
      stat('Subtitle searches', r.searches, percent(r.searchesWithResults, r.searches) + ' found subtitles'),
      stat('Average search', duration(r.averageSearchMs), 'including the sources', r.averageSearchMs > 3000 ? 'warn' : ''),
      stat('Server errors', r.errors, 'responses with status 5xx', r.errors ? 'bad' : 'good')
    ].join('');
    $('sources').innerHTML = s.sources.map(function (src) {
      var label = { healthy: 'healthy', degraded: 'degraded', down: 'down', unknown: 'not checked yet' }[src.status];
      var pill = src.status === 'healthy' ? 'good' : src.status === 'degraded' ? 'warn' : src.status === 'down' ? 'bad' : '';
      return '<div class="source"><span class="dot ' + src.status + '"></span>' +
        '<div><strong>' + esc(src.name) + '</strong><small>' + esc(src.host) + '</small></div>' +
        '<div class="num">' + src.callsToday + '<small>calls today</small></div>' +
        '<div class="num">' + (src.successRate == null ? '–' : src.successRate + '%') + '<small>success</small></div>' +
        '<div class="num">' + (src.averageMs ? duration(src.averageMs) : '–') + '<small>average</small></div>' +
        (src.pausedUntil ? '<span class="pill warn" title="Too many errors; requests to this site wait">paused until ' + new Date(src.pausedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '</span>' : '<span class="pill ' + pill + '">' + label + '</span>') + '</div>';
    }).join('');
    $('popular').innerHTML = table([[''], ['Title'], ['Searches', 'num']],
      s.popular.map(function (p) {
        return '<tr><td class="badge">' + imdbBadge(p.imdbId) + '</td><td class="wrap">' + esc((p.name || p.imdbId) + episodeOf(p)) + '</td><td class="num">' + p.count + '</td></tr>';
      }));
  }



  var TILE_ICONS = {
    check: '<path d="M22 11.1V12a10 10 0 1 1-5.9-9.1"/><path d="m9 11 3 3L22 4"/>',
    db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
  };
  function tile(iconName, color, label, value, hint) {
    return '<div class="card tile"><div class="ico ' + color + '"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + TILE_ICONS[iconName] + '</svg></div>' +
      '<div><div class="label">' + label + '</div><div class="value">' + value + '</div>' + (hint ? '<div class="hint">' + hint + '</div>' : '') + '</div></div>';
  }
  // Bar chart of 24 hourly buckets, drawn as SVG.
  function hourLabel(p) { return String(new Date(p.start).getHours()).padStart(2, '0') + ':00'; }
  function dayLabel(p) { var d = new Date(p.day + 'T00:00:00'); return (d.getMonth() + 1) + '/' + d.getDate(); }
  function chart(points, value, format, color, label, every, under) {
    label = label || hourLabel;
    every = every || 4;
    var w = 600, h = 220, left = 44, bottom = 24, top = 10;
    var max = Math.max.apply(null, points.map(value).concat([1]));
    var step = (w - left) / points.length;
    var bars = points.map(function (p, i) {
      var v = value(p), bh = (v / max) * (h - bottom - top);
      var x = (left + i * step + 2).toFixed(1), bw = Math.max(1, step - 4).toFixed(1);
      var part = under ? (under(p) / max) * (h - bottom - top) : 0;
      return '<rect x="' + x + '" y="' + (h - bottom - bh).toFixed(1) + '" width="' + bw + '" height="' + bh.toFixed(1) + '" rx="3" fill="' + color + '" opacity="' + (under ? '.35' : '1') + '"><title>' + label(p) + ' · ' + format(v) + '</title></rect>' +
        (under ? '<rect x="' + x + '" y="' + (h - bottom - part).toFixed(1) + '" width="' + bw + '" height="' + part.toFixed(1) + '" rx="3" fill="' + color + '"><title>' + label(p) + ' · ' + format(under(p)) + ' found</title></rect>' : '');
    }).join('');
    var labels = points.map(function (p, i) {
      return i % every === 0 ? '<text x="' + (left + i * step + step / 2).toFixed(1) + '" y="' + (h - 6) + '" text-anchor="middle">' + label(p) + '</text>' : '';
    }).join('');
    var grid = [0, 0.5, 1].map(function (f) {
      var y = (h - bottom - f * (h - bottom - top)).toFixed(1);
      return '<line x1="' + left + '" x2="' + w + '" y1="' + y + '" y2="' + y + '" stroke="hsl(220 5% 15%)"/><text x="' + (left - 6) + '" y="' + (Number(y) + 4) + '" text-anchor="end">' + format(Math.round(max * f)) + '</text>';
    }).join('');
    return '<svg class="chart" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' + grid + bars + labels + '</svg>';
  }

  function renderCaches(s) {
    var c = s.cache, hits = 0, misses = 0, memory = 0, evictions = 0;
    c.caches.forEach(function (x) { hits += x.hits + x.diskHits; misses += x.misses; memory += x.bytes; evictions += x.evictions; });
    var total = s.requests.last24Hours, errors = s.requests.errors;
    var times = s.hourly.filter(function (b) { return b.count; });
    var avg = times.length ? Math.round(times.reduce(function (a, b) { return a + b.averageMs * b.count; }, 0) / times.reduce(function (a, b) { return a + b.count; }, 0)) : 0;
    var hitPct = hits + misses ? Math.round((hits / (hits + misses)) * 100) : 0;
    $('cache-cards').innerHTML = [
      tile('check', 'green', 'Success rate', total ? (((total - errors) / total) * 100).toFixed(1) + '%' : '–', 'requests without server errors'),
      tile('db', 'blue', 'Cache hit rate', hitPct + '%', hits + ' hits · ' + misses + ' misses'),
      tile('bolt', 'red', 'Error rate', total ? ((errors / total) * 100).toFixed(1) + '%' : '–', errors + ' server errors'),
      tile('clock', 'amber', 'Average response', duration(avg), 'last 24 hours')
    ].join('');
    $('cache-subtitle').textContent = 'In memory' + (c.disk.enabled ? ', plus a disk cache that survives restarts' : '') + '. Answers from the cache don\'t touch the sources.';
    $('cache-performance').innerHTML =
      '<div class="hitrate"><span>Hit rate</span><span class="pct">' + hitPct + '%</span></div><div class="bigbar"><span style="width:' + hitPct + '%"></span></div>' +
      '<div class="triple">' +
      '<div><div class="label">Miss rate</div><div class="value">' + (hits + misses ? 100 - hitPct : 0) + '%</div></div>' +
      '<div><div class="label">Memory</div><div class="value">' + bytes(memory) + '</div></div>' +
      '<div><div class="label">Evictions</div><div class="value">' + evictions + '</div></div>' +
      '<div><div class="label">Disk cache</div><div class="value">' + (c.disk.enabled ? bytes(c.disk.bytes) + ' · ' + c.disk.files + ' files' : 'off') + '</div></div>' +
      '</div>';
    $('chart-volume').innerHTML = chart(s.hourly, function (b) { return b.count; }, function (v) { return String(v); }, 'hsl(262 83% 66%)');
    $('chart-latency').innerHTML = chart(s.hourly, function (b) { return b.averageMs; }, function (v) { return v < 1000 ? v + ' ms' : (v / 1000).toFixed(1) + ' s'; }, 'hsl(160 84% 39%)');
    $('caches').innerHTML = table([['Cache'], ['Entries', 'num'], ['Memory', 'num'], ['Limit', 'num'], ['Hits', 'num'], ['From disk', 'num'], ['Misses', 'num'], ['Evictions', 'num'], ['Hit rate', 'num'], ['Disk']],
      c.caches.map(function (x) {
        var found = x.hits + x.diskHits;
        // data-label: on phones each value is shown under its name instead of in a column.
        var cell = function (label, value) { return '<td class="num" data-label="' + label + '">' + value + '</td>'; };
        return '<tr><td>' + esc(x.label) + '</td>' + cell('Entries', x.entries) + cell('Memory', bytes(x.bytes)) + cell('Limit', bytes(x.maxBytes)) +
          cell('Hits', x.hits) + cell('From disk', x.diskHits) + cell('Misses', x.misses) + cell('Evictions', x.evictions) + cell('Hit rate', percent(found, found + x.misses)) +
          '<td data-label="Disk">' + (x.persisted ? '<span class="pill">yes</span>' : '<span class="muted">memory only</span>') + '</td></tr>';
      }));
  }

  function level(value, warn, bad) { return value > bad ? 'bad' : value > warn ? 'warn' : 'good'; }
  function meter(label, value, text, warn, bad, scale) {
    var pct = Math.max(0, Math.min(100, scale ? (value / scale) * 100 : value));
    var cls = level(value, warn, bad);
    var color = cls === 'bad' ? 'var(--bad)' : cls === 'warn' ? 'var(--warn)' : 'var(--primary)';
    return '<div class="metric"><div class="head"><span>' + label + '</span><span class="' + cls + '">' + text + '</span></div><div class="track"><span style="width:' + pct + '%;background:' + color + '"></span></div></div>';
  }

  function renderSystem(s) {
    var p = s.process, sys = s.system, h = s.health;

    var memPct = (sys.totalMemory - sys.freeMemory) / sys.totalMemory * 100;
    var diskPct = h.disk ? h.disk.used / h.disk.total * 100 : null;
    var issues = [];
    if (memPct > 90 || p.cpuPercent > 80 || (diskPct || 0) > 90 || h.eventLoop.p99 > 1000) issues.push('critical');
    else if (memPct > 75 || p.cpuPercent > 60 || (diskPct || 0) > 75 || h.eventLoop.p99 > 100) issues.push('warning');
    s.sources.forEach(function (src) { if (src.status === 'down') issues.push('critical'); else if (src.status === 'degraded') issues.push('warning'); });
    var overall = issues.indexOf('critical') !== -1 ? 'Critical' : issues.length ? 'Warning' : 'All systems healthy';
    $('overall-status').textContent = overall;
    $('overall-status').className = 'pill ' + (overall === 'Critical' ? 'bad' : overall === 'Warning' ? 'warn' : 'good');

    var html = '<div class="metrics">' +
      meter('Memory', memPct, Math.round(memPct) + '%', 75, 90) +
      meter('CPU', p.cpuPercent, p.cpuPercent + '%', 60, 80) +
      (diskPct === null ? '' : meter('Disk', diskPct, Math.round(diskPct) + '%', 75, 90)) +
      '<div class="metric"><div class="head"><span>Throughput</span><span>' + s.requests.lastMinute + ' req/min</span></div><div class="muted small" style="margin-top:8px">' + s.requests.last15Minutes + ' in the last 15 minutes</div></div>' +
      '</div>';
    html += '<div class="block"><div class="label"><span>Event loop</span><span>worst ' + h.eventLoop.worst + ' ms since start</span></div>' +
      meter('p99 delay', h.eventLoop.p99, h.eventLoop.p99 + ' ms', 100, 1000, 1000) +
      '<div class="muted small" style="margin-top:6px">median ' + h.eventLoop.median + ' ms · mean ' + h.eventLoop.mean + ' ms. Long stalls make requests and health checks time out.</div></div>';
    if (h.container) {
      var cPct = h.container.used / h.container.limit * 100;
      html += '<div class="block"><div class="label"><span>Container memory</span><span>' + (h.container.peak ? 'peak ' + bytes(h.container.peak) + ' of ' + bytes(h.container.limit) : 'limit ' + bytes(h.container.limit)) + '</span></div>' +
        meter(bytes(h.container.used) + ' used', cPct, cPct.toFixed(1) + '%', 75, 90) +
        '<div class="muted small" style="margin-top:6px">' + bytes(p.rss) + ' used by the addon process (heap ' + bytes(p.heapUsed) + ').</div></div>';
    }
    html += '<div class="block"><div class="label"><span>Source status</span><span>calls today</span></div><div class="chips">' +
      s.sources.map(function (src) { return '<span class="chip"><span class="dot ' + src.status + '"></span>' + esc(src.name) + ' <small>' + src.callsToday + '</small></span>'; }).join('') +
      '</div></div>';
    html += '<div class="block"><div class="label"><span>Server</span><span>' + esc(p.node) + '</span></div><div class="muted small" style="margin-top:6px">' + sys.cpus + ' CPUs · load ' + sys.loadAverage.map(function (l) { return l.toFixed(2); }).join(' / ') + ' · uptime ' + uptime(s.now - s.startedAt) + '</div></div>';
    $('health').innerHTML = html;
    $('settings').innerHTML = table([['Setting'], ['Value']], s.settings.map(function (row) {
      return '<tr><td>' + esc(row[0]) + '</td><td class="wrap">' + esc(row[1]) + '</td></tr>';
    }));
  }

  // Requests tab: 50 per page, search and type filter, select and delete.
  var historyState = { page: 1, search: '', kind: '', selected: {} };
  var searchTimer = null;
  function loadHistory() {
    var q = '?page=' + historyState.page + '&search=' + encodeURIComponent(historyState.search) + '&kind=' + encodeURIComponent(historyState.kind) + '&t=' + Date.now();
    fetch(api + '/history' + q, { cache: 'no-store', credentials: 'same-origin' })
      .then(function (res) { if (res.status === 401) { location.reload(); return null; } return res.json(); })
      .then(function (h) { if (h) renderHistory(h); });
  }
  function renderHistory(h) {
    var now = Date.now();
    historyState.page = h.page;
    $('history-count').textContent = h.total + ' entries';
    if (last) $('history-subtitle').textContent = 'All requests, newest first, kept for ' + last.historyDays + ' days';
    $('history-page').textContent = 'Page ' + h.page + ' of ' + h.pages;
    $('history-prev').disabled = h.page <= 1;
    $('history-next').disabled = h.page >= h.pages;
    $('history-table').innerHTML = table(
      [['<input type="checkbox" id="history-all" aria-label="Select all">']].concat(REQUEST_HEAD),
      h.entries.map(function (r) {
        return requestRows(r, now, '<td class="check"><input type="checkbox" data-id="' + r.id + '"' + (historyState.selected[r.id] ? ' checked' : '') + '></td>');
      }), 'No requests yet.');
    var boxes = document.querySelectorAll('#history-table input[data-id]');
    boxes.forEach(function (box) {
      box.addEventListener('change', function () {
        if (box.checked) historyState.selected[box.getAttribute('data-id')] = true;
        else delete historyState.selected[box.getAttribute('data-id')];
        updateDeleteButton();
      });
    });
    $('history-all').addEventListener('change', function (e) {
      boxes.forEach(function (box) {
        box.checked = e.target.checked;
        if (box.checked) historyState.selected[box.getAttribute('data-id')] = true;
        else delete historyState.selected[box.getAttribute('data-id')];
      });
      updateDeleteButton();
    });
    updateDeleteButton();
  }
  function updateDeleteButton() {
    var count = Object.keys(historyState.selected).length;
    $('history-delete').hidden = !count;
    $('history-delete').textContent = 'Delete selected (' + count + ')';
  }
  function deleteHistory(body) {
    fetch(api + '/history/delete', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function () { historyState.selected = {}; loadHistory(); });
  }
  $('history-table').addEventListener('click', toggleRequest);
  $('range').addEventListener('click', function (e) {
    var v = e.target.getAttribute('data-value');
    if (!v) return;
    range = Number(v);
    $('range').querySelectorAll('button').forEach(function (b) { b.classList.toggle('active', b === e.target); });
    if (last) renderDays(last);
  });
  $('history-search').addEventListener('input', function (e) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () { historyState.search = e.target.value; historyState.page = 1; loadHistory(); }, 250);
  });
  $('history-kind').addEventListener('change', function (e) { historyState.kind = e.target.value; historyState.page = 1; loadHistory(); });
  $('history-prev').addEventListener('click', function () { historyState.page -= 1; loadHistory(); });
  $('history-next').addEventListener('click', function () { historyState.page += 1; loadHistory(); });
  $('history-delete').addEventListener('click', function () {
    var ids = Object.keys(historyState.selected).map(Number);
    if (ids.length && confirm('Delete ' + ids.length + ' selected entries?')) deleteHistory({ ids: ids });
  });
  $('history-clear').addEventListener('click', function () {
    if (confirm('Delete all requests?')) deleteHistory({ all: true });
  });

  function refresh() {
    fetch(api + '?t=' + Date.now(), { cache: 'no-store', credentials: 'same-origin' })
      .then(function (res) {
        if (res.status === 401) { location.reload(); return null; }
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (s) {
        if (!s) return;
        last = s;
        renderOverview(s);
        renderCaches(s);
        renderSystem(s);
        if (document.querySelector('section[data-tab="history"]').classList.contains('active')) loadHistory();
        $('status').textContent = 'Updated ' + new Date().toLocaleTimeString() + ' · refreshes every 5 seconds';
      })
      .catch(function (error) { $('status').innerHTML = '<span class="bad">Could not load statistics: ' + esc(error.message) + '</span>'; });
  }

  $('logout').addEventListener('click', function () {
    fetch(data.baseUrl + '/dashboard/logout', { method: 'POST', credentials: 'same-origin' }).then(function () { location.reload(); });
  });
  showTab(tabFromHash());
  refresh();
  setInterval(refresh, 5000);
})();
