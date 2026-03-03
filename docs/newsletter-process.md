# Newsletter Generation Process

## Overview

A weekly newsletter is generated from the `feeds/` directory using the
`/claude-code-newsletter` skill. The skill lives at
`~/.claude/skills/claude-code-newsletter/SKILL.md` and is invoked with an
optional days-back argument (default 7).

Output: `./newsletter.md`

## Data Layout

```
feeds/
  {source-domain}/
    {slug}-header.yaml   # metadata
    {slug}.md            # full article content
```

Header YAML schema:
```yaml
title: "Article Title"
link: "https://original-url"
date: "2026-02-25T09:01:46.000Z"
summary: "1-10 sentence summary from summarise.ts"
mentions: ["Claude Code", "MCP", "Anthropic"]
```

Articles with `summary: "No content."` are stubs — the feed entry existed but
the content couldn't be fetched. These are excluded from newsletter consideration.

## Filtering Pipeline

The funnel for a typical week (numbers from the Feb 23 - Mar 2, 2026 run):

| Stage | Count | Method |
|-------|-------|--------|
| All dated items in window | ~1,100 | grep date patterns in header YAML |
| Minus "No content" stubs | ~830 | exclude `summary: "No content."` |
| Mentions Claude Code | ~140 | grep header + .md for `claude.code\|claude-code\|Claude Code` |
| After skip/categorise | ~60 | LLM judgment on headers |
| Deep-read list | ~30 | top items per category |
| Final newsletter items | 12-15 | editorial selection |

### Date grep patterns

Date strings in headers use ISO 8601 format: `date: "2026-02-25T..."`.
Build one grep per day in the window. For a 7-day lookback from March 2:

```bash
grep -rl 'date: "2026-02-23' feeds/ --include='*-header.yaml'
grep -rl 'date: "2026-02-24' feeds/ --include='*-header.yaml'
# ... through 2026-03-02
```

Combine, sort, deduplicate.

### Keyword matching

Also search for Claude Code mentions regardless of date (catches undated or
evergreen content). The date filter is the primary gate; keyword filter adds
items that mention Claude Code but might be roundup posts from adjacent feeds.

In practice, intersecting date + keyword is the useful set. The keyword-only
set without date filtering is too large (~700+ items) and mostly older content.

## Categorisation

Headers are read in bulk and assigned to categories:

- **Releases & Features** — what shipped, changed, or broke
- **Techniques** — patterns, workflows, case studies, CLAUDE.md tips
- **Ecosystem** — tools, plugins, MCP servers, integrations
- **Security** — vulnerabilities, billing issues, gotchas
- **Signals** — notable takes, cultural shifts, debates
- **Skip** — SEO listicles, meme posts, non-English without clear value, generic "what is X" articles, tutorial series that are just basic walkthroughs

Each item gets a priority 1-5. Known voices (Simon Willison, Pragmatic Engineer,
Lenny Rachitsky, etc.) get higher priority. New features, security issues, and
bugs with workarounds also rank high.

## Reading and Note-Taking

The skill uses `newsletter-scratch.md` as a working file to survive context
compression. Notes are appended after each article read, not batched. The
scratch file is deleted after the newsletter is written.

A "One link" candidate is tracked at the top of the scratch file and updated
as better candidates are found. This is the standout item — interesting rather
than merely important.

## Output Format

Target: 500-800 words (~2-3 minute read).

Structure:
1. **Opening line** — the week in one sentence
2. **Releases & Features** — 3-5 items max
3. **Techniques** — 2-3 items
4. **Ecosystem** — 2-3 items (skip if empty)
5. **Security** — only when real
6. **Signals** — 2-3 items
7. **One link** — single standout with one sentence and link

Per-item format:
```markdown
### Item Title
source-name

Summary in 1-3 sentences.

-> https://link-to-original
```

Tone: neutral, concise, practical. Include workarounds/commands when relevant.

## Operational Notes

### Volume

With ~125 feed sources and a 7-day window, expect ~1,000 dated items total,
of which ~100-150 mention Claude Code. This is manageable in a single
conversation but requires batching the header reads.

### Categorisation at scale

Reading 140 headers in one pass exceeds comfortable context. Splitting into
batches of ~50 headers (by line range from the concatenated output) and
processing in parallel works well. Three parallel categorisation passes
cover the full set.

### Context pressure

The main risk is running out of context before finishing the deep reads.
The scratch file mitigates this — if the conversation is compressed, the
reading plan and notes survive on disk. Prioritise reading the highest-value
items first so the best material is captured early.

### Common skips

These patterns reliably produce low-value items and can be filtered early:
- `blog-getbind-co` — "X Best Alternatives" listicles
- `www-gauraw-com` — generic explainers
- `www-xugj520-cn` — Chinese translations of English content
- `aitoolanalysis-com` — SEO review posts
- Tutorial series with numbered parts (e.g., "Part 10", "Part 11") — usually basic walkthroughs
- Duplicate Reddit posts (outage status updates, cross-posts)

### Rate limits

If using subagents for parallel reads, they may hit API rate limits. Fall back
to reading files directly in the main conversation. Reading 8-10 articles
directly is faster than spawning agents when limits are tight.
