# Vision: Beyond the Newsletter

## The goal

Build a system that can **become and stay an expert on a subject (this document uses Claude Code as a running example)** by
continuously monitoring sources, synthesizing what it finds into a living
knowledge base, and answering questions from that knowledge — like a domain
expert who's been keeping up with the field, not one who has to google it
every time you ask.

Nothing does this end-to-end today. STORM does synthesis but not monitoring.
RSS tools do monitoring but not synthesis. Enterprise knowledge bases do
storage but not external field-tracking. The synthesis and knowledge evolution
layer is the missing piece.

## Source types

RSS feeds are just the starting point. The full corpus should eventually
include:

- Official documentation (updated in place — needs change tracking)
- Changelogs (accumulating documents — need diffing)
- Blog posts and newsletters (RSS)
- Reddit, HN, forum discussions
- Twitter/X threads
- YouTube transcripts, podcast transcripts
- GitHub issues, discussions, PRs
- Research papers and journal articles
- Package registries (npm, PyPI — for ecosystem tracking)

These require different collection mechanisms — see the collection strategies
section below.

## What can we query?

### Direct lookups
- How do I use feature X? (hooks, subagents, worktrees, MCP, CLAUDE.md)
- What does flag/setting Y do?
- What changed in version Z?
- What MCP servers exist and what do they do?

### Synthesis across sources
- What do the official docs say about X vs what the community actually does?
- What are the most common CLAUDE.md patterns people use?
- What workflows do power users describe?
- What are people building with Claude Code? (use case inventory)

### Sentiment and pain points
- What are the most common complaints this month?
- What features are people requesting?
- What breaks or frustrates people? (anti-patterns)
- How do people feel about rate limits / pricing over time?

### Trend analysis
- What topics are growing in discussion volume?
- How has the community's approach to X evolved?
- What new tools/integrations are appearing in the ecosystem?
- What categories of software are emerging?

### Competitive context
- How does Claude Code compare to Cursor/Copilot/Codex for task X?
- What are people switching from/to, and why?
- What can competitors do that Claude Code can't, and vice versa?

### Teaching / onboarding
- If I'm new, what should I read first?
- What are the 5 things every new user gets wrong?
- What's the learning path from beginner to power user?
- Generate a getting-started guide from the best community advice

### Meta-queries
- Where are the gaps in my corpus? What topics have poor coverage?
- Which sources are most/least useful?
- What's duplicated across sources? (5 blogs all covering the same release)

## Derived artifacts

This is the category that's easy to underweight. Once you have a
comprehensive, current corpus, you can **generate things from it**:

- **Weekly newsletter** — what was built first, but automatable further
- **Living documentation** — a "community guide to Claude Code" that's always
  current, synthesized from official docs + blog posts + Reddit
- **FAQ** — auto-generated from the most commonly asked/answered questions
- **Changelog narrative** — turn dry release notes into "here's what matters
  and why"
- **Expert consensus** — "Simon Willison, the sshh.io author, and
  r/ClaudeCode all recommend X for this problem"
- **Contradiction reports** — "official docs say X, but 12 Reddit posts
  report Y actually happens"
- **Ecosystem map** — auto-maintained list of all MCP servers, tools,
  integrations, with descriptions and links

The newsletter alone probably justifies the infrastructure. But the derived
artifacts — a living, auto-updated knowledge base about Claude Code — is the
bigger opportunity.

## Content shapes

Content on the web takes fundamentally different shapes. The shape determines
how you detect changes and what you store.

### Append-only streams
New items appear over time; published items don't change. Blog posts, news
articles, newsletter editions, podcast episodes, YouTube videos, tweets.

The sync question: **"what's new since last time?"** Track a cursor (last
seen item or date) and pull new items.

### Mutable single documents
One document that changes in place. A CHANGELOG that accumulates entries. A
release notes page. A README. A pricing page.

The sync question: **"what changed since last time?"** Fetch the whole thing,
diff against the stored version, extract meaningful changes.

Important sub-distinction: **accumulating documents** (changelogs, release
notes) append new sections — the collector should extract each new section as
a separate item. **Replacing documents** (a pricing page, a README) are
rewritten — the collector should emit a change record describing what's
different.

### Mutable document sets
Many related documents, each updated independently. New pages added, old pages
revised, some pages removed. Documentation sites, wikis, multi-page guides,
GitHub repos (as a set of files).

The sync question is the same as mutable single documents, but with a
discovery step: **"what pages exist now, and which have changed?"** Requires
crawling to enumerate pages, then per-page diffing.

For a knowledge base ("how do I use hooks?"), you want the current state of
each page. For a newsletter ("the docs were updated to cover X"), you want
change records. Eventually you want both.

### Conversations
Multiple authors; content grows as people interact. Reddit threads, GitHub
issues and discussions, HN threads, Discord channels, forum posts.

