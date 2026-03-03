# Operations

## Quick reference

| Command | What it does |
|---------|-------------|
| `npm run ingest` | Sync all feeds then summarise new articles |
| `npm run sync` | Fetch new articles from all feeds |
| `npm run summarise` | Summarise any unsummarised articles |
| `npm run collect` | Collect recent headers into chunks for newsletter |
| `npm run prepare -- <evaluations> <output-dir>` | Prepare evaluated articles for writing |
| `npm run pdf -- YYYY-MM-DD` | Convert a newsletter markdown to PDF |
| `npm test` | Run tests |

## Day-to-day: ingesting content

Run this regularly (daily, or before generating a newsletter):

```
npm run ingest
```

This syncs all RSS feeds and summarises any new articles. Sync fetches from
every feed in `feeds.json` and writes articles to `feeds/`. Summarise picks
up any articles without summaries and sends them to Claude Haiku in batches.

The summarise step uses a lock file (`.summarise.lock`) so concurrent runs
don't collide.

## Occasionally: discovering new sources

When you want to expand coverage:

1. Run `/discover` in Claude Code — the agent searches the web and appends
   URLs to `discovery/found.txt`
2. Extract feeds: `npx tsx discover-feeds.ts`
3. Run `npm run ingest` to pull content from the new feeds

Discovery is iterative. Say "find more" or "focus on security blogs" to
steer subsequent runs. No need to do this every week — the feed list is
stable once you have good coverage.

## Weekly: generating a newsletter

The full pipeline is documented in `docs/newsletter-design.md`. The short
version:

```
# 1. Make sure feeds are fresh
npm run ingest

# 2. Collect recent headers into chunks
npm run collect

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
feeds.json              # list of RSS feed URLs
feeds/                  # synced articles (gitignored)
  {domain}/
    {slug}-header.yaml  # metadata: title, link, date, summary, mentions
    {slug}.md           # full article content
discovery/              # feed discovery working files (gitignored)
  found.txt             # discovered URLs
  checked.json          # feed extraction cache
docs/
  project-design.md     # design rationale for the collection system
  newsletter-design.md  # newsletter format, tone, and production pipeline
  operations.md         # this file
newsletters/
  style.css             # PDF stylesheet
  YYYY-MM-DD.md         # generated newsletters
  YYYY-MM-DD.pdf        # PDF versions
```
