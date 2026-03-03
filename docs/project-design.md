# collect-runner: Project Design

## Purpose

collect-runner is a content collection system for following a subject across the web. You pick a subject — e.g. "development with Claude Code" — and the system discovers sources, syncs their feeds, and processes the content.

The core insight: **collection and consumption are separate problems.** Cast a wide net at collection time; filter and surface what matters later.

> Storage is cheap. Markdown files are tiny. Noise is filterable. An agent can triage, summarize, and surface what matters from 500 entries far better than you can predict upfront which 20 feeds will be valuable.

> Relevance shifts. A feed that seems marginal today might have the one post you need next week. If you're not subscribed, you miss it.

> Discovery is lossy. If you over-curate at discovery time, you're making a permanent decision with incomplete information.

## Pipeline

1. **Discover** — `/discover {subject}` — agent searches the web, finds relevant sites, appends their URLs to `discovery/found.txt`
2. **Extract feeds** — `npx tsx discover-feeds.ts` — mechanically finds RSS/Atom feeds from discovered URLs
3. **Sync** — `npm run sync` — fetches all feeds, converts entries to Markdown files
4. **Summarise** — `npx tsx summarise.ts` — sends articles to Claude Haiku for summarisation

Run `/discover` again or say "find more" to expand coverage iteratively. No structured depth control — just natural language: "find me RSS feeds about development with Claude Code — cast a wide net."

## Architecture: Agent vs Script

Agents do the searching and judgment. Scripts do the mechanical work.

**What the agent does:**
- Decides what to search for
- Evaluates which results are relevant
- Manages the iterative "find more" loop

**What scripts do:**
- `append-found.ts` — deduplicates and appends URLs to `found.txt`
- `discover-feeds.ts` — mechanical feed extraction (HTML autodiscovery, known platform patterns, common path probing)
- `sync-lib.ts` / `sync.ts` — fetches feeds, converts to Markdown, writes to disk
- `summarise.ts` — batches articles and sends to Claude Haiku for summarisation

The discover prompt runs as a Claude Code skill in the main conversation, not as a subagent. This allows steering ("find more," "focus on GitHub repos") without indirection.

## Discovery Design

### Find sites, not feeds

The agent searches for relevant sites, not specifically RSS feeds. Searching for "RSS" biases toward sites that advertise it and misses good sources that have feeds but don't mention them prominently. Feed extraction is a separate mechanical step.

### Iterative, not exhaustive-upfront

Rather than defining categories and search quotas, the approach is:
1. Ask the agent to search for the subject
2. It stores what it searched for and what it found
3. Ask for more sources if you want more — "search for more, but don't duplicate what you already have"

The agent implicitly prioritises core sources first, and moves into the long tail with repeated asks. No idea of "core" vs "long tail" is encoded — it emerges from the search order.

### One working file

`discovery/found.txt` — one URL per line. No categories, no todo/done split. The agent can infer what's been searched from what's been found. Redundant searches are cheap.

URL deduplication is done by prompt instruction ("store the most canonical URL") plus exact dedup in `append-found.ts`. No mechanical URL normalisation.

### Categories as prompt hints

The discover skill prompt includes category hints — "consider official sources, GitHub repos, personal blogs, community forums, aggregators, newsletters" — to remind the agent of places to look, not as structural splits requiring separate searches.

### Link-following (deferred)

Expanding the reference graph (scanning collected content for links to new sources) was discussed and shelved. It's expensive (requires LLM processing of all content), noisy (links go to irrelevant sites), and the search-based discovery may be sufficient. Can be revisited later.

## Feed Extraction (`discover-feeds.ts`)

Three strategies tried in order for each URL:

1. **Known platform patterns** — Substack `/feed`, dev.to `/feed/{username}`, Medium `/feed/{path}`
2. **HTML autodiscovery** — `<link rel="alternate" type="application/(rss|atom)+xml">`
3. **Common path probing** — tries `/feed`, `/rss`, `/feed.xml`, `/rss.xml`, `/atom.xml`, `/index.xml` at both the URL path and origin levels

Sites that won't have standard RSS are skipped (GitHub, Discord, Twitter/X, YouTube, Spotify, npm, arxiv, Reddit, etc.).

Results are cached in `discovery/checked.json`. URLs where no feed was found go to `discovery/no-feed.txt`, skipped URLs to `discovery/skipped.txt`.

## Feed Metadata (intentionally absent)

A structured schema was proposed (`tier`, `type`, `scope`, `name` per feed) and rejected. It was designing for a consumption system that doesn't exist yet.

`feeds.json` is a flat array of URL strings. If metadata is needed later, it's cheap to add — re-run discovery or enrich existing entries.

## Downstream Processing

### The noise problem

The harder noise isn't irrelevant feeds (a blog about cooking is obviously excluded) — it's bad or false information within relevant feeds. Wrong usage patterns, hype without substance.

This can't be solved at discovery time. It requires cross-referencing at consumption time: if 28 out of 30 sources say one thing and 2 say something different, that's a signal. Breadth of collection helps quality filtering.

### Two-layer filtering model

1. **Discovery-time** — is this feed relevant to the subject at all? The grey area is small.
2. **Entry-level** — is this specific post worth surfacing? This is the unsolved problem, deferred to when the consumption side is built.

### Summarisation (built)

`summarise.ts` processes articles that don't yet have summaries:
- Batches by token count (80K max) and article count (20 max per batch)
- Sends to Claude Haiku via the `claude` CLI with structured JSON output
- Writes a summary (1–10 sentences, scaled to content depth) and mentions list to each article's header YAML
- Handles empty/stub content without calling the LLM
- Runs batches in parallel (default 3) with rate limiting

### Relevance checking (lightweight approach, not yet built)

Grep for keywords in documents, pull surrounding lines, pass that small chunk to an LLM for a yes/no relevance check. No vector DB — that's a big dependency for what's essentially "does this page mention my subject."
