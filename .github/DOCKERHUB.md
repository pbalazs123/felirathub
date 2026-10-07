<img src="https://raw.githubusercontent.com/pbalazs123/felirathub/main/assets/logo-256.png" alt="FeliratHUB logo" width="96" height="96">

# FeliratHUB

**Hungarian & English subtitles for Stremio and Nuvio, from [SuperSubtitles](https://feliratok.eu) (feliratok.eu).**

FeliratHUB is a self-hosted Stremio addon that finds subtitles for movies and series on SuperSubtitles and OpenSubtitles, extracts episodes from
season packs on the fly, drops subtitles for the wrong episode, and ranks the rest to match the release you're playing.

[GitHub](https://github.com/pbalazs123/felirathub) •
[Releases](https://github.com/pbalazs123/felirathub/releases) •
[Report a bug](https://github.com/pbalazs123/felirathub/issues)

---

## ✨ Features

- 🔗 **Two sources, one list**: OpenSubtitles first, SuperSubtitles (feliratok.eu) for the languages it has nothing in
- 🇭🇺 **Hungarian and English** subtitles, or only one of them
- 🏆 **Release ranking**: matching release group, source, resolution and codec come first, with a match percentage
- 🔍 **Right episode and film**: other episodes, seasons and same-name films are filtered out
- 📦 **Season packs**: ZIP/RAR packs are unpacked in memory and the right episode is served
- 🎭 **Forced subtitles** for the Hungarian dub are marked, ranked lower, or hidden
- 🔤 **Correct characters**: subtitles are converted to UTF-8, so ő and ű display correctly
- 🎯 **Configure page** to choose sources, languages and options; install with one click
- 💾 **Optional disk cache** (`CACHE_DIR`) that survives restarts
- 📊 **Dashboard** with sign-in (`DASHBOARD_PASSWORD`): requests, sources' health, caches, CPU and memory; GDPR-friendly
- 🔒 **Hardened**: non-root, no package managers in the image, zip-bomb and size limits

## 🏷️ Tags

| Tag | Description |
|-----|-------------|
| `latest` | Latest release |
| `1.3.5`, `1.3`, `1` | Specific release, minor or major version |
| `dev` | Test builds of upcoming changes (may be unstable) |
| `sha-<commit>` | Build of a specific commit |

All images support **`linux/amd64`** and **`linux/arm64`** (e.g. Raspberry Pi 4/5). The same images are also on
`ghcr.io/pbalazs123/felirathub`.

## 🚀 Quick Start

### Docker Compose (recommended)

```yaml
services:
  felirathub:
    image: pbalazs123/felirathub:latest
    container_name: felirathub
    restart: unless-stopped
    ports:
      - "127.0.0.1:7000:7000"
    environment:
      DATA_DIR: /data
      CACHE_DIR: /data/cache
    volumes:
      - felirathub-data:/data

volumes:
  felirathub-data:
```

```bash
docker compose up -d
```

### Docker Run

```bash
docker run -d \
  --name felirathub \
  --restart unless-stopped \
  -p 127.0.0.1:7000:7000 \
  pbalazs123/felirathub:latest
```

Then open **`http://127.0.0.1:7000/`**, choose your settings, and click **Install**.

## 🔐 HTTPS (required for remote access)

Stremio only accepts plain-HTTP addons from `localhost`. To use the addon from other devices, put it behind a reverse
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

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `7000` | Port the server listens on inside the container |
| `APP_BASE_PATH` | empty | Serve under a subpath, e.g. `/felirathub` (no trailing slash) |
| `PUBLIC_URL` | empty | Public address, e.g. `https://subs.example.com`, if links come out wrong behind a proxy |
| `DASHBOARD_PASSWORD` | empty | Enables the dashboard at `/dashboard`; without it admin sign-in is disabled and nothing is recorded |
| `DATA_DIR` | empty | Folder for the database (request history and daily statistics); without it they're kept in memory only |
| `HISTORY_DAYS` | `30` | How many days the request history is kept (daily totals: 90 days) |
| `CACHE_DIR` | empty | Folder for the disk cache (mount a volume); caches survive restarts |
| `CACHE_DIR_MAX_MB` | `500` | Size limit of the disk cache |
| `OPENSUBTITLES` | `1` | Set to `0` to switch OpenSubtitles off by default for new installs |
| `ADDON_ID` | `community.felirathub` | Set to `community.supersubtitles` on a server that ran SuperSubtitles, so existing installs keep working |
| `MAX_SUBS_PER_LANG` | `2` | Default number of subtitles per language (1 or 2) |
| `RATE_LIMIT_PER_SECOND` | `2` | Maximum requests per second to each site |
| `SEARCH_CACHE_HOURS` | `12` | How long search results are cached (searches without results: 1 hour) |
| `DEBUG_SUBS` | `0` | Set to `1` to log each subtitle search |

## 🔄 Updating

```bash
docker compose pull && docker compose up -d
```

> **Coming from SuperSubtitles?** FeliratHUB is a separate addon (id `community.felirathub`): install it from its
> configure page and remove the old SuperSubtitles addon in Stremio/Nuvio. Replacing SuperSubtitles on the same
> server? Set `ADDON_ID=community.supersubtitles` and existing installs simply become FeliratHUB.

## ❓ Troubleshooting

- **No subtitles?** Check that the title exists on [feliratok.eu](https://feliratok.eu), and that you didn't install
  with a single-language setting.
- **See what's happening:** run with `-e DEBUG_SUBS=1` and check `docker logs felirathub`.

---

Unofficial addon, not affiliated with SuperSubtitles (feliratok.eu), OpenSubtitles, Stremio or Nuvio. Thanks to
[Thsandorh](https://github.com/Thsandorh) for the original Feliratok.eu addon this project grew out of.
