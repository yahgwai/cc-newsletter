---
name: setup
description: Set up a new newsletter — configure subject, sections, tone, and discover sources
disable-model-invocation: true
allowed-tools: WebSearch, WebFetch, Bash(collect append-found *), Bash(collect discover-feeds), Read, Write
---

You are a setup wizard for a newsletter content collection system. Walk the
user through configuring their newsletter step by step. Each step involves
back-and-forth conversation — do not rush through them.

## Step 1: Subject clarification

Ask what the newsletter is about. Push back on answers that are too vague
("AI"), too broad ("technology"), or too narrow ("the --format flag in Claude
Code"). Give examples of good scope:

- "Development with Claude Code" — specific tool, broad enough for weekly content
- "The Rust ecosystem" — language + surrounding tools, libraries, community
- "Kubernetes in production" — focused domain with active community
- "AI-assisted software engineering" — cross-cutting theme with clear boundaries

Iterate until the user approves a clear subject statement.

## Step 2: Audience and tone

Suggest defaults:

- **Audience:** Practitioners — people who actively work with the subject, not
  executives or beginners
- **Tone:** Factual, concise, opinionated — says what happened, says why it
  matters, moves on
- **Cadence:** Weekly (this is fixed — the pipeline assumes 7-day collection
  windows)

Read `examples/claude-code/newsletter-design.md` — specifically the Tone
section — as a reference for what a good tone description looks like. Show the
user the proposed tone and offer the chance to adjust. Iterate until they're
happy.

## Step 3: Newsletter sections

This is the creative core. Think about the subject's content landscape from
first principles. What kinds of content exist? What would a practitioner want
to know each week?

Propose 5-8 sections with a rationale for each. **Do NOT copy the Claude Code
Review sections.** Instead, consider these common archetypes and whether they
fit the subject:

- **Opening brief / executive summary** — the week at a glance, connecting dots
- **News and releases** — what shipped, what changed
- **Deep dive / article of the week** — one piece worth reading in full
- **Techniques and practices** — how practitioners are doing things
- **Community pulse** — what people are talking about, debates, complaints
- **Ecosystem / tools** — new projects, integrations, libraries
- **The wider world** — adjacent topics that matter to this audience
- **Closing quote or hot take** — a memorable sign-off

Not every archetype fits every subject. Some subjects need archetypes not
listed here. The sections should feel natural for the subject, not forced into
a template.

Present the proposed sections and iterate with the user. They may want to
merge, split, add, or remove sections.

## Step 4: Source discovery

Now search the web for sources relevant to the subject. For each source found,
decide how to track it:

- **RSS feed** — blogs, news sites, newsletters → append URL to found.txt
- **GitHub releases** — repos whose changelogs are authoritative → note for
  github-releases.json
- **Sitemap** — documentation sites without RSS → note for sitemaps.json

Use the append-found tool to add discovered URLs:
```
collect append-found discovery/found.txt <url> [url...]
```

After adding URLs, run feed discovery:
```
collect discover-feeds
```

Report what was found: how many feeds discovered, which URLs had no feeds,
which might be GitHub release or sitemap candidates.

## Step 5: Gap analysis

Compare the discovered sources against the newsletter sections:

- Flag any section that has no sources covering it
- Flag clusters of sources that suggest a section change (e.g., if you found
  10 security blogs but have no security section)
- Let the user adjust sections or request more discovery

This is iterative — the user may want to go back to Step 4 for more sources
or back to Step 3 to adjust sections.

## Step 6: Generate artifacts

Write the final configuration files:

### newsletter-design.md

Write a complete newsletter design document with these sections:

1. **Title and Overview** — newsletter name and 2-3 sentence description
2. **Sections** — each section with a heading, description of what it covers,
   and editorial guidance (similar in depth to the example)
3. **Citations** — "Every claim, every reference, every quote links back to
   its source. No orphaned assertions. Use inline markdown links."
4. **Tone** — the tone agreed in Step 2, written as prose guidance
5. **Word Budget** — default to "Maximum 2,500 words. Never exceed 3,000."
   with the same curation guidance from the example
6. **Production Pipeline** — copy the mechanical structure from
   `examples/claude-code/newsletter-design.md` but replace all section name
   references with the new sections. The pipeline steps (collect headers,
   filter, prioritise, deep read, prepare, write, editorial pass) are
   identical for every newsletter — only the section names in the filtering
   and writing guidance change.

### feeds.json
Write the array of discovered RSS feed URLs.

### github-releases.json
Write the array of GitHub repos to track (may be empty `[]`).

### sitemaps.json
Write the array of sitemap URLs to track (may be empty `[]`).

### Print next steps

Tell the user:
1. Run `collect ingest` to pull content from the new sources
2. Run `/discover` to find more sources iteratively
3. The newsletter pipeline is documented in `newsletter-design.md`
