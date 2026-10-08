// Browser script of the configure page: settings, sections, install dialog and "What's new".
(function () {
  var data = JSON.parse(document.getElementById('data').textContent);
  var config = JSON.parse(JSON.stringify(data.initial));
  var $ = function (id) { return document.getElementById(id); };

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Sections: sidebar on wide screens, picker + previous/next on small ones. The section is in the
  // address (#general, #sources, #about), so links and the back button work.
  var ids = data.sections.map(function (s) { return s.id; });
  var current = ids[0];
  function fromHash() { var id = location.hash.replace('#', ''); return ids.indexOf(id) !== -1 ? id : ids[0]; }
  function go(id) { if (location.hash !== '#' + id) location.hash = id; else showSection(id); }
  function showSection(id) {
    current = id;
    document.querySelectorAll('#sidebar button').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-section') === id); });
    document.querySelectorAll('section[data-section]').forEach(function (s) { s.classList.toggle('active', s.getAttribute('data-section') === id); });
    $('section-picker').value = id;
    var i = ids.indexOf(id);
    var prev = data.sections[i - 1], next = data.sections[i + 1];
    $('prev').disabled = !prev;
    $('next').disabled = !next;
    $('prev').querySelector('span').textContent = prev ? prev.title : '—';
    $('next').querySelector('span').textContent = next ? next.title : '—';
  }
  document.querySelectorAll('#sidebar button').forEach(function (b) {
    b.addEventListener('click', function () { go(b.getAttribute('data-section')); });
  });
  $('section-picker').addEventListener('change', function (e) { go(e.target.value); });
  $('prev').addEventListener('click', function () { go(ids[ids.indexOf(current) - 1]); window.scrollTo(0, 0); });
  $('next').addEventListener('click', function () { go(ids[ids.indexOf(current) + 1]); window.scrollTo(0, 0); });
  window.addEventListener('hashchange', function () { showSection(fromHash()); });

  // Settings -> addon URL. Default settings use the plain URL, so caches are shared.
  function manifestUrl() {
    if (JSON.stringify(config) === JSON.stringify(data.defaults)) return data.baseUrl + '/manifest.json';
    return data.baseUrl + '/' + encodeURIComponent(JSON.stringify(config)) + '/manifest.json';
  }

  function render() {
    $('src-supersubtitles').checked = config.sources.supersubtitles;
    $('src-opensubtitles').checked = config.sources.opensubtitles;
    $('lang-hun').checked = config.languages.indexOf('hun') !== -1;
    $('lang-eng').checked = config.languages.indexOf('eng') !== -1;
    var url = manifestUrl();
    var parsed = new URL(url);
    $('manifest').value = url;
    $('install-app').href = 'stremio://' + parsed.host + parsed.pathname;
    $('install-web').href = 'https://web.stremio.com/#/addons?addon=' + encodeURIComponent(url);
  }

  function toggleSource(name, input) {
    config.sources[name] = input.checked;
    if (!config.sources.supersubtitles && !config.sources.opensubtitles) config.sources[name] = true; // keep one
    render();
  }
  function toggleLanguage(code, input) {
    var others = config.languages.filter(function (l) { return l !== code; });
    if (input.checked) config.languages = ['hun', 'eng'].filter(function (l) { return l === code || others.indexOf(l) !== -1; });
    else if (others.length) config.languages = others; // keep one
    render();
  }
  $('src-supersubtitles').addEventListener('change', function (e) { toggleSource('supersubtitles', e.target); });
  $('src-opensubtitles').addEventListener('change', function (e) { toggleSource('opensubtitles', e.target); });
  $('lang-hun').addEventListener('change', function (e) { toggleLanguage('hun', e.target); });
  $('lang-eng').addEventListener('change', function (e) { toggleLanguage('eng', e.target); });

  // Dialogs
  document.querySelectorAll('dialog').forEach(function (dialog) {
    dialog.querySelector('[data-close]').addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
  });
  document.querySelectorAll('[data-install]').forEach(function (button) {
    button.addEventListener('click', function () { $('install-dialog').showModal(); });
  });
  $('copy').addEventListener('click', function () {
    var button = $('copy');
    var done = function () { var t = button.innerHTML; button.textContent = 'Copied'; setTimeout(function () { button.innerHTML = t; }, 1200); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText($('manifest').value).then(done);
    else { $('manifest').select(); document.execCommand('copy'); done(); }
  });

  // Minimal Markdown for release notes: headings, lists, bold, italics, code, links. Text is
  // escaped first, and only http(s) links are kept.
  function inline(text) {
    return text
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }
  function markdown(source) {
    var html = [], list = false, code = false;
    esc(source).split(/\r?\n/).forEach(function (line) {
      if (/^```/.test(line)) { if (list) { html.push('</ul>'); list = false; } html.push(code ? '</pre>' : '<pre>'); code = !code; return; }
      if (code) { html.push(line + '\n'); return; }
      var item = line.match(/^\s*[-*]\s+(.*)$/);
      if (item) { if (!list) { html.push('<ul>'); list = true; } html.push('<li>' + inline(item[1]) + '</li>'); return; }
      if (list) { html.push('</ul>'); list = false; }
      var heading = line.match(/^(#{1,4})\s+(.*)$/);
      if (heading) html.push('<h4>' + inline(heading[2]) + '</h4>');
      else if (line.trim()) html.push('<p>' + inline(line) + '</p>');
    });
    if (list) html.push('</ul>');
    if (code) html.push('</pre>');
    return html.join('');
  }

  var notes = null;
  function renderNotes() {
    if (!notes) return;
    var parts = [];
    if (notes.development) parts.push('<p class="muted small">You are running a development build (v' + esc(notes.current) + '). It can change at any time.</p>');
    if (!notes.entries.length) parts.push('<p class="muted">No release notes available.</p>');
    notes.entries.forEach(function (entry) {
      var tags = (entry.current ? ' <span class="pill">this version</span>' : '') + (entry.newer ? ' <span class="badge">new</span>' : '');
      var date = entry.date ? '<span class="muted small">' + new Date(entry.date).toLocaleDateString() + '</span>' : '<span class="muted small">development build</span>';
      var link = entry.url ? ' <a class="muted small" href="' + esc(entry.url) + '" target="_blank" rel="noopener">GitHub</a>' : '';
      parts.push('<div class="release"><div class="meta"><h3>v' + esc(entry.version) + '</h3>' + tags + date + link + '</div><div class="notes">' + markdown(entry.notes) + '</div></div>');
    });
    $('whats-new-body').innerHTML = parts.join('');
  }
  fetch(data.baseUrl + '/api/whats-new')
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (result) {
      if (!result) return;
      notes = result;
      var newer = result.entries.filter(function (e) { return e.newer; }).length;
      if (newer) { $('new-count').textContent = newer; $('new-count').hidden = false; }
      renderNotes();
    })
    .catch(function () { $('whats-new-body').innerHTML = '<p class="muted">Could not load the release notes.</p>'; });
  $('open-whats-new').addEventListener('click', function () { $('whats-new-dialog').showModal(); });

  showSection(fromHash());
  render();
})();
