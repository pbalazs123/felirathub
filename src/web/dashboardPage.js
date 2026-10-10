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

// The tabs: a tab bar on wide screens, a picker with Previous/Next on phones and small tablets (like
// the sections of the configure page). The tab is also in the address (#requests).
const TABS = [
  { id: 'overview', title: 'Overview' },
  { id: 'history', title: 'Requests', hash: 'requests' },
  { id: 'uploads', title: 'Uploads' },
  { id: 'caches', title: 'Caches' },
  { id: 'system', title: 'System' }
];
const ICON_SLIDERS = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/></svg>';
const ICON_LOGOUT = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>';

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
.requests td.title .clip { display: block; max-width: min(520px, 34vw); overflow: hidden; text-overflow: ellipsis; }
.requests td.client .clip { display: block; max-width: min(220px, 18vw); overflow: hidden; text-overflow: ellipsis; color: var(--muted-text); font-size: .85rem; }
.requests tr.details td { white-space: normal; background: var(--muted); padding: 6px 14px 16px; }
.request-details { display: flex; gap: 20px; align-items: flex-start; }
.request-details .poster { flex: none; width: 110px; text-align: center; }
.request-details .poster img.cover { display: block; width: 110px; height: 163px; object-fit: cover; border-radius: 10px; border: 1px solid var(--border); background: var(--bg); margin-bottom: 8px; }
.request-details .poster .name { font-weight: 600; line-height: 1.3; }
.imdb { display: inline-block; line-height: 0; }
.imdb img { display: block; width: 52px; height: 26px; }
.imdb:hover { filter: brightness(1.1); }
.request-details .poster a:hover img.cover { filter: brightness(1.15); }
.popular td.badge { width: 72px; }
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
.block .label { flex-wrap: wrap; gap: 2px 12px; }
/* Uploads: the list and the "Add a subtitle" dialog. */
.uploads td.wrap { max-width: 360px; }
.uploads .icon-btn, dialog .icon-btn { border: 0; background: none; color: var(--muted-text); cursor: pointer; padding: 6px; font-size: 1rem; }
.uploads .icon-btn:hover { color: var(--bad); }
.request-details .add-upload { margin-top: 12px; justify-self: start; }
dialog { width: min(640px, 100% - 24px); max-height: 92vh; max-height: 92dvh; padding: 0; border: 1px solid var(--border); border-radius: 16px; background: var(--card); color: var(--text); overflow: auto; }
dialog::backdrop { background: rgb(0 0 0 / .65); }
dialog .head { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border); }
dialog .head h3 { font-size: 1.15rem; outline: 0; }
dialog .body { padding: 18px 20px 20px; }
.titlebox { display: flex; gap: 14px; align-items: center; min-height: 68px; padding: 12px; border: 1px solid var(--border); border-radius: 12px; background: var(--bg); margin-bottom: 14px; }
.titlebox img { width: 46px; height: 68px; object-fit: cover; border-radius: 6px; flex: none; }
.titlebox .t { font-weight: 600; }
.field { margin-bottom: 14px; min-width: 0; }
.field label { display: block; font-weight: 600; margin-bottom: 6px; font-size: .9rem; }
.field .hint { color: var(--muted-text); font-size: .8rem; margin-top: 4px; }
.field-row { display: flex; gap: 14px; align-items: flex-end; flex-wrap: wrap; }
.field.grow { flex: 1 1 150px; }
.field.narrow { flex: 0 0 84px; }
.field input.mono { font-family: ui-monospace, monospace; font-size: .85rem; }
.check { display: inline-flex; gap: 8px; align-items: center; color: var(--muted-text); font-size: .9rem; margin-bottom: 22px; cursor: pointer; }
.check input { width: 16px; height: 16px; accent-color: var(--primary); }
.drop { border: 2px dashed hsl(220 5% 28%); border-radius: 12px; padding: 20px; text-align: center; color: var(--muted-text); background: var(--bg); cursor: pointer; }
.drop .touch { display: none; }
.drop.over { border-color: var(--primary); }
.drop b { color: var(--text); }
.drop .link { border: 0; background: none; color: var(--text); font: inherit; font-weight: 600; text-decoration: underline; cursor: pointer; padding: 0; }
.drop .chosen { color: var(--text); font-size: .9rem; margin-top: 8px; word-break: break-all; }
.drop .chosen:empty { display: none; }
dialog .actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
#upload-error:empty { display: none; }
[hidden] { display: none !important; }
.requests .file .badges, .requests .file .muted.small { flex: none; white-space: nowrap; }
/* The five numbers of the overview: one row when there is room, 3 + 2 on tablets in portrait. */
#overview-cards { grid-template-columns: repeat(5, minmax(0, 1fr)); }
@media (max-width: 960px) {
  #overview-cards { grid-template-columns: repeat(6, minmax(0, 1fr)); }
  #overview-cards > * { grid-column: span 2; }
  #overview-cards > :nth-child(n+4) { grid-column: span 3; }
}
.mobile-nav, .tab-pager { display: none; }
/* Previous/Next between tabs, the same look as on the configure page. */
.tab-pager { gap: 10px; margin-top: 18px; }
.tab-pager button { flex: 1; text-align: left; padding: 12px 14px; border-radius: 12px; border: 1px solid var(--border); background: var(--card); color: var(--text); font: inherit; cursor: pointer; }
.tab-pager button:last-child { text-align: right; }
.tab-pager button:disabled { opacity: .4; cursor: default; }
.tab-pager small { display: block; color: var(--muted-text); font-size: .7rem; text-transform: uppercase; letter-spacing: .05em; }

