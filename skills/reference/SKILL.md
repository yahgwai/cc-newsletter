---
name: reference
description: Reference for all cc-newsletter CLI commands — syncing, ingesting, newsletter pipeline, and utilities
---

# cc-newsletter CLI

Content collection and newsletter production CLI, bundled with the cc-newsletter plugin.
Every command takes a `<data-dir>` argument — the full path to the newsletter's data directory.

All commands use the prefix: `node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js <command> <data-dir>`

When invoked from skills, the data dir is `${CLAUDE_PLUGIN_DATA}/<name>`.

## High-level workflows

**First-time setup:**
```
node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js init ${CLAUDE_PLUGIN_DATA}/my-newsletter
```

**Weekly newsletter production:**
```
node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js ingest ${CLAUDE_PLUGIN_DATA}/my-newsletter && node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js newsletter ${CLAUDE_PLUGIN_DATA}/my-newsletter
```

## Commands

### Management

- `ls ${CLAUDE_PLUGIN_DATA}` — List existing newsletters (each directory is a newsletter)
- `node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js init <data-dir>` — Scaffold a new newsletter: creates config files and `.gitignore` in the data directory

### Content syncing

- `node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js ingest <data-dir>` — Run all sync commands then summarise new articles (sync-rss + sync-github-releases + sync-sitemaps + summarise)
- `node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js sync-rss <data-dir>` — Fetch new articles from all RSS feeds in `feeds.json`
- `node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js sync-github-releases <data-dir>` — Fetch new releases from repos in `github-releases.json`
- `node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js sync-sitemaps <data-dir>` — Fetch new pages from sites in `sitemaps.json`
- `node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js summarise <data-dir>` — Summarise any unsummarised articles using Claude

### Newsletter pipeline

- `node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js newsletter <data-dir> [--date YYYY-MM-DD] [--days N]` — Run the full 7-step newsletter pipeline. Defaults: today's date, 7 days. Produces `newsletters/YYYY-MM-DD/newsletter.md`. Progress written to `newsletters/YYYY-MM-DD/progress.json`
- `node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js recent-headers <data-dir> [days] [--date YYYY-MM-DD]` — Collect recent article headers into chunks in `newsletters/YYYY-MM-DD/`

### Source discovery

- `node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js discover-feeds <data-dir>` — Extract RSS feeds from URLs in `discovery/found.txt`, write results to `discovery/feeds.txt`
- `node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js append-found <data-dir> <file> <url...>` — Deduplicate and append URLs to a discovery file

### Pipeline utilities

These are used internally by the newsletter pipeline but can be run standalone:

- `node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js prepare <data-dir> <evaluations-file> <output-dir>` — Parse evaluations, group articles, chunk for writing
- `node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js chunk-articles <data-dir> <list-file> <output-dir>` — Chunk a list of articles with full content
- `node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js chunk-headers <data-dir> <list-file> <output-dir>` — Chunk a list of headers (no article bodies)
- `node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js extract-includes <data-dir> <output-file> <input-files...>` — Extract INCLUDE header paths from decision files
- `node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js combine-lists <data-dir> <output-file> <input-files...>` — Deduplicate and merge text list files

### Output

- `node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js html <data-dir> <date>` — Convert `newsletters/YYYY-MM-DD/newsletter.md` to HTML

### Scheduling

The setup wizard (`/cc-newsletter:setup`) offers to install cron jobs for automatic ingestion and newsletter generation. Crontab entries use marker comments (`# cc-newsletter:<name>:<ingest|newsletter>`) so they can be identified and managed later. Run `crontab -l | grep cc-newsletter` to see installed schedules.
