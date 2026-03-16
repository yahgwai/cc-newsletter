# Newsletter Toolkit: Plugin Design

## What this is

A Claude Code plugin that lets anyone create a newsletter about any subject.
The user installs the plugin, runs `/newsletter-toolkit:create`, answers some
questions, and gets a working newsletter pipeline — source discovery, content
ingestion, summarisation, and LLM-guided editorial production.

One install, everything works. The plugin bundles the collection engine
(feed syncing, chunking, summarisation) alongside the editorial brain
(commands, agents). Each newsletter lives in a user-chosen directory
and is fully self-contained.

## Current state

collect-runner works as a CLI tool + Claude Code skills:

- `npm install -g collect-runner` gives the user the `collect` command
- `collect init` scaffolds a project by copying skill templates into
  `.claude/skills/`
- The skills call `collect` commands via Bash
- The user runs skills like `/setup` and `/discover` interactively

Problems with this approach:
- Two install steps: npm package + manually running `collect init`
- Skills live in each project's `.claude/` as copies — updates require
  re-running `collect init`
- No agent definitions — the pipeline prompts live in
  `newsletter-design.md` and the user (or Claude) interprets them
  manually each run

## What the plugin changes

Everything ships as one plugin. The TypeScript source that currently
lives in collect-runner moves into the plugin's `server/` directory
and is pre-built to `server/dist/`. Commands call it via
`node ${CLAUDE_PLUGIN_ROOT}/server/dist/cli.js` instead of a globally
installed `collect` binary. No separate npm install, no `collect init`,
no copying files around.

The engine uses `claude -p` (headless CLI mode) for summarisation and
research, so the only prerequisite is Claude Code itself — which the
user already has.

## User experience

### First-time setup

```
/plugin install newsletter-toolkit@<marketplace>
```

### Creating a newsletter

```
mkdir ~/newsletters/rust-weekly && cd ~/newsletters/rust-weekly
/newsletter-toolkit:create
```

The command asks:
- What subject? ("The Rust programming language ecosystem")
- Who's the audience? ("Experienced Rust developers")
- What tone? (Shows options, or the user describes it)
- Any sources you already know about? (URLs, GitHub repos)

It then:
1. Writes `newsletter-design.md` (editorial brain: tone, sections, pipeline)
2. Seeds `feeds.json` and `github-releases.json` from user input
3. Runs source discovery to find more feeds
4. Shows the user what it found, lets them adjust
5. Runs first ingest so there's content to work with

### Day-to-day

```
cd ~/newsletters/rust-weekly

/newsletter-toolkit:discover       # find more sources
/newsletter-toolkit:ingest         # sync feeds + summarise
/newsletter-toolkit:draft          # run the full editorial pipeline
/newsletter-toolkit:review         # load latest draft for editing
/newsletter-toolkit:pdf            # generate PDF from latest newsletter
```

### Automation

```
# Ingest every 4 hours
0 */4 * * * cd ~/newsletters/rust-weekly && claude -p "/newsletter-toolkit:ingest"

# Draft every Sunday at 8pm
0 20 * * 0 cd ~/newsletters/rust-weekly && claude -p "/newsletter-toolkit:draft"
```

Both run via `claude -p` so the plugin's commands are available. Ingest
uses `claude -p --model haiku` internally for batch summarisation.

## Newsletter directory structure

Everything the user cares about lives here. The plugin doesn't care where
this directory is — back it up, git-track it, move it.

```
rust-weekly/
  newsletter-design.md            # editorial: tone, sections, word budget, pipeline
  feeds.json                      # RSS/Atom feed URLs
  github-releases.json            # GitHub repos to track releases
  sitemaps.json                   # documentation sitemaps to track
  feeds/                          # synced articles (auto-created)
    {domain}/
      {slug}-header.yaml          # metadata + summary + mentions
      {slug}.md                   # full article content
  discovery/
    found.txt                     # discovered URLs
    checked.json                  # feed extraction cache
  runs/                           # pipeline run artifacts, one dir per date
    YYYY-MM-DD/
      chunk-*.md                  # step 1: collected headers
      filter-*.md                 # step 2: relevance decisions
      prioritise-*.md             # step 3: priority decisions
      deep-read/                  # step 4: article chunks for evaluation
      evaluations-*.md            # step 4: evaluation decisions
      evaluations.md              # step 4: combined evaluations
      newsletter-input/           # step 5: prepared article chunks
      draft.md                    # step 7: pre-edit version
      editorial-changes.md        # step 7: change summary
  newsletters/
    YYYY-MM-DD.md                 # finished newsletters
    YYYY-MM-DD.pdf
    style.css                     # PDF stylesheet (generated on create, editable)
```

This matches the current working layout. No wrapper directories.

### newsletter-design.md

The editorial brain. Contains everything an LLM agent needs to make
editorial decisions: subject, audience, tone, sections with descriptions,
citation rules, word budget, and the complete production pipeline.

Generated during `/newsletter-toolkit:create` and tailored to the subject.
The user can edit it freely — it's their newsletter's voice. The pipeline
steps (collect, filter, prioritise, evaluate, prepare, write, edit) are
the same for every newsletter; only the section names and editorial
criteria change.

## Plugin structure

