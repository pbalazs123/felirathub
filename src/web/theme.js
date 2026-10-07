// Shared look of the configure page and the dashboard: a neutral dark theme with grey cards,
// white text and white primary buttons.

const { logoSvg } = require('./logo');
const FAVICON = `data:image/svg+xml,${encodeURIComponent(logoSvg)}`;

const css = `
:root {
  --bg: hsl(220 6% 5%);
  --card: hsl(220 6% 7%);
  --raised: hsl(220 5% 10%);
  --border: hsl(220 5% 15%);
  --muted: hsl(220 5% 14%);
  --muted-text: hsl(220 5% 58%);
  --text: hsl(210 6% 95%);
  --primary: hsl(210 6% 95%);
  --primary-text: hsl(220 6% 8%);
  --good: hsl(142 60% 50%);
  --warn: hsl(38 92% 55%);
  --bad: hsl(0 72% 62%);
  --radius: 14px;
}
* { box-sizing: border-box; }
html { color-scheme: dark; }
body {
  margin: 0;
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  font: 15px/1.5 Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}
a { color: inherit; }
h1, h2, h3 { margin: 0; letter-spacing: -0.01em; }
.muted { color: var(--muted-text); }
.small { font-size: .85rem; }
.card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 22px; }
.stack > * + * { margin-top: 16px; }
.row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  border: 1px solid var(--border); border-radius: 10px; padding: 10px 16px;
  background: var(--raised); color: var(--text); font: inherit; font-weight: 600; cursor: pointer;
  text-decoration: none; transition: background .15s, border-color .15s, opacity .15s;
}
.btn:hover { border-color: hsl(220 5% 25%); }
.btn.primary { background: var(--primary); color: var(--primary-text); border-color: var(--primary); }
.btn.primary:hover { opacity: .9; }
.btn:disabled { opacity: .45; cursor: not-allowed; }
input[type=text], input[type=password], select {
  width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--border);
  background: var(--bg); color: var(--text); font: inherit; outline: none;
}
input:focus, select:focus { border-color: hsl(220 5% 35%); box-shadow: 0 0 0 3px hsl(220 5% 20% / .6); }
.pill { display: inline-block; padding: 2px 10px; border-radius: 999px; background: var(--muted); font-size: .78rem; font-weight: 600; }
.tabs { display: inline-flex; gap: 4px; padding: 4px; border: 1px solid var(--border); border-radius: 999px; background: var(--card); }
.tabs button { border: 0; background: transparent; color: var(--muted-text); padding: 7px 16px; border-radius: 999px; font: inherit; font-weight: 600; cursor: pointer; }
.tabs button.active { background: var(--muted); color: var(--text); }
.switch { position: relative; width: 42px; height: 24px; flex: none; }
.switch input { opacity: 0; width: 0; height: 0; }
.switch span { position: absolute; inset: 0; border-radius: 999px; background: var(--muted); border: 1px solid var(--border); transition: .15s; cursor: pointer; }
.switch span::after { content: ""; position: absolute; width: 18px; height: 18px; left: 2px; top: 2px; border-radius: 50%; background: var(--muted-text); transition: .15s; }
.switch input:checked + span { background: var(--primary); }
.switch input:checked + span::after { transform: translateX(18px); background: var(--primary-text); }
.segmented { display: inline-flex; flex: none; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.segmented button { border: 0; background: var(--bg); color: var(--muted-text); padding: 8px 14px; font: inherit; font-weight: 600; cursor: pointer; white-space: nowrap; }
.segmented button.active { background: var(--primary); color: var(--primary-text); }
table { width: 100%; border-collapse: collapse; font-size: .88rem; }
th, td { text-align: left; padding: 9px 10px; border-bottom: 1px solid var(--border); white-space: nowrap; }
th { color: var(--muted-text); font-weight: 600; }
td.wrap { white-space: normal; word-break: break-word; }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.good { color: var(--good); } .warn { color: var(--warn); } .bad { color: var(--bad); }
.banner { padding: 10px 16px; border-radius: 10px; border: 1px solid hsl(38 60% 30%); background: hsl(38 60% 12%); color: hsl(38 92% 70%); }
`;

function page({ title, body, head = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="icon" href="${FAVICON}">
<style>${css}</style>
${head}
</head>
<body>
${body}
</body>
</html>`;
}

// For values placed into HTML.
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

module.exports = { page, escapeHtml };
