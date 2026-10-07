# Container image, published as pbalazs123/felirathub and ghcr.io/pbalazs123/felirathub.

# Stage 1: install the dependencies.
FROM node:24-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
# The GeoIP package ships its database three times; only the combined file is used.
RUN npm ci --omit=dev --ignore-scripts \
 && rm -f node_modules/@ip-location-db/dbip-country-mmdb/dbip-country-ipv*.mmdb

# Stage 2: the runtime image. npm, npx, corepack and yarn aren't needed to run the addon, so
# they are removed (they bundle their own dependencies, which security scanners flag).
FROM node:24-alpine
LABEL org.opencontainers.image.title="FeliratHUB" \
      org.opencontainers.image.description="FeliratHUB: Hungarian and English subtitles from SuperSubtitles (feliratok.eu) and OpenSubtitles for Stremio and Nuvio" \
      org.opencontainers.image.source="https://github.com/pbalazs123/felirathub" \
      org.opencontainers.image.licenses="MIT"
RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
      /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg
# /data is owned by the node user, so a Docker volume mounted there is writable (DATA_DIR, CACHE_DIR).
RUN mkdir -p /data && chown node:node /data
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production PORT=7000
EXPOSE 7000
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}${APP_BASE_PATH}/health" || exit 1
CMD ["node", "server.js"]