/* Touch screens (phones and tablets): bigger things to tap. */
@media (pointer: coarse) {
  .tabs button { padding: 10px 18px; }
  .btn, select, input[type=text] { min-height: 44px; }
  .segmented button { padding: 10px 16px; }
  .history input[type=checkbox] { width: 20px; height: 20px; }
  .uploads .icon-btn, dialog .icon-btn { min-width: 44px; min-height: 44px; }
  /* 16px keeps iOS from zooming in when a field is tapped. */
  dialog input[type=text], dialog input.mono { font-size: 16px; }
  .check { min-height: 44px; }
  .check input { width: 20px; height: 20px; }
  /* Nothing can be dropped on a touch screen: the whole box opens the file picker. */
  .drop { padding: 24px 16px; }
  .drop .mouse { display: none; }
  .drop .touch { display: inline; }
  .requests tr.request td { padding-top: 13px; padding-bottom: 13px; }
}

/* Tablets in landscape and small laptops: the same layout, a little tighter. */
@media (max-width: 1100px) {
  header { padding: 12px 16px; gap: 12px; }
  main { padding: 20px 16px; }
  footer { padding: 0 16px 20px; }
}

/* Phones and tablets in portrait: a tab picker instead of the tab bar, and requests as cards. */
@media (max-width: 860px) {
  header { grid-template-columns: 1fr auto; }
  header .tabs, header .end .label { display: none; }
  header .end .btn { padding: 10px 12px; }
  main { padding: 16px; }
  footer { padding: 0 16px 24px; }
  .mobile-nav { display: block; margin-bottom: 14px; }
  .tab-pager { display: flex; }
  .title-row h2 { font-size: 1.5rem; }
  .toolbar input[type=text] { flex: 1 1 100%; min-width: 0; }
  .toolbar select { flex: 1; min-width: 0; }

  .requests.history, .requests.history tbody, .requests.history tr { display: block; }
  .requests.history tr[hidden] { display: none; }
  .requests.history th, .requests.history td { display: block; padding: 0; border: 0; white-space: normal; min-width: 0; }
  .requests.history tr:first-child { padding: 10px 14px; border-bottom: 1px solid var(--border); }
  .requests.history th { display: none; }
  .requests.history th:first-child { display: flex; gap: 10px; align-items: center; }
  .requests.history th:first-child::after { content: "Select all"; }
  .requests.history tr.request { display: grid; grid-template-columns: auto auto minmax(0, 1fr) auto auto; gap: 6px 10px; align-items: center; padding: 12px 14px; border-bottom: 1px solid var(--border); }
  .requests.history tr.request:hover td, .requests.history tr.request.open td { background: none; }
  .requests.history tr.request.open { background: var(--muted); border-bottom-color: transparent; }
  .requests.history td.check { grid-area: 1 / 1 / 4 / 2; align-self: start; padding-top: 2px; }
  .requests.history td.type { grid-area: 1 / 2 / 2 / 4; }
  .requests.history td.status { grid-area: 1 / 4 / 2 / 6; }
  .requests.history td.title { grid-area: 2 / 2 / 3 / 6; font-weight: 600; }
  .requests.history td.title .clip, .requests.history td.client .clip { max-width: none; }
  .requests.history td.from { grid-area: 3 / 2; }
  .requests.history td.client { grid-area: 3 / 3 / 4 / 5; }
  .requests.history td.ended { grid-area: 3 / 5; }
  .requests.history tr.details td { padding: 4px 14px 16px; border-bottom: 1px solid var(--border); background: var(--muted); }
  .requests.history td[colspan].muted { padding: 16px 14px; }

  /* The other tables: one block per row, each value under its name. */
  #caches, #caches tbody, #settings, #settings tbody, #settings tr, #uploads-table, #uploads-table tbody { display: block; }
  #caches tr:first-child, #settings tr:first-child, #uploads-table tr:first-child { display: none; }
  #caches tr { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; padding: 14px 0; border-bottom: 1px solid var(--border); }
  #caches tr:last-child, #settings tr:last-child { border-bottom: 0; }
  #caches td { display: block; padding: 0; border: 0; text-align: left; white-space: normal; }
  #caches td:first-child { grid-column: 1 / -1; font-weight: 600; }
  #caches td[data-label]::before { content: attr(data-label); display: block; color: var(--muted-text); font-size: .72rem; text-transform: uppercase; letter-spacing: .04em; }
  #uploads-table tr { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto; gap: 8px 10px; padding: 14px; border-bottom: 1px solid var(--border); }
  #uploads-table td { display: block; padding: 0; border: 0; text-align: left; white-space: normal; word-break: break-word; }
  #uploads-table td.main { grid-area: 1 / 1 / 2 / 3; font-weight: 600; align-self: center; }
  #uploads-table td.del { grid-area: 1 / 3; }
  #uploads-table td.lang { grid-area: 2 / 1; }
  #uploads-table td.size { grid-area: 2 / 2; }
  #uploads-table td.added { grid-area: 2 / 3; }
  #uploads-table td.wide { grid-column: 1 / -1; }
  #uploads-table td[data-label]::before { content: attr(data-label); display: block; color: var(--muted-text); font-size: .72rem; text-transform: uppercase; letter-spacing: .04em; font-weight: 400; }
  #uploads-table td[colspan] { grid-column: 1 / -1; }
  #settings tr { padding: 10px 0; border-bottom: 1px solid var(--border); }
  #settings td { display: block; padding: 0; border: 0; white-space: normal; }
  #settings td:first-child { color: var(--muted-text); font-size: .8rem; }

  .requests .file { flex-wrap: wrap; }
}

