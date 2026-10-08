// The configure page (/ and /configure, or /<settings>/configure to edit an installed addon).
// A header with the logo, What's new and Dashboard; sections in a sidebar with the Install button
// (#general, #sources, #about; a picker with previous/next and an install bar on phones); each
// section has cards with settings. Install opens a dialog for the Stremio app, Stremio Web and Nuvio.

const fs = require('node:fs');
const path = require('node:path');
const { page, escapeHtml } = require('./theme');
const { logoSvg } = require('./logo');
const brand = require('../brand');
const { version } = require('../../package.json');

const script = fs.readFileSync(path.join(__dirname, 'configure.client.js'), 'utf8');

const icon = (paths) =>
  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const ICONS = {
  general: icon('<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>'),
  sources: icon('<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>'),
  about: icon('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
  bell: icon('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>'),
  chart: icon('<path d="M3 3v18h18M7 15l4-4 3 3 5-6"/>'),
  download: icon('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>'),
  copy: icon('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'),
  globe: icon('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
  github: icon('<path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.9a3.4 3.4 0 0 0-.9-2.6c3.1-.4 6.4-1.5 6.4-6.9a5.4 5.4 0 0 0-1.5-3.7 5 5 0 0 0-.1-3.7s-1.2-.4-3.9 1.4a13.4 13.4 0 0 0-7 0C6.3 1.4 5.1 1.8 5.1 1.8a5 5 0 0 0-.1 3.7A5.4 5.4 0 0 0 3.5 9.2c0 5.4 3.3 6.5 6.4 6.9a3.4 3.4 0 0 0-.9 2.6V22"/>'),
  close: icon('<path d="M18 6 6 18M6 6l12 12"/>')
};

const SECTIONS = [
  { id: 'general', title: 'General', description: 'Choose your languages and how subtitles are listed.' },
  { id: 'sources', title: 'Sources', description: 'Choose where subtitles come from and how they are ranked.' },
  { id: 'about', title: 'About', description: `What ${brand.name} does and how it handles your data.` }
];

const styles = `
<style>
.shell { width: min(1180px, 100% - 32px); margin: 0 auto; }
.header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 32px 0 28px; flex-wrap: wrap; }
.identity { display: flex; align-items: center; gap: 16px; }
.identity .logo svg { width: 64px; height: 64px; display: block; }
.identity h1 { font-size: 2.2rem; font-weight: 800; letter-spacing: -0.03em; display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.identity h1 small { font-size: .85rem; font-weight: 500; color: var(--muted-text); letter-spacing: 0; }
.identity p { margin: 4px 0 0; color: var(--muted-text); }
.header-actions { display: flex; gap: 10px; align-items: center; }
.badge { min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: var(--primary); color: var(--primary-text); font-size: .7rem; font-weight: 700; display: inline-grid; place-items: center; }
.badge[hidden] { display: none; }
.layout { display: flex; gap: 40px; padding-bottom: 80px; }
.sidebar { width: 220px; flex: none; }
.sidebar .sticky { position: sticky; top: 24px; display: grid; gap: 4px; }
.sidebar nav button { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid transparent; background: none; color: var(--muted-text); font: inherit; font-weight: 600; text-align: left; cursor: pointer; }
.sidebar nav button:hover { color: var(--text); }
.sidebar nav button.active { background: var(--muted); color: var(--text); border-color: var(--border); }
.sidebar .install { width: 100%; margin-top: 14px; }
.sidebar .hint { font-size: .78rem; color: var(--muted-text); margin: 8px 4px 0; line-height: 1.4; }
.sidebar .support { display: flex; align-items: center; gap: 8px; margin-top: 14px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; color: var(--muted-text); text-decoration: none; font-size: .88rem; }
.sidebar .support:hover { color: var(--text); }
.content { flex: 1; min-width: 0; }
section[data-section] { display: none; }
section[data-section].active { display: block; }
.section-head { margin-bottom: 20px; }
.section-head h2 { font-size: 1.6rem; font-weight: 700; }
.section-head p { margin: 4px 0 0; color: var(--muted-text); }
.card + .card { margin-top: 16px; }
.card-title { font-size: 1.1rem; font-weight: 700; }
.card-description { margin: 2px 0 6px; color: var(--muted-text); font-size: .9rem; }
.setting { display: flex; gap: 16px; align-items: center; justify-content: space-between; padding: 16px 0; border-bottom: 1px solid var(--border); }
.setting:last-child { border-bottom: 0; padding-bottom: 2px; }
.setting label, .setting .label { font-weight: 600; display: block; }
.setting p { margin: 2px 0 0; color: var(--muted-text); font-size: .88rem; }
.facts { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-top: 12px; }
.facts div { border: 1px solid var(--border); border-radius: 12px; padding: 14px; background: var(--bg); }
.facts strong { display: block; margin-bottom: 4px; }
.mobile-nav, .pager, .mobile-install { display: none; }
.pager { gap: 10px; margin-top: 18px; }
.pager button { flex: 1; text-align: left; padding: 12px 14px; border-radius: 12px; border: 1px solid var(--border); background: var(--card); color: var(--text); font: inherit; cursor: pointer; }
.pager button:last-child { text-align: right; }
.pager button:disabled { opacity: .4; cursor: default; }
.pager small { display: block; color: var(--muted-text); font-size: .7rem; text-transform: uppercase; letter-spacing: .05em; }
dialog { width: min(640px, 100% - 32px); max-height: min(80vh, 760px); padding: 0; border: 1px solid var(--border); border-radius: 16px; background: var(--card); color: var(--text); }
dialog::backdrop { background: rgb(0 0 0 / .65); }
dialog .head { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; border-bottom: 1px solid var(--border); }
dialog .body { padding: 20px; overflow-y: auto; max-height: calc(min(80vh, 760px) - 70px); }
.icon-btn { border: 0; background: none; color: var(--muted-text); cursor: pointer; padding: 4px; }
.icon-btn:hover { color: var(--text); }
.install-actions { display: grid; gap: 10px; }
.install-actions .btn { justify-content: flex-start; }
.copy-row { display: flex; gap: 8px; margin-top: 8px; }
.release { border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 14px; background: var(--bg); }
.release .meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
.release h3 { font-size: 1.05rem; }
.notes h4 { font-size: .95rem; margin: 12px 0 6px; }
.notes ul { margin: 6px 0; padding-left: 20px; }
.notes li { margin: 4px 0; line-height: 1.5; }
.notes p { margin: 6px 0; line-height: 1.5; }
.notes code { background: var(--muted); padding: 1px 6px; border-radius: 6px; font-size: .85em; }
.notes pre { background: var(--muted); padding: 10px; border-radius: 8px; overflow-x: auto; }
@media (max-width: 860px) {
  .header { padding: 20px 0; }
  .identity .logo svg { width: 48px; height: 48px; }
  .identity h1 { font-size: 1.6rem; }
  .header-actions .label { display: none; }
  .layout { display: block; padding-bottom: 100px; }
  .sidebar { display: none; }
  .mobile-nav { display: block; margin-bottom: 16px; }
  .pager { display: flex; }
  .setting { flex-wrap: wrap; }
  .setting > div:first-child { flex: 1 1 200px; }
  .mobile-install { display: flex; position: fixed; left: 16px; right: 16px; bottom: 16px; z-index: 10; box-shadow: 0 12px 40px rgb(0 0 0 / .5); justify-content: center; }
}
</style>`;

function setting({ id, label, description, control }) {
  return `<div class="setting"><div>${id ? `<label for="${id}">${label}</label>` : `<span class="label">${label}</span>`}<p>${description}</p></div>${control}</div>`;
}
const toggle = (id) => `<label class="switch"><input type="checkbox" id="${id}"><span></span></label>`;
const segmented = (id, options) =>
  `<div class="segmented" id="${id}">${options.map(([value, text]) => `<button data-value="${value}">${text}</button>`).join('')}</div>`;

function configurePage({ baseUrl, initial, defaults, privacyNotice }) {
  const data = JSON.stringify({ baseUrl, initial, defaults, version, sections: SECTIONS }).replace(/</g, '\\u003c');
  const name = escapeHtml(brand.name);
  const base = escapeHtml(baseUrl);
  const repo = escapeHtml(brand.repository);
  const head = (id) => {
    const s = SECTIONS.find((x) => x.id === id);
    return `<div class="section-head"><h2>${s.title}</h2><p>${escapeHtml(s.description)}</p></div>`;
  };

  const body = `
<div class="shell">
  <header class="header">
    <div class="identity">
      <div class="logo">${logoSvg}</div>
      <div>
        <h1>${name} <small>v${version}</small></h1>
        <p>${escapeHtml(brand.tagline)}</p>
      </div>
    </div>
    <div class="header-actions">
      <button class="btn" id="open-whats-new">${ICONS.bell}<span class="label">What's new</span><span class="badge" id="new-count" hidden></span></button>
      <a class="btn" href="${base}/dashboard" title="Dashboard">${ICONS.chart}<span class="label">Dashboard</span></a>
    </div>
  </header>

  <div class="layout">
    <aside class="sidebar"><div class="sticky">
      <nav id="sidebar" aria-label="Settings sections">
        ${SECTIONS.map((s) => `<button data-section="${s.id}">${ICONS[s.id]}${s.title}</button>`).join('')}
      </nav>
      <button class="btn primary install" data-install>${ICONS.download} Install</button>
      <p class="hint">Your settings are saved in the addon URL. Install again after changing them.</p>
      <a class="support" href="${repo}" target="_blank" rel="noopener">${ICONS.github} GitHub &amp; support</a>
    </div></aside>

    <main class="content">
      <div class="mobile-nav">
        <select id="section-picker" aria-label="Settings section">${SECTIONS.map((s) => `<option value="${s.id}">${s.title}</option>`).join('')}</select>
      </div>

      <section data-section="general">
        ${head('general')}
        <div class="card">
          <div class="card-title">Languages</div>
          <p class="card-description">Which subtitle languages you get. At least one stays on.</p>
          ${setting({ id: 'lang-hun', label: 'Hungarian', description: 'Magyar feliratok', control: toggle('lang-hun') })}
          ${setting({ id: 'lang-eng', label: 'English', description: 'Angol feliratok', control: toggle('lang-eng') })}
        </div>
        <div class="card">
          <div class="card-title">Subtitles</div>
          <p class="card-description">How many subtitles are listed, and what happens with forced ones.</p>
          ${setting({ label: 'Subtitles per language', description: 'The best matches for the file you play are kept. When the player doesn\'t send the file name, every subtitle for the video is listed.', control: segmented('perLanguage', [[1, '1'], [2, '2']]) })}
          ${setting({ label: 'Forced subtitles', description: 'Only cover what a Hungarian dub doesn\'t translate ("szinkronoshoz"). <strong>Show</strong>: under Hungarian, named "Magyar · Forced" (works everywhere). <strong>Separate group</strong>: their own "Forced" group in Nuvio (Stremio shows it as "Unknown").', control: segmented('forced', [['show', 'Show'], ['group', 'Separate group'], ['hide', 'Hide']]) })}
        </div>
      </section>

      <section data-section="sources">
        ${head('sources')}
        <div class="card">
          <div class="card-title">Subtitle sources</div>
          <p class="card-description">OpenSubtitles is asked first; SuperSubtitles only for the languages OpenSubtitles has nothing in. At least one stays on.</p>
          ${setting({ id: 'src-supersubtitles', label: 'SuperSubtitles', description: 'feliratok.eu, the largest Hungarian subtitle site. Season packs included.', control: toggle('src-supersubtitles') })}
          ${setting({ id: 'src-opensubtitles', label: 'OpenSubtitles', description: 'Through Stremio\'s OpenSubtitles v3 addon. No account needed.', control: toggle('src-opensubtitles') })}
        </div>
        <div class="card">
          <div class="card-title">Ranking</div>
          <p class="card-description">Subtitles matching the release you play (group, source, resolution, codec) come first, when the player tells the addon the file name. Each one shows how well it matches, e.g. "Magyar · 92%" (0% when the player doesn't send the file name).</p>
        </div>
      </section>

      <section data-section="about">
        ${head('about')}
        <div class="card">
          <div class="card-title">${name}</div>
          <p class="card-description">${escapeHtml(brand.description)}</p>
          <div class="facts">
            <div><strong>Right episode</strong><span class="muted small">Subtitles for other episodes, seasons or same-name films are left out.</span></div>
            <div><strong>Season packs</strong><span class="muted small">The right episode is taken out of ZIP and RAR packs.</span></div>
            <div><strong>Correct accents</strong><span class="muted small">Everything arrives as UTF-8, so ő and ű display correctly.</span></div>
            <div><strong>Best match first</strong><span class="muted small">Ranked by release group, source, resolution and codec.</span></div>
          </div>
        </div>
        ${privacyNotice ? `<div class="card"><div class="card-title">Privacy</div><p class="card-description" style="margin-bottom:0">${privacyNotice.charAt(0).toUpperCase() + privacyNotice.slice(1)}</p></div>` : ''}
        <div class="card">
          <div class="card-title">Links</div>
          ${setting({ label: 'Source code', description: 'MIT licensed.', control: `<a class="btn" href="${repo}" target="_blank" rel="noopener">GitHub</a>` })}
          ${setting({ label: 'Report a problem', description: 'Something not working? Open an issue.', control: `<a class="btn" href="${repo}/issues" target="_blank" rel="noopener">Issues</a>` })}
          ${setting({ label: 'Dashboard', description: 'For the person running this instance.', control: `<a class="btn" href="${base}/dashboard">Open</a>` })}
        </div>
      </section>

      <div class="pager">
        <button id="prev"><small>Previous</small><span></span></button>
        <button id="next"><small>Next</small><span></span></button>
      </div>
    </main>
  </div>
</div>

<button class="btn primary mobile-install" data-install>${ICONS.download} Install</button>

<dialog id="install-dialog">
  <div class="head"><h2>Install ${name}</h2><button class="icon-btn" data-close aria-label="Close">${ICONS.close}</button></div>
  <div class="body">
    <p class="muted small" style="margin-top:0">Your settings are part of the addon URL. After changing them, install again.</p>
    <div class="install-actions">
      <a class="btn primary" id="install-app" href="#">${ICONS.download} Install in the Stremio app</a>
      <a class="btn" id="install-web" href="#" target="_blank" rel="noopener">${ICONS.globe} Open in Stremio Web</a>
    </div>
    <label class="muted small" for="manifest" style="display:block;margin-top:18px">Nuvio and other apps: copy the addon URL</label>
    <div class="copy-row">
      <input type="text" id="manifest" readonly>
      <button class="btn" id="copy">${ICONS.copy} Copy</button>
    </div>
  </div>
</dialog>

<dialog id="whats-new-dialog">
  <div class="head"><h2>What's new</h2><button class="icon-btn" data-close aria-label="Close">${ICONS.close}</button></div>
  <div class="body" id="whats-new-body"><p class="muted">Loading…</p></div>
</dialog>

<script type="application/json" id="data">${data}</script>
<script>${script}</script>`;

  return page({ title: `${brand.name} - Configure`, body, head: styles });
}

module.exports = { configurePage };
