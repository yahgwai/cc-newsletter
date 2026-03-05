# Newsletter Toolkit: Plugin Design

## What this is

A Claude Code plugin that lets anyone create a newsletter about any subject.
The user installs the plugin, runs `/newsletter:create`, answers some questions,
and gets a working newsletter pipeline — source discovery, content ingestion,
summarisation, and LLM-guided editorial production.

The plugin is the engine. It owns no data. Each newsletter lives in a
user-chosen directory (defaults to cwd) and is fully self-contained.

## User experience

### Creating a newsletter

```
mkdir ~/newsletters/rust-weekly && cd ~/newsletters/rust-weekly
/newsletter:create
```

The skill asks:
- What subject? ("The Rust programming language ecosystem")
- Who's the audience? ("Experienced Rust developers")
- What tone? (Shows a few options, or the user describes it)
- How often? (Weekly, daily)
- Any sources you already know about? (URLs, GitHub repos)

It then:
1. Writes `newsletter.yaml` and `design.md`
2. Seeds `data/feeds.json` and `data/github-releases.json` from user input
3. Runs source discovery to find more feeds
4. Shows the user what it found, lets them adjust
5. Runs first ingest so there's content to work with

### Day-to-day

```
cd ~/newsletters/rust-weekly

/newsletter:discover          # find more sources
/newsletter:ingest            # sync feeds + summarise
/newsletter:draft             # run the full editorial pipeline
/newsletter:draft --daily     # quick daily briefing (lighter process)
/newsletter:review            # load latest draft for editing
/newsletter:pdf               # generate PDF from latest newsletter
```

### Automation

```
/newsletter:automate
```

Sets up cron jobs (or systemd timers, or tells the user what to add):
- Ingest every N hours
- Draft on schedule (using `claude -p` headless mode)
- Notify when a draft is ready for review

## Newsletter directory structure

Everything the user cares about lives here. Back it up, git-track it,
move it — the plugin doesn't care where it is.

```
rust-weekly/                    # user runs claude here
  newsletter.yaml               # identity: subject, audience, schedule
  design.md                     # editorial: tone, sections, word budget
  data/
    feeds.json                  # RSS/Atom feed URLs
    github-releases.json        # GitHub repos to track releases
    feeds/                      # synced articles
      {domain}/
        {slug}-header.yaml      # metadata + summary + mentions
        {slug}.md               # full article content
    discovery/
      found.txt                 # discovered URLs
      checked.json              # feed extraction cache
      skipped.txt               # URLs without feeds
  output/
    newsletters/
      YYYY-MM-DD.md
      YYYY-MM-DD.pdf
    style.css                   # PDF stylesheet (generated on create, editable)
```

### newsletter.yaml

Top-level identity. Read by skills and scripts to know what this
newsletter is about.

```yaml
subject: "The Rust programming language ecosystem"
audience: "Experienced Rust developers"
schedule: weekly
```

Intentionally minimal. The editorial detail lives in `design.md` where
there's room for nuance. This file is for scripts that need a quick
answer to "what is this newsletter?"

### design.md

The editorial brain. Tone, sections, citation rules, word budget,
production pipeline steps. Equivalent to today's `docs/newsletter-design.md`
but generated during `/newsletter:create` and tailored to the subject.

This is the document that LLM agents read when making editorial decisions.
The user can edit it freely — it's their newsletter's voice.

## Plugin structure

```
newsletter-toolkit/
  .claude-plugin/
    plugin.json                 # plugin manifest
  .mcp.json                    # MCP server config
  skills/
    create/SKILL.md             # interactive setup wizard
    discover/SKILL.md           # find new sources
    ingest/SKILL.md             # sync + summarise
    draft/SKILL.md              # full editorial pipeline
    review/SKILL.md             # load draft for editing
    pdf/SKILL.md                # generate PDF
    automate/SKILL.md           # set up scheduled runs
  agents/
    filter/AGENT.md             # relevance filtering subagent
    prioritise/AGENT.md         # prioritisation subagent
    evaluate/AGENT.md           # deep-read evaluation subagent
    writer/AGENT.md             # newsletter writing subagent
    editor/AGENT.md             # editorial pass subagent
  server/                       # MCP server (the engine)
    package.json                # dependencies: rss-parser, turndown, tsx
    src/
      index.ts                  # MCP server entry point
      sync-rss.ts               # feed syncing
      sync-github-releases.ts   # GitHub release syncing
      summarise.ts              # batch summarisation
      discover-feeds.ts         # feed extraction from URLs
      recent-headers.ts         # collect recent headers into chunks
      prepare-articles.ts       # parse evaluations for writing
      chunk-articles.ts         # chunk articles by word count
      chunk-headers.ts          # chunk headers by word count
      combine-lists.ts          # merge + deduplicate lists
      util.ts                   # shared utilities
```

### Why an MCP server

The scripts need dependencies (rss-parser, turndown) and a runtime (tsx).
An MCP server bundles all of this into a single process that starts when
the plugin loads. It exposes the mechanical operations as tools:

