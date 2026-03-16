---
name: collect
description: Reference for all collect CLI commands — syncing, ingesting, newsletter pipeline, and utilities
---

# collect CLI

Globally installed command for content collection and newsletter production.
Run from the project directory (where `feeds.json` and `newsletter-design.md` live).

## High-level workflows

**First-time setup:**
```
collect init
```

**Weekly newsletter production:**
```
collect ingest && collect newsletter
```

## Commands

### Project setup

- `collect init` — Scaffold a new project: creates `.claude/CLAUDE.md`, skills, config files, `.gitignore`

### Content syncing

- `collect ingest` — Run all sync commands then summarise new articles (sync-rss + sync-github-releases + sync-sitemaps + summarise)
- `collect sync-rss` — Fetch new articles from all RSS feeds in `feeds.json`
- `collect sync-github-releases` — Fetch new releases from repos in `github-releases.json`
- `collect sync-sitemaps` — Fetch new pages from sites in `sitemaps.json`
- `collect summarise` — Summarise any unsummarised articles using Claude

### Newsletter pipeline

- `collect newsletter [--date YYYY-MM-DD] [--days N]` — Run the full 7-step newsletter pipeline. Defaults: today's date, 7 days. Produces `newsletters/YYYY-MM-DD.md`. Progress written to `runs/YYYY-MM-DD/progress.json`
- `collect recent-headers [days] [--date YYYY-MM-DD]` — Collect recent article headers into chunks in `runs/YYYY-MM-DD/`

### Research

- `collect research "query" [--days N]` — Map-reduce research across collected articles. Output in `research/` directory

### Source discovery

- `collect discover-feeds` — Extract RSS feeds from URLs in `discovery/found.txt`, write results to `discovery/feeds.txt`
- `collect append-found <file> <url...>` — Deduplicate and append URLs to a discovery file

### Pipeline utilities

These are used internally by the newsletter pipeline but can be run standalone:

- `collect prepare <evaluations-file> <output-dir>` — Parse evaluations, group articles, chunk for writing
- `collect chunk-articles <list-file> <output-dir>` — Chunk a list of articles with full content
- `collect chunk-headers <list-file> <output-dir>` — Chunk a list of headers (no article bodies)
- `collect extract-includes <output-file> <input-files...>` — Extract INCLUDE header paths from decision files
- `collect combine-lists <output-file> <input-files...>` — Deduplicate and merge text list files

### Output

- `collect pdf <date>` — Convert `newsletters/YYYY-MM-DD.md` to PDF via pandoc/weasyprint