/* Phones: two stat cards per row, and the details of a request stacked. */
@media (max-width: 600px) {
  .card { padding: 16px; }
  #overview-cards, #cache-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  #overview-cards > *, #overview-cards > :nth-child(n+4) { grid-column: auto; }
  #overview-cards > :last-child:nth-child(odd), #cache-cards > :last-child:nth-child(odd) { grid-column: 1 / -1; }
  .stat .value { font-size: 1.35rem; }
  .tile { gap: 10px; }
  /* The upload dialog as a sheet from the bottom, with everything under each other. */
  dialog { width: 100%; max-width: 100%; max-height: 94vh; max-height: 94dvh; margin: auto 0 0; border-radius: 16px 16px 0 0; border-width: 1px 0 0; }
  dialog .head { position: sticky; top: 0; z-index: 1; background: var(--card); padding: 12px 16px; }
  dialog .body { padding: 16px 16px calc(16px + env(safe-area-inset-bottom)); }
  .field-row { gap: 0 12px; }
  .field-row > .field:not(.narrow) { flex: 1 1 100%; }
  .field.narrow { flex: 1 1 0; }
  .field-row .segmented { display: flex; }
  .field-row .segmented button { flex: 1; }
  .check { margin-bottom: 14px; }
  dialog .actions { flex-direction: column-reverse; }
  dialog .actions .btn { width: 100%; justify-content: center; text-align: center; }
  #upload-open { width: 100%; justify-content: center; text-align: center; }
  .tile .ico { width: 36px; height: 36px; border-radius: 10px; }
  .tile .value { font-size: 1.2rem; }
  .request-details { flex-direction: column; gap: 12px; }
  .request-details .poster { display: flex; gap: 12px; align-items: center; width: auto; text-align: left; }
  .request-details .poster img.cover { width: 64px; height: 95px; margin: 0; }
  .request-details .fact { grid-template-columns: 72px minmax(0, 1fr); }
  .requests .file { flex-wrap: wrap; gap: 2px 10px; padding: 4px 0; }
  .requests .file .fname { flex: 1 1 100%; }
  .requests .file .pill { min-width: 0; }
  /* Sources: name and status on one line, the three numbers under it. */
  .source { grid-template-columns: auto repeat(3, minmax(0, 1fr)) auto; gap: 8px 12px; }
  .source > :nth-child(1) { grid-area: 1 / 1; }
  .source > :nth-child(2) { grid-area: 1 / 2 / 2 / 5; min-width: 0; }
  .source > :nth-child(3) { grid-area: 2 / 2; }
  .source > :nth-child(4) { grid-area: 2 / 3; }
  .source > :nth-child(5) { grid-area: 2 / 4; }
  .source > :nth-child(6) { grid-area: 1 / 5; }
  .source .num { min-width: 0; text-align: left; }
}
</style>`;

function dashboardPage({ baseUrl }) {
  const body = `
