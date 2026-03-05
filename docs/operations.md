# Operations

## Quick reference

| Command | What it does |
|---------|-------------|
| `npm run ingest` | Sync all sources then summarise new articles |
| `npm run sync-rss` | Fetch new articles from all RSS feeds |
| `npm run sync-github-releases` | Fetch new releases from GitHub repos |
| `npm run sync-sitemaps` | Fetch new pages from tracked sitemaps |
| `npm run summarise` | Summarise any unsummarised articles |
| `npm run recent-headers` | Collect recent headers into chunks for newsletter |
| `npm run prepare -- <evaluations> <output-dir>` | Prepare evaluated articles for writing |
| `npm run pdf -- YYYY-MM-DD` | Convert a newsletter markdown to PDF |
| `npm test` | Run tests |

## Day-to-day: ingesting content

Run this regularly (daily, or before generating a newsletter):

```
npm run ingest
```

This syncs all sources and summarises any new articles. `sync-rss` fetches from
every feed in `data/feeds.json`; `sync-github-releases` fetches from every repo
in `data/github-releases.json`; `sync-sitemaps` fetches from every sitemap URL
in `data/sitemaps.json`. All write articles to `data/feeds/`. Summarise
picks up any articles without summaries and sends them to Claude Haiku in
batches.

The summarise step uses a lock file (`.summarise.lock`) so concurrent runs
don't collide.

To capture sync logs for the audit trail:

```
npm run ingest 2>&1 | tee -a data/sync-log/$(date +%Y-%m-%d).log
```

## Occasionally: discovering new sources

When you want to expand coverage:

1. Run `/discover` in Claude Code — the agent searches the web and appends
   URLs to `data/discovery/found.txt`
2. Extract feeds: `npx tsx src/discover-feeds.ts`
3. Run `npm run ingest` to pull content from the new feeds

Discovery is iterative. Say "find more" or "focus on security blogs" to
steer subsequent runs. No need to do this every week — the feed list is
stable once you have good coverage.

### GitHub releases

`data/github-releases.json` is a hand-curated list of repos whose release
notes serve as the source of truth for what shipped. This is not
automatically populated — review candidates with Claude Code by looking at
the org's repos and their recent release notes, then decide together which
ones have substantive changelogs worth tracking. The bar is high: only repos
whose releases are an authoritative primary source for changes that affect
users, not ecosystem tools or SDK version bumps.

### Sitemaps

`data/sitemaps.json` is a hand-curated list of sitemap URLs for sites that
don't offer RSS feeds but publish content relevant to the newsletter. This
covers official Anthropic pages, Claude Code documentation, API docs, and the
MCP specification. Review candidates with Claude Code — check whether the
site has a sitemap (`/sitemap.xml` or via `robots.txt`), whether the content
is substantive enough to track, and whether RSS isn't already covering it.
Prefer RSS when available; sitemaps are the fallback for sites that don't
syndicate.

Pages from sitemaps with `lastmod` timestamps are re-fetched when the
sitemap date is newer than the stored date. Pages without `lastmod` are
re-fetched if the local file is older than 6 days.

## Weekly: generating a newsletter

The full pipeline is documented in `docs/newsletter-design.md`. The short
version:

```
# 1. Make sure feeds are fresh
npm run ingest

# 2. Collect recent headers into chunks
npm run recent-headers

# 3. Steps 2-7 are LLM steps run by Claude Code
#    Tell Claude: "Run the newsletter pipeline following docs/newsletter-design.md"

# 4. After the newsletter is written, generate the PDF
npm run pdf -- YYYY-MM-DD
```

Steps 2-7 of the pipeline (filtering, prioritising, deep reading, writing,
editorial pass) are described in detail in `docs/newsletter-design.md` and
are run by Claude Code using subagents.

## File layout

```
src/                    # source code
  sync-rss.ts           # entry point: sync all RSS feeds
  sync-lib.ts           # RSS parsing, HTML conversion, dedup
  sync-github-releases.ts      # entry point: sync GitHub releases
  sync-github-releases-lib.ts  # GitHub releases fetching, dedup
  sync-sitemap.ts              # entry point: sync sitemaps
  sync-sitemap-lib.ts          # sitemap parsing, page fetching, dedup
  summarise.ts          # batch summarisation pipeline
  discover-feeds.ts     # mechanical feed extraction from URLs
  append-found.ts       # dedup + append to found.txt
  recent-headers.ts     # collect recent headers into chunks
  prepare-articles.ts   # parse evaluations, prepare for writing
  chunk-articles.ts     # chunk article list with full content
  chunk-headers.ts      # chunk header list
  extract-includes.ts   # parse decision files, output INCLUDE paths
  combine-lists.ts      # dedup + merge text files
  util.ts               # shared utilities (word count, chunking)
  *.test.ts             # tests
data/
  feeds.json            # list of RSS feed URLs (gitignored)
  github-releases.json  # list of GitHub repos to track releases
  sitemaps.json         # list of sitemap URLs to track
  feeds/                # synced articles (gitignored)
    {domain}/
      {slug}-header.yaml  # metadata: title, link, date, summary, mentions
      {slug}.md           # full article content
  discovery/            # feed discovery working files (gitignored)
    found.txt           # discovered URLs
    checked.json        # feed extraction cache
  runs/                 # pipeline run artifacts (audit trail)
    YYYY-MM-DD/
      chunk-*.md          # collected headers
      filter-*.md         # Step 2 decisions (INCLUDE/EXCLUDE with reasons)
      relevant.txt        # combined INCLUDE paths from filtering
      prioritise-*.md     # Step 3 decisions (INCLUDE/EXCLUDE with reasons)
      shortlist.txt       # combined INCLUDE paths from prioritising
      evaluations.md      # Step 4 deep-read evaluations
      draft.md            # pre-editorial draft (Step 7)
      editorial-changes.md # editorial changelog (Step 7)
  newsletters/
    style.css           # PDF stylesheet
    YYYY-MM-DD.md       # generated newsletters
    YYYY-MM-DD.pdf      # PDF versions
docs/
  project-design.md     # design rationale for the collection system
  newsletter-design.md  # newsletter format, tone, and production pipeline
  operations.md         # this file
```
