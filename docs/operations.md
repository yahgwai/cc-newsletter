# Operations

## Quick reference

| Command | What it does |
|---------|-------------|
| `collect ingest` | Sync all sources then summarise new articles |
| `collect sync-rss` | Fetch new articles from all RSS feeds |
| `collect sync-github-releases` | Fetch new releases from GitHub repos |
| `collect sync-sitemaps` | Fetch new pages from tracked sitemaps |
| `collect summarise` | Summarise any unsummarised articles |
| `collect recent-headers` | Collect recent headers into chunks for newsletter |
| `collect prepare <evaluations> <output-dir>` | Prepare evaluated articles for writing |
| `collect pdf YYYY-MM-DD` | Convert a newsletter markdown to PDF |
| `npm test` | Run tests |

## Day-to-day: ingesting content

Run this regularly (daily, or before generating a newsletter):

```
collect ingest
```

This syncs all sources and summarises any new articles. `sync-rss` fetches from
every feed in `feeds.json`; `sync-github-releases` fetches from every repo
in `github-releases.json`; `sync-sitemaps` fetches from every sitemap URL
in `sitemaps.json`. All write articles to `feeds/`. Summarise
picks up any articles without summaries and sends them to Claude Haiku in
batches.

To capture sync logs for the audit trail:

```
collect ingest 2>&1 | tee -a sync-log/$(date +%Y-%m-%d).log
```

## Occasionally: discovering new sources

When you want to expand coverage:

1. Run `/discover` — the agent searches the web and appends
   URLs to `discovery/found.txt`
2. Extract feeds: `collect discover-feeds`
3. Run `collect ingest` to pull content from the new feeds

Discovery is iterative. Say "find more" or "focus on security blogs" to
steer subsequent runs. No need to do this every week — the feed list is
stable once you have good coverage.

### GitHub releases

`github-releases.json` is a hand-curated list of repos whose release
notes serve as the source of truth for what shipped. This is not
automatically populated — review candidates by looking at relevant repos and their recent release notes, then decide together which
ones have substantive changelogs worth tracking. The bar is high: only repos
whose releases are an authoritative primary source for changes that affect
users, not ecosystem tools or SDK version bumps.

### Sitemaps

`sitemaps.json` is a hand-curated list of sitemap URLs for sites that
don't offer RSS feeds but publish content relevant to the newsletter. This
covers official documentation and pages relevant to your newsletter's subject. Review candidates — check whether the
site has a sitemap (`/sitemap.xml` or via `robots.txt`), whether the content
is substantive enough to track, and whether RSS isn't already covering it.
Prefer RSS when available; sitemaps are the fallback for sites that don't
syndicate.

Pages from sitemaps with `lastmod` timestamps are re-fetched when the
sitemap date is newer than the stored date. Pages without `lastmod` are
re-fetched if the local file is older than 6 days.

## Weekly: generating a newsletter

The full pipeline is documented in `newsletter-design.md`. The short
version:

```
# 1. Make sure feeds are fresh
collect ingest

# 2. Collect recent headers into chunks
collect recent-headers

# 3. Steps 2-7 are LLM steps run by Claude
#    Tell Claude: "Run the newsletter pipeline following newsletter-design.md"

# 4. After the newsletter is written, generate the PDF
collect pdf YYYY-MM-DD
```

Steps 2-7 of the pipeline (filtering, prioritising, deep reading, writing,
editorial pass) are described in detail in `newsletter-design.md` and
are run by Claude using subagents.

## File layout

```
src/                    # source code (in collect-runner package)
  sync-rss.ts           # sync all RSS feeds
  sync-lib.ts           # RSS parsing, HTML conversion, dedup
  sync-github-releases.ts      # sync GitHub releases
  sync-github-releases-lib.ts  # GitHub releases fetching, dedup
  sync-sitemap.ts              # sync sitemaps
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
  cli.ts                # CLI dispatcher
  *.test.ts             # tests

# Project directory (cwd)
feeds.json            # list of RSS feed URLs
github-releases.json  # list of GitHub repos to track releases
sitemaps.json         # list of sitemap URLs to track
feeds/                # synced articles
  {domain}/
    {slug}-header.yaml  # metadata: title, link, date, summary, mentions
    {slug}.md           # full article content
discovery/            # feed discovery working files
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
```
