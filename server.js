// Starts the addon. Settings come from environment variables (see README).

const settings = require('./src/settings');
const { start } = require('./src/web/server');
const { version } = require('./package.json');
const brand = require('./src/brand');

const server = start();
console.log(`${brand.name} ${version} listening on port ${settings.port}${settings.basePath} (manifest: ${settings.basePath}/manifest.json)`);

// In a container Node is process 1 and would ignore SIGTERM, so `docker stop` would hang.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    server.closeAllConnections();
  });
}
