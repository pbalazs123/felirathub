// The dashboard at /dashboard: a sign-in screen, and after signing in the statistics with tabs.
// Admin sign-in is disabled when DASHBOARD_PASSWORD isn't set. There is no guest access.

const fs = require('node:fs');
const path = require('node:path');
const { page, escapeHtml } = require('./theme');
const { version } = require('../../package.json');
const brand = require('../brand');
const settings = require('../settings');
const name = escapeHtml(brand.name);

const script = fs.readFileSync(path.join(__dirname, 'dashboard.client.js'), 'utf8');

const ICON_SHIELD = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
const ICON_KEY = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.3-9.3M17 6l3 3M15 8l2 2"/></svg>';

const loginStyles = `
<style>
.center { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
.dialog { width: min(520px, 100%); }
.dialog h1 { font-size: 1.35rem; display: flex; align-items: center; gap: 10px; }
.choice { width: 100%; display: flex; gap: 14px; align-items: center; text-align: left; padding: 16px; margin-top: 18px;
  border: 1px solid var(--border); border-radius: 12px; background: var(--card); color: var(--text); font: inherit; cursor: pointer; }
.choice:hover:not(:disabled) { border-color: hsl(220 5% 35%); }
.choice:disabled { cursor: not-allowed; opacity: .55; }
.choice strong { display: block; }
form { margin-top: 14px; display: none; }
form.open { display: block; }
.error { color: var(--bad); min-height: 1.4em; margin-top: 8px; }
.back { margin-top: 22px; display: inline-block; text-decoration: none; font-weight: 600; }
</style>`;

function loginPage({ enabled, baseUrl }) {
  const body = `
<div class="center">
  <div class="card dialog">
    <h1>${ICON_SHIELD} Dashboard Access</h1>
    <p class="muted" style="margin:6px 0 0">Sign in to see how this ${name} instance is doing.</p>
    <button class="choice" id="admin" ${enabled ? '' : 'disabled'}>
      ${ICON_KEY}
      <span><strong>Admin Login</strong>
      <span class="muted small">${enabled ? 'Full access to all dashboard features' : 'Disabled: DASHBOARD_PASSWORD is not set on this instance'}</span></span>
    </button>
    <form id="login">
      <input type="password" id="password" placeholder="Password" autocomplete="current-password" required>
      <div class="error" id="error"></div>
      <button class="btn primary" type="submit" style="width:100%">Sign in</button>
    </form>
    <a class="back" href="${escapeHtml(baseUrl)}/configure">Go Back</a>
  </div>
</div>
<script>
(function () {
  var form = document.getElementById('login');
  var admin = document.getElementById('admin');
  admin.addEventListener('click', function () { form.classList.add('open'); document.getElementById('password').focus(); });
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var error = document.getElementById('error');
    error.textContent = '';
    fetch(${JSON.stringify(baseUrl + '/dashboard/login').replace(/</g, '\\u003c')}, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: document.getElementById('password').value })
    }).then(function (res) {
      if (res.ok) { location.reload(); return; }
      error.textContent = res.status === 429 ? 'Too many attempts. Try again in 15 minutes.' : 'Wrong password.';
    }).catch(function () { error.textContent = 'Could not reach the server.'; });
  });
})();
</script>`;
  return page({ title: `${brand.name} - Dashboard`, body, head: loginStyles });
}

