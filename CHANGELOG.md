# Changelog

Release notes for versions that aren't published as a GitHub release yet (development builds).
Published releases are listed at https://github.com/pbalazs123/felirathub/releases.

## 1.0.0-beta.1

The first beta of **FeliratHUB**, a new addon written from scratch. It succeeds SuperSubtitles 1.x as a separate addon (id `community.felirathub`), so install it from its configure page and remove the old one. A server that ran SuperSubtitles can set `ADDON_ID=community.supersubtitles` instead, and the addons installed from it simply become FeliratHUB.

- **Name and logo.** FeliratHUB brings several sources together, with its own logo in the Stremio and Nuvio addon lists.
- **Two sources, one list.** OpenSubtitles (through Stremio's OpenSubtitles v3 addon, no account needed) joins SuperSubtitles (feliratok.eu). OpenSubtitles is asked first; SuperSubtitles only for the languages OpenSubtitles has nothing in, or (when the player sends the file name) nothing that matches it at least 70%, to keep the load on feliratok.eu low.
- **New configure page.** Sections for General, Sources and About with clear explanations; choose languages and sources. Install in the Stremio app, Stremio Web or Nuvio. *What's new* shows the release notes.
- **Better matches.** Movie results must match the film's title and year, so same-name films (*The Matrix* vs *The Matrix Revolutions*) no longer mix; titles like *Dune: Part One* are also found under their short name; extras and forced subtitles rank below full subtitles.
- **Forced subtitles** (for the Hungarian dub) are listed under Hungarian as "Magyar · Forced", after the full ones, so they work in every app.
- **Clean subtitle names.** Players show just the language and how well the subtitle matches what you play, e.g. "Magyar · 92%" ("Magyar · Forced · 64%" for forced ones; 0% when the player doesn't send the file name); the file names are in the dashboard.
- **Scoring like Bazarr.** The match percentage uses Bazarr's weights: the source (WEB-DL, WEBRip and WEB count as one) and the release group decide most, a group only counts together with its source, films also compare the cut (Extended, Director's Cut…), and resolution and codec hardly matter. A subtitle for the exact episode comes before a season pack with the same match.
- **Gentler on feliratok.eu.** Series are looked up with one request per season (the site's own listing, with every release each subtitle fits, so the match percentage is more accurate) instead of two search pages. A site that answers "too many requests" or fails 3 times in a row is paused for 5–60 minutes (shown on the dashboard), and subtitles deleted from feliratok.eu are left out after their first failed download.
- **Dashboard.** A sign-in page (admin only, disabled without `DASHBOARD_PASSWORD`) and four tabs: *Overview* with the status of each source, a searchable *Requests* tab of every request (one line per request, a search together with the subtitle downloads that followed it; open a line for the poster, title and year, the client ID (the app that asked, also shown as a column), the request, the file name, the subtitles sent to the player with the score it showed, and the ones downloaded; installs and configure page visits only count in the totals), *Caches* with hit rates and 24-hour charts, and *System* health.
- **Privacy.** The request log keeps only the first part of an IP address (e.g. `203.•••.•.•`); nothing is recorded without the dashboard.
- **Faster and gentler.** Searches, titles and subtitle files are cached; a disk cache (in `/data/cache` in the Docker image) survives restarts. Both keep what is used most: when full, the least recently used entries go first (LRU).
- **History and statistics that survive restarts.** In a volume mounted at `/data` (or with `DATA_DIR`), the request history (30 days, adjustable with `HISTORY_DAYS`) and daily totals (90 days, no personal data) are kept in a small SQLite database; the dashboard shows 7- and 30-day charts. Without `DATA_DIR` the history stays in memory, capped at 50,000 requests so it can't use up the server's memory.
- **Security.** Stricter checks on incoming requests, security headers, zip-bomb and sign-in limits, and a smaller Docker image without package managers.
- **MIT license.**