A hybrid shape: new threads appear (stream-like), but existing threads grow
(mutable). The unit of interest is usually the thread, not the individual
message. Notable threads need to be surfaced; most can be ignored.

### Structured records
Machine-readable data, not prose. npm packages, GitHub repo metadata, API
responses, app store listings. The "document" is a data record that needs to
be transformed into prose or structured facts.

### Media
Non-text content: video, audio, images. Not really a separate shape — it's a
format conversion step layered on top of one of the above. A YouTube channel
is an append-only stream whose items happen to need transcription before they
enter the text pipeline.

## Sync mechanisms

Independent of content shape, there are different ways to detect and fetch
changes.

### Feed subscription
The source maintains a structured stream; you consume it. RSS, Atom, JSON
Feed, webhook notifications, email delivery. Reliable, cheap, standardized.
But the source must provide it, and many don't.

**Status:** built (`sync-rss.ts`, `sync-github-releases.ts`).

### Poll and diff
Fetch a resource periodically, compare to the stored version, extract what
changed. Works for anything with a stable URL. For single documents, text
diff. For document sets, per-page diff.

Needs: storage of previous versions. A way to determine meaningful changes vs
noise (whitespace, timestamps, ad content). A way to segment changes into
individual items (for accumulating documents like changelogs).

**Status:** not built.

### Site crawling
Find all pages in a site (via sitemap.xml, link following, or known URL
patterns), then poll-and-diff each page. A superset of poll-and-diff that adds
a discovery step.

Needs: crawl boundary rules (stay within docs.anthropic.com/en/docs, don't
follow external links). Rate limiting. Sitemap parsing where available.

**Status:** not built.

### API querying
Call a structured API with parameters — date ranges, search terms, pagination.
GitHub API, Reddit API, npm registry, HN API, YouTube Data API.

Structured, filterable, often the most reliable source of truth. But: rate
limits, authentication, API changes, sometimes costs money.

**Status:** not built.

### Index page scraping
Fetch an HTML page that acts as a listing (blog index, news page), extract
links to items, compare against known items, fetch new ones. Works for sites
without feeds or APIs. Fragile — depends on HTML structure, needs custom
selectors or LLM-based extraction per site.

**Status:** not built.

### Media conversion
Fetch audio/video, transcribe to text, then process normally. YouTube has
transcripts via API; podcasts need speech-to-text. Not a sync mechanism per
se — a transform layer on top of another one (usually feed subscription for
discovery).

**Status:** not built.

### Search-based discovery
Run web searches periodically for the topic. Finds content you didn't know to
look for — new sources, one-off articles, things not in any feed. Good for
expanding coverage, bad for systematic tracking. Already partially implemented
via the `/discover` skill, but runs manually rather than on a schedule.

**Status:** partially built (manual discovery skill).

## Shape → mechanism mapping

| Content shape | Primary mechanism | Fallback |
|---|---|---|
| Append-only stream | Feed subscription | API query, index page scraping |
| Accumulating document | Poll + diff → extract sections | — |
| Replacing document | Poll + diff → emit change record | — |
| Mutable document set | Site crawl + per-page diff | — |
| Conversations | API query | Feed (Reddit RSS gives posts, not replies) |
| Structured records | API query | — |
| Media | Feed (discovery) + media conversion (content) | API query + conversion |

All shapes can also benefit from search-based discovery to find new sources.

All collectors output the same downstream format: header YAML + markdown.

## Discovery and source registration

Discovery happens in two steps: **finding sites** and **classifying them as
sources**. The first step works as-is. The second needs rethinking.

### Finding sites (works as-is)

The `/discover` skill asks an agent to search the web for sites relevant to
the topic. This is content-shape-agnostic — the agent finds GitHub repos,
docs sites, YouTube channels, blogs, and forums alike. No changes needed.

### Classifying and registering sources (needs rework)

Currently the step after discovery only looks for RSS feeds. URLs without RSS
(GitHub, YouTube, Discord, etc.) are silently discarded. This made sense when
RSS was the only sync mechanism, but it means the most valuable non-RSS
sources are lost.

This step needs to become a **classification** step: given a URL, determine
what content shape it represents and which sync mechanism to use. Much of this
is inferrable from the URL itself (GitHub repos, Substack blogs, YouTube
channels all have recognisable URL patterns). The discovery agent could also
help by noting what kind of source it found.

The source registry (currently a flat list of RSS URLs) would need to carry
the source type and any config each sync mechanism needs. The details of that
format can be decided when we build it.

## Infrastructure requirements

Most queries need: metadata (date, source) + LLM at query time.

Most also need: summaries — the compression layer that makes query-time LLM
passes affordable.

Some need: full-text search — direct lookups are keyword problems.

A few need: semantic search — fuzzy queries like trend analysis and
contradiction detection. Can ship without this and add later.

Knowing what kind of source something came from (official docs vs Reddit post
vs changelog) matters for most analytical queries. How to encode and expose
that is a design decision for later.