```
newsletter-toolkit/
  .claude-plugin/
    plugin.json
  commands/
    create.md                     # interactive setup wizard
    discover.md                   # find new sources
    ingest.md                     # sync feeds + summarise
    draft.md                      # full editorial pipeline
    review.md                     # load latest draft for editing
    pdf.md                        # generate PDF
  agents/
    filter.md                     # relevance filtering subagent
    prioritise.md                 # prioritisation subagent
    evaluate.md                   # deep-read evaluation subagent
    writer.md                     # newsletter section writing subagent
    assembler.md                  # final assembly subagent
    editor.md                     # editorial pass subagent
  settings.json                   # default tool permissions
  server/
    package.json                  # dependencies: rss-parser, turndown
    src/                          # TypeScript source
      cli.ts                      # CLI entry point (same as today)
      sync-rss.ts
      sync-lib.ts
      sync-github-releases.ts
      sync-github-releases-lib.ts
      sync-sitemap.ts
      sync-sitemap-lib.ts
      summarise.ts
      research.ts
      discover-feeds.ts
      recent-headers.ts
      prepare-articles.ts
      chunk-articles.ts
      chunk-headers.ts
      extract-includes.ts
      combine-lists.ts
      append-found.ts
      count-tokens.ts
      util.ts
    dist/                         # pre-built JS (shipped with plugin)
      cli.js
      ...
```

### plugin.json

```json
{
  "name": "newsletter-toolkit",
  "version": "0.1.0",
  "description": "Create and produce newsletters about any subject"
}
```

### How commands call the engine

Commands and agents call the bundled CLI via Bash, using
`${CLAUDE_PLUGIN_ROOT}` to locate the built files:

```
node ${CLAUDE_PLUGIN_ROOT}/server/dist/cli.js recent-headers
node ${CLAUDE_PLUGIN_ROOT}/server/dist/cli.js chunk-articles shortlist.txt deep-read
node ${CLAUDE_PLUGIN_ROOT}/server/dist/cli.js extract-includes relevant.txt filter-*.md
```

Same CLI, same interface, just referenced from the plugin directory
instead of a global install. The settings.json pre-approves these:

```json
{
  "permissions": {
    "allow": [
      "Bash(node ${CLAUDE_PLUGIN_ROOT}/server/dist/cli.js:*)"
    ]
  }
}
```

### Commands vs agents

Commands are user-facing (`/newsletter-toolkit:draft`). Agents are
subagents that commands launch for parallel editorial work.

A command like `/newsletter-toolkit:draft` orchestrates the full pipeline:

1. Call `cli.js recent-headers` (collect recent content into chunks)
2. Launch filter agents (one per chunk) — combine results with
   `cli.js extract-includes`
3. Re-chunk with `cli.js chunk-headers`, launch prioritise agents
   (one per chunk) — combine results with `cli.js extract-includes`
4. Chunk articles with `cli.js chunk-articles`, launch evaluate agents
   (one per chunk) — concatenate results
5. Call `cli.js prepare` (prepare article chunks for writing)
6. Launch writer agents (one per chunk or one for all)
7. If multiple chunks: launch assembler agent (combine sections, write
   briefing, signal/noise, hot take)
8. Launch editor agent (final pass)
9. Write output to `newsletters/YYYY-MM-DD.md`

The command prompt describes this orchestration. The agent prompts contain
the editorial judgment (what's relevant, what's worth including, how to
write well). The agents read `newsletter-design.md` at runtime for the
subject-specific editorial criteria.

## What moves where

### Source files → `server/`

Everything in collect-runner's `src/` moves to `server/src/`. No logic
changes. The CLI entry point (`cli.ts`) stays — it's the same interface,
just invoked from the plugin directory instead of a global binary.

Pre-built JS goes in `server/dist/`. The plugin ships with `dist/`
already populated so users don't need a build step.

### Dependencies → `server/node_modules/`

The plugin ships with `server/node_modules/` pre-installed. Four
runtime dependencies:

- `rss-parser` — RSS feed parsing
- `turndown` — HTML to markdown conversion
- `@anthropic-ai/sdk` — token counting during sync
- `tsx` — TypeScript execution (only if shipping source instead of
  pre-built dist)

If shipping pre-built `dist/`, tsx becomes a dev dependency and
`node_modules/` only contains rss-parser, turndown, and
@anthropic-ai/sdk.

### Skills → commands

- `templates/skills/setup/SKILL.md` → `commands/create.md`
- `templates/skills/discover/SKILL.md` → `commands/discover.md`

### New commands

- `commands/draft.md` — full editorial pipeline orchestration
- `commands/ingest.md` — sync + summarise
- `commands/review.md` — load latest draft for editing
- `commands/pdf.md` — generate PDF

### New agents

- `agents/filter.md` — relevance filtering subagent
- `agents/prioritise.md` — prioritisation subagent
- `agents/evaluate.md` — deep-read evaluation subagent
- `agents/writer.md` — newsletter section writing subagent
- `agents/assembler.md` — final assembly subagent
- `agents/editor.md` — editorial pass subagent

### What happens to collect-runner

The collect-runner repo becomes the newsletter-toolkit plugin repo.
The CLI remains as an entry point (used by commands via Bash), but
it's no longer distributed as a separate npm package. `collect init`
and `templates/` go away — the plugin replaces them.

Tests stay with the source in `server/src/`.

## Future improvements

### MCP server

The CLI could be wrapped as an MCP server later. This would mean
commands call MCP tools directly instead of shelling out via Bash.
Cleaner integration, no permission allowlisting needed. The source
files stay the same — only the entry point changes from CLI dispatch
to MCP tool handlers.

### PDF dependencies

PDF generation needs pandoc and weasyprint. These are system packages
that can't be bundled. The PDF command should check for them and give
clear install instructions. PDF is optional — the newsletter is
markdown-first.
