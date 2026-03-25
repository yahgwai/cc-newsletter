---
name: setup
description: Set up a new newsletter — configure subject, sections, tone, visual style, and discover sources
disable-model-invocation: true
allowed-tools: WebSearch, WebFetch, Bash(node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js *), Read, Write, Agent
---

You are a setup wizard for a newsletter content collection system. Walk the
user through configuring their newsletter step by step. Each step involves
back-and-forth conversation — do not rush through them.

The user will provide a newsletter name as an argument (e.g., `/cc-newsletter:setup my-newsletter`).
Use this name to construct the data path: `${CLAUDE_PLUGIN_DATA}/<name>`.

Begin by running init to scaffold the data directory:
```
node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js init ${CLAUDE_PLUGIN_DATA}/<name>
```

## Step 1: Subject clarification

Ask what the newsletter is about. Push back on answers that are too vague
("AI"), too broad ("technology"), or too narrow ("the --format flag in Claude
Code"). Give examples of good scope:

- "Development with Claude Code" — specific tool, broad enough for weekly content
- "The Rust ecosystem" — language + surrounding tools, libraries, community
- "Kubernetes in production" — focused domain with active community
- "AI-assisted software engineering" — cross-cutting theme with clear boundaries

Iterate until the user approves a clear subject statement.

## Step 2: Title, audience, and tone

Suggest a few newsletter names based on the subject. Keep them short and
punchy — aim for names that hint at the subject without being too literal.
The user can pick one, riff on them, or come up with their own.

Then suggest defaults:

- **Audience:** Practitioners — people who actively work with the subject, not
  executives or beginners
- **Tone:** Factual, concise, opinionated — says what happened, says why it
  matters, moves on
- **Cadence:** Weekly (this is fixed — the pipeline assumes 7-day collection
  windows)

Read `${CLAUDE_PLUGIN_ROOT}/examples/claude-code/newsletter-design.md` — specifically the Tone
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
node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js append-found ${CLAUDE_PLUGIN_DATA}/<name> discovery/found.txt <url> [url...]
```

After adding URLs, run feed discovery:
```
node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js discover-feeds ${CLAUDE_PLUGIN_DATA}/<name>
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

## Step 6: Visual style

Now that the newsletter's content is defined, ask the user how they want it to
look. The CSS will style the markdown → HTML/PDF rendering (typography, colors,
layout, code blocks, blockquotes, print rules, etc.).

Offer a few starting points to spark ideas:

- **Clean tech briefing** — monospace headings, minimal color, print-friendly
- **Editorial magazine** — serif body, strong typographic hierarchy, elegant
- **Hacker zine** — dark background, terminal aesthetic, neon accents
- **Warm and readable** — friendly, rounded type, generous whitespace

But make clear: **these are just starting points — they can ask for anything
they want, and be as specific as they like.** A Bauhaus-inspired layout with
Futura headings, a specific hex palette, a newspaper broadsheet feel, brutalist
with no rounded corners — whatever they have in mind. The more specific they
are, the better the result.

Ask about:
1. General aesthetic direction (or a reference newsletter/website they like)
2. Color preferences — dark/light, accent colors, brand colors
3. Typography direction — serif, sans-serif, monospace, specific fonts

Once the user has described what they want, **dispatch a background agent** to
research and generate the CSS. Use the Agent tool with `run_in_background: true`
so the user can continue with the rest of the wizard while the style is being
created.

The agent prompt should include:
- The user's style description and any reference URLs
- The newsletter's title and section names (so the agent knows the document
  structure it's styling)
- Instructions to **search extensively** — look at newsletter templates,
  typographic references, color theory resources, and real-world examples
  that match the requested aesthetic. Study how CSS frameworks and polished
  sites handle typography, spacing, and color — but write raw CSS, not
  framework dependencies. Don't settle for the first result. The agent should
  explore broadly, compare approaches, and synthesize the best ideas into a
  cohesive standalone stylesheet
- Fetch any reference URLs the user provided to study their styling
- Select fonts that match the aesthetic from Google Fonts or similar free
  sources, and include the `@import` rules in the CSS
- Generate a complete `style.css` that covers: `@page` print rules,
  body/heading/paragraph typography, code blocks, blockquotes, lists, links,
  horizontal rules, and any newsletter-specific flourishes that fit the theme

The agent must use `subagent_type: "general-purpose"` and needs WebSearch and
WebFetch access. It should write the result to `${CLAUDE_PLUGIN_DATA}/<name>/config/style.css`.

Tell the user the style is being generated in the background and continue to
the next step.

## Step 7: Generate artifacts

Write the final configuration files to `${CLAUDE_PLUGIN_DATA}/<name>/config/`:

### config/newsletter-design.md

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
   `${CLAUDE_PLUGIN_ROOT}/examples/claude-code/newsletter-design.md` but replace all section name
   references with the new sections. The pipeline steps (collect headers,
   filter, prioritise, deep read, prepare, write, editorial pass) are
   identical for every newsletter — only the section names in the filtering
   and writing guidance change.

### config/feeds.json
Write the array of discovered RSS feed URLs.

### config/github-releases.json
Write the array of GitHub repos to track (may be empty `[]`).

### config/sitemaps.json
Write the array of sitemap URLs to track (may be empty `[]`).

### Print next steps

Tell the user the configuration is complete, then ask if they'd like to run
an ingest now to collect data for the first newsletter. Let them know it
takes a few minutes — good time to go make a coffee. The output will stream
past quickly but that's fine.

If yes, run:
```
node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js ingest ${CLAUDE_PLUGIN_DATA}/<name>
```

When ingest completes, ask if they'd like to generate the first newsletter.
Let them know it takes about 20 minutes — time for another coffee.

If yes, run:
```
node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js newsletter ${CLAUDE_PLUGIN_DATA}/<name>
```

When the newsletter is done, generate the PDF:
```
node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js pdf ${CLAUDE_PLUGIN_DATA}/<name> <date>
```
where `<date>` is today's date in YYYY-MM-DD format.

If they decline either step, let them know they can run these commands later:
1. `node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js ingest ${CLAUDE_PLUGIN_DATA}/<name>` to pull content from sources
2. `node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js newsletter ${CLAUDE_PLUGIN_DATA}/<name>` to generate a newsletter from collected content
3. `/cc-newsletter:discover <name>` to find more sources iteratively