<header>
  <h1>${name} <span class="muted" style="font-weight:500">Dashboard</span></h1>
  <nav class="tabs" id="tabs">
    ${TABS.map((tab, index) => `<button data-tab="${tab.id}"${index ? '' : ' class="active"'}>${tab.title}</button>`).join('\n    ')}
  </nav>
  <div class="end">
    <a class="btn" href="${escapeHtml(baseUrl)}/configure" title="Configure">${ICON_SLIDERS}<span class="label">Configure</span></a>
    <button class="btn" id="logout" title="Logout">${ICON_LOGOUT}<span class="label">Logout</span></button>
  </div>
</header>
<main>
  <div class="mobile-nav">
    <select id="tab-picker" aria-label="Dashboard section">${TABS.map((tab) => `<option value="${tab.id}">${tab.title}</option>`).join('')}</select>
  </div>
  <p class="muted small" id="status">Loading…</p>

  <section data-tab="overview" class="active stack">
    <div class="grid" id="overview-cards"></div>
    <div class="card"><h2>Sources</h2><div id="sources"></div></div>
    <div class="card">
      <div class="title-row" style="margin-bottom:6px"><h2 style="font-size:1.05rem">Last <span id="range-label">30</span> days</h2>
        <div class="segmented" id="range"><button data-value="7">7 days</button><button data-value="30" class="active">30 days</button></div></div>
      <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(min(340px, 100%), 1fr))">
        <div><div class="muted small">Requests per day</div><div id="chart-days-requests"></div></div>
        <div><div class="muted small">Subtitle searches per day (lighter: found nothing)</div><div id="chart-days-searches"></div></div>
      </div>
    </div>
    <div class="card"><h2>Popular requests (last 24 hours)</h2><div class="scroll"><table class="popular" id="popular"></table></div></div>
  </section>

  <section data-tab="history">
    <div class="title-row"><div><h2>Requests</h2><div class="muted" id="history-subtitle">All requests, newest first</div></div></div>
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

  <section data-tab="uploads">
    <div class="title-row">
      <div><h2>Uploads</h2><div class="muted">Your own subtitles. They are offered for their film or episode as the source "Uploaded".</div></div>
      <button class="btn primary" id="upload-open">＋ Add subtitle</button>
    </div>
    <div class="banner" id="uploads-off" style="margin-bottom:14px" hidden>Uploading needs a data folder the server can write to. Mount a volume at /data (or set DATA_DIR), make sure the container's user (uid 1000) can write there, and restart.</div>
    <div class="card scroll" style="padding:0"><table class="uploads" id="uploads-table"></table></div>
  </section>

  <section data-tab="caches" class="stack">
    <div class="grid" id="cache-cards"></div>
    <div class="card">
      <div class="card-head"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>
        <div><h2>Cache performance</h2><p id="cache-subtitle">How often answers come from the cache instead of the sources</p></div></div>
      <div id="cache-performance"></div>
    </div>
    <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(min(380px, 100%), 1fr))">
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

  <div class="tab-pager">
    <button id="tab-prev"><small>Previous</small><span></span></button>
    <button id="tab-next"><small>Next</small><span></span></button>
  </div>
