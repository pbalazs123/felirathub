// Offline IP-to-country lookup for the dashboard, using the free DB-IP Lite database
// (CC BY 4.0, "IP Geolocation by DB-IP", https://db-ip.com). IPs are never sent anywhere.

const fs = require('node:fs');
const { Reader } = require('mmdb-lib');

let reader = null;

function getReader() {
  if (!reader) {
    const file = require.resolve('@ip-location-db/dbip-country-mmdb/dbip-country.mmdb');
    reader = new Reader(fs.readFileSync(file));
  }
  return reader;
}

// Returns an ISO country code like "HU", or '' when unknown (e.g. private addresses).
// Cloudflare's CF-IPCountry header is used when present (e.g. on BeamUp).
function countryOf(ip, headers = {}) {
  const fromCloudflare = String(headers['cf-ipcountry'] || '').toUpperCase();
  if (/^[A-Z]{2}$/.test(fromCloudflare) && fromCloudflare !== 'XX') return fromCloudflare;
  try {
    return getReader().get(ip)?.country_code || '';
  } catch {
    return '';
  }
}

module.exports = { countryOf };
