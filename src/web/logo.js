// The FeliratHUB logo (a speech bubble with subtitle lines). The files live in assets/: logo.svg
// for pages and the browser tab icon, logo-512.png for the apps (they don't show SVG).

const fs = require('node:fs');
const path = require('node:path');

const assets = path.join(__dirname, '..', '..', 'assets');

module.exports = {
  logoSvg: fs.readFileSync(path.join(assets, 'logo.svg'), 'utf8').trim(),
  logoPng: fs.readFileSync(path.join(assets, 'logo-512.png'))
};