</main>
<dialog id="upload-dialog">
  <form id="upload-form" method="dialog">
    <div class="head"><h3 tabindex="-1" autofocus>Add a subtitle</h3><button type="button" class="icon-btn" id="upload-close" aria-label="Close">✕</button></div>
    <div class="body">
      <p class="muted small" style="margin:0 0 14px">It will be offered for this film or episode from now on, ranked with the other sources.</p>
      <div class="titlebox" id="upload-title"></div>
      <div class="field-row">
        <div class="field"><label>Type</label><div class="segmented" id="upload-type"><button type="button" data-value="movie">Film</button><button type="button" data-value="series">Series</button></div></div>
        <div class="field grow"><label for="upload-imdb">IMDb ID</label><input type="text" id="upload-imdb" placeholder="tt0903747" autocomplete="off"></div>
        <div class="field narrow" data-series><label for="upload-season">Season</label><input type="text" id="upload-season" inputmode="numeric" autocomplete="off"></div>
        <div class="field narrow" data-series><label for="upload-episode">Episode</label><input type="text" id="upload-episode" inputmode="numeric" autocomplete="off"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Language</label><div class="segmented" id="upload-lang"><button type="button" data-value="hun">Magyar</button><button type="button" data-value="eng">English</button></div></div>
        <label class="check"><input type="checkbox" id="upload-forced"> Forced (for the dub)</label>
      </div>
      <div class="field"><label for="upload-release">Fits release</label><input type="text" id="upload-release" class="mono" placeholder="e.g. 720p.BluRay.x264-GROUP" autocomplete="off">
        <div class="hint">The release this subtitle is in sync with. Leave it empty if it fits any release.</div></div>
      <div class="field"><label>Subtitle file</label>
        <div class="drop" id="upload-drop"><span class="mouse">Drop an <b>.srt</b>, <b>.vtt</b>, <b>.ass</b> or <b>.ssa</b> file here, or <button type="button" class="link" id="upload-browse">browse</button></span><span class="touch">Tap to choose an <b>.srt</b>, <b>.vtt</b>, <b>.ass</b> or <b>.ssa</b> file</span>
          <div class="chosen" id="upload-chosen"></div></div>
        <input type="file" id="upload-file" hidden>
        <div class="hint">It is converted to UTF-8 and stored on the server.</div></div>
      <div class="bad small" id="upload-error"></div>
      <div class="actions"><button type="button" class="btn" id="upload-cancel">Cancel</button><button type="submit" class="btn primary" id="upload-submit">Upload</button></div>
    </div>
  </form>
</dialog>
<footer>${name} v${version} · Requests are kept for at most ${settings.historyDays} days, with only the first part of each IP address. IP geolocation by <a href="https://db-ip.com" target="_blank" rel="noopener">DB-IP</a>.</footer>
<script type="application/json" id="data">${JSON.stringify({ baseUrl, name: brand.name, tabs: TABS }).replace(/</g, '\\u003c')}</script>
<script>${script}</script>`;
  return page({ title: `${brand.name} - Dashboard`, body, head: dashboardStyles });
}

module.exports = { loginPage, dashboardPage };
