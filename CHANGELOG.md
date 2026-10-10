# Changelog

Release notes of FeliratHUB. Test builds (the `dev` image) have no entry here.
Published releases are also listed at https://github.com/pbalazs123/felirathub/releases.

## 0.1.0

The first release of **FeliratHUB**: Hungarian and English subtitles for Stremio, from several sources in one list.

- **Two sources.** OpenSubtitles (through Stremio's OpenSubtitles v3 addon, no account needed) is asked first; SuperSubtitles (feliratok.eu) for the languages OpenSubtitles has nothing in, or nothing that matches the played file at least 70%. This keeps the load on feliratok.eu low.
- **The right subtitle.** Other episodes, seasons and same-name films are filtered out; the episode is taken out of ZIP and RAR season packs on the fly; everything arrives as UTF-8, so ő and ű display correctly.
- **Match percentage.** Each subtitle is listed as its language and how well it fits the file you play, e.g. "Magyar · 92%": the source and the release group count most, and the cut for films. The best 2 per language are listed; when the player sends no file name, all of them (as 0%). Forced subtitles for the Hungarian dub are listed as "Magyar · Forced".
- **Configure page.** Choose your languages and sources, then install in the Stremio app or Stremio Web, or copy the addon URL.
- **Dashboard** (optional, with `DASHBOARD_PASSWORD`): an overview with the status of each source, every request with the subtitles that were sent and downloaded, caches and system health. It works on phones and tablets too.
- **Gentle and private.** Caching, a rate limit and a pause after errors protect the sites the addon reads from; the request log keeps only the first part of an IP address and is deleted after 30 days.
- **Self-hosting.** Docker images for `amd64` and `arm64` on Docker Hub and GHCR; mount a volume at `/data` and the history and the disk cache survive restarts.

Coming from SuperSubtitles? FeliratHUB is a separate addon (id `community.felirathub`): install it from its configure page and remove the old one.