const dashboardStyles = `
<style>
header { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 16px; padding: 14px 24px; border-bottom: 1px solid var(--border); position: sticky; top: 0; background: var(--bg); z-index: 5; }
header h1 { font-size: 1.15rem; }
header .end { display: flex; justify-content: flex-end; gap: 10px; align-items: center; }
main { padding: 24px; max-width: 1400px; margin: 0 auto; }
section[data-tab] { display: none; }
section[data-tab].active { display: block; }
.title-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
.title-row h2 { font-size: 1.8rem; }
.stat .label { color: var(--muted-text); font-size: .78rem; text-transform: uppercase; letter-spacing: .04em; }
.stat .value { font-size: 1.7rem; font-weight: 700; margin-top: 4px; }
.stat .hint { color: var(--muted-text); font-size: .8rem; margin-top: 2px; }
.card h2 { font-size: 1.05rem; margin-bottom: 12px; }
.scroll { overflow-x: auto; }
.flag { display: inline-flex; gap: 6px; align-items: center; }
.flag img { border-radius: 2px; }
.ip { display: inline-block; font: 12px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; padding: 1px 8px; border: 1px solid var(--border); border-radius: 6px; color: var(--muted-text); }
.kind { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: .72rem; font-weight: 700; letter-spacing: .03em; border: 1px solid; }
.kind.search { color: hsl(160 60% 55%); border-color: hsl(160 50% 25%); background: hsl(160 50% 10%); }
.kind.download { color: hsl(210 80% 70%); border-color: hsl(210 50% 30%); background: hsl(210 50% 12%); }
.kind.install { color: hsl(270 70% 75%); border-color: hsl(270 40% 30%); background: hsl(270 40% 12%); }
.kind.page { color: var(--muted-text); border-color: var(--border); background: var(--muted); }
.kind.missing { color: var(--warn); border-color: hsl(38 60% 30%); background: hsl(38 60% 10%); }
.kind.ok { color: var(--good); border-color: hsl(142 45% 25%); background: hsl(142 45% 9%); }
.kind.error { color: var(--bad); border-color: hsl(0 50% 32%); background: hsl(0 50% 11%); }
.kind.fast { color: hsl(200 85% 68%); border-color: hsl(200 50% 28%); background: hsl(200 50% 10%); font-weight: 600; }
.kind.medium { color: hsl(50 90% 62%); border-color: hsl(50 55% 26%); background: hsl(50 55% 9%); font-weight: 600; }
.kind.slow { color: hsl(340 80% 70%); border-color: hsl(340 45% 30%); background: hsl(340 45% 11%); font-weight: 600; }
.badges { display: inline-flex; gap: 6px; justify-content: flex-end; }
/* Fixed widths so the status and time badges line up from row to row. */
.badges .kind { text-align: center; min-width: 40px; }
.badges .kind.fast, .badges .kind.medium, .badges .kind.slow { min-width: 62px; }
.toolbar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 14px; }
.toolbar input[type=text] { flex: 1; min-width: 220px; }
.toolbar select { width: auto; min-width: 160px; }
.btn.danger { color: var(--bad); border-color: hsl(0 50% 30%); background: hsl(0 50% 10%); }
.requests tr.request { cursor: pointer; }
.requests tr.request:hover td, .requests tr.request.open td { background: var(--muted); }
.requests tr.request.open td { border-bottom-color: transparent; }
.requests td.title .clip { display: block; max-width: 520px; overflow: hidden; text-overflow: ellipsis; }
.requests td.client .clip { display: block; max-width: 220px; overflow: hidden; text-overflow: ellipsis; color: var(--muted-text); font-size: .85rem; }
.requests tr.details td { white-space: normal; background: var(--muted); padding: 6px 14px 16px; }
.request-details { display: flex; gap: 20px; align-items: flex-start; }
.request-details .poster { flex: none; width: 110px; text-align: center; }
.request-details .poster img { display: block; width: 110px; height: 163px; object-fit: cover; border-radius: 10px; border: 1px solid var(--border); background: var(--bg); margin-bottom: 8px; }
.request-details .poster .name { font-weight: 600; line-height: 1.3; }
.request-details .imdb { display: inline-block; margin-top: 8px; line-height: 0; }
.request-details .imdb img { display: block; width: 52px; height: 26px; }
.request-details .imdb:hover { filter: brightness(1.1); }
.request-details .facts { flex: 1; min-width: 0; display: grid; gap: 4px; }
.request-details .fact { display: grid; grid-template-columns: 80px 1fr; gap: 10px; }
.request-details .fact .mono { font-family: ui-monospace, monospace; font-size: .8rem; word-break: break-all; }
.request-details h4 { margin: 12px 0 2px; font-size: .78rem; text-transform: uppercase; letter-spacing: .05em; color: var(--muted-text); font-weight: 600; }
.requests .file { display: flex; gap: 10px; align-items: baseline; word-break: break-word; }
.requests .file .shown { flex: none; font-weight: 600; }
.requests .file .pill { flex: none; background: var(--bg); border: 1px solid var(--border); min-width: 110px; text-align: center; }
.history [hidden], .toolbar [hidden] { display: none; }
.history input[type=checkbox] { width: 16px; height: 16px; accent-color: var(--primary); }
.dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; flex: none; background: var(--muted-text); }
.dot.healthy { background: var(--good); box-shadow: 0 0 8px hsl(142 60% 50% / .6); }
.dot.degraded { background: var(--warn); } .dot.down { background: var(--bad); }
.source { display: grid; grid-template-columns: auto 1fr repeat(4, auto); gap: 18px; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--border); }
.source:last-child { border-bottom: 0; }
.source .num { min-width: 90px; }
.source small { display: block; color: var(--muted-text); }
.bars { display: grid; gap: 12px; }
.bars .row { display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; }
.bars .track { grid-column: 1 / -1; height: 7px; border-radius: 999px; background: var(--muted); overflow: hidden; }
.bars .track span { display: block; height: 100%; border-radius: 999px; }
.metrics { display: grid; gap: 22px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
.metric .head { display: flex; justify-content: space-between; font-weight: 600; }
.metric .track { height: 7px; border-radius: 999px; background: var(--muted); overflow: hidden; margin-top: 8px; }
.metric .track span { display: block; height: 100%; background: var(--primary); border-radius: 999px; }
.block { border-top: 1px solid var(--border); margin-top: 18px; padding-top: 16px; }
.block .label { color: var(--muted-text); font-size: .75rem; text-transform: uppercase; letter-spacing: .05em; display: flex; justify-content: space-between; }
.block .big { font-size: 1.15rem; font-weight: 600; margin-top: 4px; display: flex; justify-content: space-between; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.chip { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg); font-weight: 600; font-size: .88rem; }
.chip small { color: var(--muted-text); font-weight: 500; }
.tile { display: flex; align-items: center; gap: 14px; }
.tile .ico { width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; flex: none; }
.tile .ico.green { background: hsl(142 50% 12%); color: var(--good); }
.tile .ico.blue { background: hsl(217 60% 14%); color: hsl(217 91% 65%); }
.tile .ico.red { background: hsl(0 50% 13%); color: var(--bad); }
.tile .ico.amber { background: hsl(38 60% 12%); color: var(--warn); }
.tile .label { color: var(--muted-text); font-size: .85rem; }
.tile .value { font-size: 1.5rem; font-weight: 700; }
.tile .hint { color: var(--muted-text); font-size: .75rem; }
.card-head { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 18px; }
.card-head svg { margin-top: 3px; color: hsl(217 91% 65%); flex: none; }
.card-head h2 { margin: 0; }
.card-head p { margin: 2px 0 0; color: var(--muted-text); }
.hitrate { display: flex; justify-content: space-between; font-weight: 600; }
.hitrate .pct { color: hsl(217 91% 65%); }
.bigbar { height: 9px; border-radius: 999px; background: var(--muted); overflow: hidden; margin: 12px 0 22px; }
.bigbar span { display: block; height: 100%; background: hsl(217 91% 60%); border-radius: 999px; }
.triple { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); text-align: center; gap: 12px; }
.triple .label { color: var(--muted-text); font-size: .85rem; }
.triple .value { font-weight: 700; font-size: 1.05rem; margin-top: 2px; }
.chart { width: 100%; height: 220px; display: block; }
.chart text { fill: var(--muted-text); font-size: 11px; }
.pager { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; color: var(--muted-text); font-size: .88rem; }
footer { color: var(--muted-text); font-size: .78rem; padding: 0 24px 24px; max-width: 1400px; margin: 0 auto; }
@media (max-width: 760px) { header { grid-template-columns: 1fr; } header .end { justify-content: flex-start; } }
</style>`;

