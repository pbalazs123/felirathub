// Which app made a request, from its User-Agent and Origin headers, as a short label for the
// dashboard (e.g. "Stremio 4.4.168", "Stremio Web · Chrome 141", "Android app · okhttp 4.12.0").
// Only this label is stored, never the full User-Agent. Nuvio doesn't name itself: its addon
// requests carry the HTTP library's default User-Agent (okhttp on Android).

const BROWSERS = [
  ['Edge', /Edg\/([\d]+)/],
  ['Firefox', /Firefox\/([\d]+)/],
  ['Chrome', /Chrome\/([\d]+)/],
  ['Safari', /Version\/([\d]+).*Safari/]
];

function browserOf(agent) {
  for (const [name, pattern] of BROWSERS) {
    const match = agent.match(pattern);
    if (match) return `${name} ${match[1]}`;
  }
  return 'browser';
}

function clientOf(headers = {}) {
  const agent = String(headers['user-agent'] || '').slice(0, 300);
  const origin = String(headers.origin || headers.referer || '');
  let match;
  if ((match = agent.match(/Nuvio(?:TV|Mobile)?\/([\w.-]+)/i))) return `Nuvio ${match[1]}`;
  if ((match = agent.match(/Stremio(?:Shell)?\/([\w.-]+)/i))) return `Stremio ${match[1]}`;
  if (/(^|\/\/)(web|app)\.strem(io\.com|\.io)/.test(origin)) return `Stremio Web · ${browserOf(agent)}`;
  if ((match = agent.match(/okhttp\/([\w.-]+)/i))) return `Android app · okhttp ${match[1]}`;
  if ((match = agent.match(/^(Dart|CFNetwork|Ktor[\w-]*|node|axios|curl|python-requests|Go-http-client)\/([\w.-]+)/i))) return `${match[1]} ${match[2]}`;
  if (/Mozilla\//.test(agent)) return browserOf(agent);
  const first = agent.split(' ')[0];
  return first ? first.slice(0, 60) : 'unknown';
}

module.exports = { clientOf };