| Tool | What it does |
|------|-------------|
| `sync_feeds` | Fetch new articles from all feeds in data/feeds.json |
| `sync_github_releases` | Fetch new releases from tracked repos |
| `summarise` | Summarise unsummarised articles via Claude Haiku |
| `ingest` | sync_feeds + sync_github_releases + summarise |
| `discover_feeds` | Extract RSS/Atom feeds from URLs in discovery/found.txt |
| `recent_headers` | Collect recent headers into chunks, return run dir |
| `prepare_articles` | Parse evaluations, chunk articles for writing |
| `chunk_headers` | Re-chunk a header list |
| `chunk_articles` | Re-chunk an article list |
| `combine_lists` | Merge and deduplicate text files |
| `generate_pdf` | Convert newsletter markdown to PDF |

All tools operate on cwd. No path arguments needed for normal use.

Skills orchestrate these tools with LLM judgment. The mechanical parts
call MCP tools; the editorial parts use subagents.

### Skills vs agents

Skills are user-facing commands (`/newsletter:draft`). Agents are
subagents launched by skills for parallel editorial work.

A skill like `/newsletter:draft` would:
1. Call `ingest` tool (make sure feeds are fresh)
2. Call `recent_headers` tool (collect recent content)
3. Launch filter agents (one per chunk) → combine results
4. Launch prioritise agents (one per chunk) → combine results
5. Call `chunk_articles` tool
6. Launch evaluate agents (one per chunk) → combine results
7. Call `prepare_articles` tool
8. Launch writer agents (one per chunk or one for all)
9. Launch editor agent (final pass)
10. Write output to `output/newsletters/YYYY-MM-DD.md`

The skill prompt describes this orchestration. The agents contain
the editorial judgment prompts (what's relevant, what's worth including,
how to write well).

## Generalisation from the current codebase

### What stays the same

The scripts are already topic-neutral:
- sync-rss.ts, sync-lib.ts — fetch feeds, convert to markdown
- sync-github-releases.ts — fetch releases
- summarise.ts — batch summarisation (system prompt is generic)
- discover-feeds.ts — mechanical feed extraction
- recent-headers.ts, prepare-articles.ts, chunk-*.ts, combine-lists.ts
- util.ts, all tests

These move into the MCP server largely unchanged, wrapped as tool
handlers instead of CLI entry points.

### What changes

**Newsletter design doc** — currently hardcoded for "The Claude Code
Review." Becomes a generated template filled during `/newsletter:create`.
The template defines section types (features, security, techniques,
community, wider world, etc.) and the skill adapts them to the subject.
A Rust newsletter might have: New Releases, RFC Spotlight, Crate of
the Week, Ecosystem, Community. A security newsletter might have:
Vulnerabilities, Advisories, Tools, Research.

**Production pipeline prompts** — currently embedded in
`docs/newsletter-design.md` and `docs/operations.md`. Move into skill
and agent prompt files within the plugin. The pipeline steps are the
same regardless of subject; only the editorial criteria change, and
those come from `design.md` which the agents read at runtime.

**Directory layout** — `data/` and `output/` replace the current
`data/feeds/` and `data/newsletters/` split. `docs/` goes away (the
plugin owns the process docs; the user's `design.md` is at the root).

**package.json scripts** — replaced by MCP tools. No npm scripts in
the user's directory.

### What the user's directory does NOT contain

- No `src/` directory
- No `package.json`
- No `node_modules/`
- No test files
- No process documentation

The user's directory is pure content and config. The engine lives in
the plugin.

## Automation via headless mode

`/newsletter:automate` sets up scheduled runs using `claude -p`
(headless CLI mode). The cron entry would look something like:

```
# Ingest every 4 hours
0 */4 * * * cd ~/newsletters/rust-weekly && claude -p "run /newsletter:ingest"

# Draft every Sunday at 8pm
0 20 * * 0 cd ~/newsletters/rust-weekly && claude -p "run /newsletter:draft"
```

The `claude -p` invocations have access to the same plugin and MCP
tools as interactive sessions. The skills handle everything; no
separate shell scripts needed.

## Open questions

### Section templates
How much structure should `/newsletter:create` impose? Options:
- Offer a few newsletter archetypes (product-focused, ecosystem-focused,
  research-focused) with pre-built section lists
- Let the LLM generate sections based on the subject description
- Start minimal (briefing + 3 sections + hot take) and let the user add more

Leaning toward: LLM generates a first draft of sections based on subject
and audience, user adjusts. The current Claude Code newsletter sections
emerged from iteration, not upfront design — the setup wizard should
facilitate the same process quickly.

### Daily vs weekly
The current pipeline is built for weekly depth. A daily briefing needs
a lighter process — maybe just summarise what's new and highlight the
top 3 items, no deep-read step. The `/newsletter:draft --daily` flag
would trigger a shorter pipeline. Details TBD.

### Plugin dependencies
The MCP server needs Node.js and its npm dependencies. PDF generation
needs pandoc and weasyprint. How to handle missing system dependencies:
- Check on first use and tell the user what to install
- Offer to install them (platform-specific)
- Make PDF optional (it already is — the newsletter is markdown-first)

### Summarisation model
Currently hardcodes Claude Haiku via the `claude` CLI. Should this be
configurable? Haiku is the right default (fast, cheap, good enough for
summaries), but some users might want a different model. Could be a
field in `newsletter.yaml`.

### Multiple newsletters, one machine
Nothing prevents running multiple newsletters — they're independent
directories. But if someone has 10 newsletters, they might want to
share a feed cache (some feeds are relevant to multiple topics) or
run discovery across all of them. Not designing for this now, but
the directory-per-newsletter approach doesn't preclude it.
