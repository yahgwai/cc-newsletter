---
name: collect
description: Reference for all collect CLI commands — syncing, ingesting, newsletter pipeline, and utilities
---

# collect CLI

Content collection and newsletter production CLI, bundled with the collect plugin.
Run commands from the project directory (where `config/feeds.json` and `config/newsletter-design.md` live).

All commands use the prefix: `node ${CLAUDE_PLUGIN_ROOT}/dist/collect.js`

## High-level workflows

**First-time setup:**
```
node ${CLAUDE_PLUGIN_ROOT}/dist/collect.js init
```

**Weekly newsletter production:**
```
node ${CLAUDE_PLUGIN_ROOT}/dist/collect.js ingest && node ${CLAUDE_PLUGIN_ROOT}/dist/collect.js newsletter
```

## Commands

### Project setup

- `node ${CLAUDE_PLUGIN_ROOT}/dist/collect.js init` — Scaffold a new project: creates config files and `.gitignore`

### Content syncing

- `node ${CLAUDE_PLUGIN_ROOT}/dist/collect.js ingest` — Run all sync commands then summarise new articles (sync-rss + sync-github-releases + sync-sitemaps + summarise)
- `node ${CLAUDE_PLUGIN_ROOT}/dist/collect.js sync-rss` — Fetch new articles from all RSS feeds in `config/feeds.json`
- `node ${CLAUDE_PLUGIN_ROOT}/dist/collect.js sync-github-releases` — Fetch new releases from repos in `config/github-releases.json`
- `node ${CLAUDE_PLUGIN_ROOT}/dist/collect.js sync-sitemaps` — Fetch new pages from sites in `config/sitemaps.json`
- `node ${CLAUDE_PLUGIN_ROOT}/dist/collect.js summarise` — Summarise any unsummarised articles using Claude

### Newsletter pipeline

- `node ${CLAUDE_PLUGIN_ROOT}/dist/collect.js newsletter [--date YYYY-MM-DD] [--days N]` — Run the full 7-step newsletter pipeline. Defaults: today's date, 7 days. Produces `newsletters/YYYY-MM-DD/newsletter.md`. Progress written to `newsletters/YYYY-MM-DD/progress.json`
- `node ${CLAUDE_PLUGIN_ROOT}/dist/collect.js recent-headers [days] [--date YYYY-MM-DD]` — Collect recent article headers into chunks in `newsletters/YYYY-MM-DD/`

### Source discovery

- `node ${CLAUDE_PLUGIN_ROOT}/dist/collect.js discover-feeds` — Extract RSS feeds from URLs in `discovery/found.txt`, write results to `discovery/feeds.txt`
- `node ${CLAUDE_PLUGIN_ROOT}/dist/collect.js append-found <file> <url...>` — Deduplicate and append URLs to a discovery file

### Pipeline utilities

These are used internally by the newsletter pipeline but can be run standalone:

- `node ${CLAUDE_PLUGIN_ROOT}/dist/collect.js prepare <evaluations-file> <output-dir>` — Parse evaluations, group articles, chunk for writing
- `node ${CLAUDE_PLUGIN_ROOT}/dist/collect.js chunk-articles <list-file> <output-dir>` — Chunk a list of articles with full content
- `node ${CLAUDE_PLUGIN_ROOT}/dist/collect.js chunk-headers <list-file> <output-dir>` — Chunk a list of headers (no article bodies)
- `node ${CLAUDE_PLUGIN_ROOT}/dist/collect.js extract-includes <output-file> <input-files...>` — Extract INCLUDE header paths from decision files
- `node ${CLAUDE_PLUGIN_ROOT}/dist/collect.js combine-lists <output-file> <input-files...>` — Deduplicate and merge text list files

### Output

- `node ${CLAUDE_PLUGIN_ROOT}/dist/collect.js pdf <date>` — Convert `newsletters/YYYY-MM-DD/newsletter.md` to PDF via pandoc/weasyprint
