# Changelog

Release notes for versions that aren't published as a GitHub release yet (development builds).
Published releases are listed at https://github.com/pbalazs123/felirathub/releases.

## 1.0.0-beta.1

The first beta of **FeliratHUB**, a new addon written from scratch. It succeeds SuperSubtitles 1.x as a separate addon (id `community.felirathub`), so install it from its configure page and remove the old one.

- **Name and logo.** FeliratHUB brings several sources together, with its own logo in the Stremio and Nuvio addon lists.
- **Two sources, one list.** OpenSubtitles (through Stremio's OpenSubtitles v3 addon, no account needed) joins SuperSubtitles (feliratok.eu). OpenSubtitles is asked first; SuperSubtitles only for the languages OpenSubtitles has nothing in, to keep the load on feliratok.eu low.
- **New configure page.** Sections for General, Sources and About with clear explanations; choose languages, 1 or 2 subtitles per language, whether to show forced subtitles, and which sources to use. Install in the Stremio app, Stremio Web or Nuvio. *What's new* shows the release notes.
- **Better matches.** Movie results must match the film's title and year, so same-name films (*The Matrix* vs *The Matrix Revolutions*) no longer mix; titles like *Dune: Part One* are also found under their short name; extras and forced subtitles rank below full subtitles.
- **Forced subtitles** (for the Hungarian dub) are listed under Hungarian as "Magyar · Forced", so they work in every app; in Nuvio they can also get their own "Forced" group, or be hidden.
- **Clean subtitle names.** Players show just the language and how well the subtitle matches what you play, e.g. "Magyar · 92%" ("Magyar · Forced · 64%" for forced ones); the file names are in the dashboard.
- **Gentler on feliratok.eu.** Series are looked up with one request per season (the site's own listing, with every release each subtitle fits, so the match percentage is more accurate) instead of two search pages. A site that answers "too many requests" or fails 3 times in a row is paused for 5–60 minutes (shown on the dashboard), and subtitles deleted from feliratok.eu are left out after their first failed download.
- **Dashboard.** A sign-in page (admin only, disabled without `DASHBOARD_PASSWORD`) and five tabs: *Overview* with the status of each source, *Live* requests of the last 5 minutes and a searchable *History* (one compact row per request with type, shortened IP, URL, number of subtitles, status, duration and time; click a row for the full URL and the subtitles served with their source; installs and configure page visits only count in the totals), *Caches* with hit rates and 24-hour charts, and *System* health.
- **Privacy.** The request log keeps only the first part of an IP address (e.g. `203.•••.•.•`); nothing is recorded without the dashboard.
- **Faster and gentler.** Searches, titles and subtitle files are cached; an optional disk cache (`CACHE_DIR`) survives restarts.
- **History and statistics that survive restarts.** With `DATA_DIR`, the request history (30 days, adjustable with `HISTORY_DAYS`) and daily totals (90 days, no personal data) are kept in a small SQLite database; the dashboard shows 7- and 30-day charts.
- **Security.** Stricter checks on incoming requests, security headers, zip-bomb and sign-in limits, and a smaller Docker image without package managers.
- **MIT license.**
