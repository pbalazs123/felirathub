<img src="https://raw.githubusercontent.com/pbalazs123/felirathub/main/assets/logo-256.png" alt="FeliratHUB logo" width="96" height="96">

# FeliratHUB

**Hungarian & English subtitles for Stremio and Nuvio**

Subtitles from [SuperSubtitles](https://feliratok.eu) (feliratok.eu) and OpenSubtitles in one list, for the right
episode, with correct Hungarian accents, best match first.

[GitHub](https://github.com/pbalazs123/felirathub) •
[Releases](https://github.com/pbalazs123/felirathub/releases) •
[Report a bug](https://github.com/pbalazs123/felirathub/issues)

---

## ✨ Features

- 🔗 **Two sources, one list**: OpenSubtitles first; SuperSubtitles fills in the languages OpenSubtitles has nothing in, or nothing that matches your file at least 70%
- 🇭🇺 **Hungarian and English** subtitles, or only one of them
- 🔍 **Right episode, right film**: other episodes, seasons and same-name films are filtered out
- 📦 **Season packs**: the episode is taken out of ZIP and RAR packs on the fly
- 🔤 **Correct accents**: everything arrives as UTF-8, so ő and ű display correctly
- 🏆 **Best match first**: the best 2 per language (all of them when the player sends no file name), ranked by how well they fit what you play: the source and release group count most (and the cut for films), shown as e.g. "Magyar · 92%"
- 🎭 **Forced subtitles**: subtitles for the Hungarian dub ("szinkronoshoz") are listed as "Magyar · Forced", after the full ones
- 🎯 **Configure page** to choose languages and sources; install with one click
- 💾 **History and disk cache** in `/data`: mount a volume there and they survive restarts
- 📊 **Dashboard** with sign-in (`DASHBOARD_PASSWORD`): request history, source status, caches and system health
- 🔒 **Hardened**: non-root, no package managers in the image, zip-bomb and size limits

## 🏷️ Tags

| Tag | Description |
|-----|-------------|
| `latest` | Latest release |
| `0.1.0`, `0.1` | A specific release, or the newest of a minor version |
| `dev` | Test builds of upcoming changes (may be unstable) |

All images support **`linux/amd64`** and **`linux/arm64`** (e.g. Raspberry Pi 4/5). The same images are also on
`ghcr.io/pbalazs123/felirathub`.

## 🚀 Quick Start

### Docker Compose (recommended)

```yaml
services:
  felirathub:
    image: pbalazs123/felirathub:latest       # or :dev for test builds
    container_name: felirathub
    restart: unless-stopped
    ports:
      # Only reachable from this host; put a reverse proxy with HTTPS in front of it.
      - "127.0.0.1:7000:7000"
    # Optional settings: remove the "#" in front of "environment:" and of the lines you need.
    # environment:
    #   DASHBOARD_PASSWORD: change-me          # enables the admin dashboard at /dashboard
    #   OPENSUBTITLES: "0"                     # OpenSubtitles off for new installs
    #   PUBLIC_URL: https://subs.example.com   # only if links come out with the wrong address
    volumes:
      - felirathub-data:/data                  # request history (SQLite) and disk cache survive restarts

volumes:
  felirathub-data:
```

```bash
docker compose up -d
```

The same file is in the repository:
`curl -O https://raw.githubusercontent.com/pbalazs123/felirathub/main/docker-compose.yml`

### Docker Run

```bash
docker run -d \
  --name felirathub \
  --restart unless-stopped \
  -p 127.0.0.1:7000:7000 \
  -v felirathub-data:/data \
  pbalazs123/felirathub:latest
```

Then open **`http://localhost:7000/`**, choose your settings and click **Install**.

## 🔐 HTTPS (required for remote access)

Stremio only accepts plain-HTTP addons from `localhost`. To use FeliratHUB from other devices, put it behind a reverse
proxy with HTTPS. Example with Caddy:

```caddyfile
subtitles.example.com {
	reverse_proxy 127.0.0.1:7000
}
```

If Caddy runs in Docker on the same network, use `reverse_proxy felirathub:7000`. Then install the addon from
`https://subtitles.example.com/configure`.

## ⚙️ Environment Variables

All optional.

| Variable | Default | What it does |
|----------|---------|--------------|
| `DATA_DIR` | `/data` | Folder for the request history and statistics (mount a volume there); if it isn't writable, they're kept in memory |
| `CACHE_DIR` | `/data/cache` | Folder for the disk cache, so it survives restarts; if it isn't writable, caching stays in memory |
| `DASHBOARD_PASSWORD` | – | Enables the dashboard at `/dashboard`; without it nothing is recorded |
| `PUBLIC_URL` | – | Public address, e.g. `https://subs.example.com`, if links come out wrong behind a proxy |
| `OPENSUBTITLES` | `1` | `0` turns OpenSubtitles off for new installs |
| `PORT` | `7000` | Port to listen on |
| `APP_BASE_PATH` | – | Serve under a subpath, e.g. `/felirathub` |
| `HISTORY_DAYS` | `30` | Days the request history is kept (daily totals: 90). When kept in memory it's also capped at 50,000 requests |
| `CACHE_DIR_MAX_MB` | `500` | Size limit of the disk cache |
| `SEARCH_CACHE_HOURS` | `12` | How long search results are cached |
| `RATE_LIMIT_PER_SECOND` | `2` | Requests per second to each source |
| `DEBUG_SUBS` | `0` | `1` logs every subtitle search |

## 🔄 Updating

```bash
docker compose pull && docker compose up -d
```

> **Coming from SuperSubtitles?** FeliratHUB is a separate addon (id `community.felirathub`): install it from its
> configure page and remove the old SuperSubtitles addon in Stremio/Nuvio.

## ❓ Troubleshooting

- **No subtitles?** The title may have none in your languages, or a source or language is switched off on the configure
  page.
- **See what's happening:** run with `-e DEBUG_SUBS=1` and check `docker logs felirathub`.

---

FeliratHUB is unofficial and not affiliated with SuperSubtitles, OpenSubtitles, Stremio or Nuvio.