function dashboardPage({ baseUrl }) {
  const body = `
<header>
  <h1>${name} <span class="muted" style="font-weight:500">Dashboard</span></h1>
  <nav class="tabs" id="tabs">
    <button data-tab="overview" class="active">Overview</button>
    <button data-tab="history">History</button>
    <button data-tab="caches">Caches</button>
    <button data-tab="system">System</button>
  </nav>
  <div class="end">
    <a class="btn" href="${escapeHtml(baseUrl)}/configure">Configure</a>
    <button class="btn" id="logout">Logout</button>
  </div>
</header>
<main>
  <p class="muted small" id="status">Loading…</p>

  <section data-tab="overview" class="active stack">
    <div class="grid" id="overview-cards"></div>
    <div class="card"><h2>Sources</h2><div id="sources"></div></div>
    <div class="card">
      <div class="title-row" style="margin-bottom:6px"><h2 style="font-size:1.05rem">Last <span id="range-label">30</span> days</h2>
        <div class="segmented" id="range"><button data-value="7">7 days</button><button data-value="30" class="active">30 days</button></div></div>
      <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(340px, 1fr))">
        <div><div class="muted small">Requests per day</div><div id="chart-days-requests"></div></div>
        <div><div class="muted small">Subtitle searches per day (lighter: found nothing)</div><div id="chart-days-searches"></div></div>
      </div>
    </div>
    <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(320px, 1fr))">
      <div class="card"><h2>Popular requests (last 24 hours)</h2><div class="scroll"><table id="popular"></table></div></div>
      <div class="card"><h2>Request source</h2><div class="scroll"><table id="blocks"></table></div></div>
    </div>
  </section>

  <section data-tab="history">
    <div class="title-row"><div><h2>History</h2><div class="muted" id="history-subtitle">All requests, newest first</div></div></div>
    <div class="toolbar">
      <input type="text" id="history-search" placeholder="Search title, subtitle, client ID, country or IP…">
      <select id="history-kind">
        <option value="">All types</option>
        <option value="request">Requests</option>
        <option value="not found">Not found</option>
      </select>
      <span class="muted small" id="history-count"></span>
      <button class="btn danger" id="history-delete" hidden>Delete selected</button>
      <button class="btn danger" id="history-clear">Clear all</button>
    </div>
    <div class="card scroll" style="padding:0"><table class="requests history" id="history-table"></table></div>
    <div class="pager">
      <button class="btn" id="history-prev">Previous</button>
      <span id="history-page"></span>
      <button class="btn" id="history-next">Next</button>
    </div>
  </section>

  <section data-tab="caches" class="stack">
    <div class="grid" id="cache-cards"></div>
    <div class="card">
      <div class="card-head"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>
        <div><h2>Cache performance</h2><p id="cache-subtitle">How often answers come from the cache instead of the sources</p></div></div>
      <div id="cache-performance"></div>
    </div>
    <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(380px, 1fr))">
      <div class="card">
        <div class="card-head"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="hsl(262 83% 70%)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>
          <div><h2>Request volume</h2><p>Last 24 hours (your local time)</p></div></div>
        <div id="chart-volume"></div>
      </div>
      <div class="card">
        <div class="card-head"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="hsl(160 84% 45%)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
          <div><h2>Average response time</h2><p>Last 24 hours (your local time)</p></div></div>
        <div id="chart-latency"></div>
      </div>
    </div>
    <div class="card"><h2>Caches</h2><div class="scroll"><table id="caches"></table></div></div>
  </section>

  <section data-tab="system" class="stack">
    <div class="title-row">
      <div><h2>System</h2><div class="muted">Health of the server and the addon</div></div>
      <span class="pill" id="overall-status"></span>
    </div>
    <div class="card"><h2>System health</h2><div id="health"></div></div>
    <div class="card"><h2>Settings</h2><div class="scroll"><table id="settings"></table></div></div>
  </section>
</main>
<footer>${name} v${version} · Requests are kept for at most ${settings.historyDays} days, with only the first part of each IP address. IP geolocation by <a href="https://db-ip.com" target="_blank" rel="noopener">DB-IP</a>.</footer>
<script type="application/json" id="data">${JSON.stringify({ baseUrl, name: brand.name }).replace(/</g, '\\u003c')}</script>
<script>${script}</script>`;
  return page({ title: `${brand.name} - Dashboard`, body, head: dashboardStyles });
}

module.exports = { loginPage, dashboardPage };
