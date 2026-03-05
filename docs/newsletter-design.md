# The Claude Code Review

## Overview

An intelligence briefing on Claude Code development, synthesized from a wide
range of blogs and release notes of varying quality. Written for an experienced
developer's personal consumption. Output is markdown.

## Sections

Sections appear in this order. Every claim, reference, and quote must link
back to its source.

### 1. The Briefing

No section heading — the newsletter opens straight into 3-4 paragraphs of
narrative prose. The week at a glance — biggest stories across all three
categories. Connects dots: why does this release matter in context of that
technique people discovered? Assumes the reader already knows the basics.
Ends with:

- **Signal:** One thing that deserves more attention than it got.
- **Noise:** One thing that got more attention than it deserved.

These may or may not repeat something mentioned earlier in the briefing.

### 2. New Features

What shipped. CLI updates, model changes, new capabilities, config options.
Factual, concise. Each item states what changed and what it means practically.
Bullet points or short paragraphs.

#### Source of truth rule

The GitHub releases feed (`data/feeds/anthropics--claude-code/`) is the
authoritative source for what shipped. A feature belongs in New Features
only if it appears in a release published within the newsletter's date
range (or the preceding 14 days, to catch features that span issue
boundaries).

When a feature is new, include a brief explanation of how it works.
Blog posts or community sources that explain the feature well can be
cited here — this is the one time where "here's what it does" coverage
adds value.

After that initial window, a source mentioning the feature only belongs
in the newsletter if it adds something beyond description: a novel use
case, a non-obvious interaction, a limitation discovered in practice, a
workflow that changes how you'd use it. "Here's how feature X works"
written three weeks after release is not newsletter material. "I tried
feature X for Y and discovered Z" might be.

If a source describes a Claude Code capability but no matching release
exists in the feed, it belongs in Techniques & Workflows (if it's about
usage) or another appropriate section — not New Features. We don't
report features as new unless we can confirm they shipped.

### 3. Security & Bugs

What broke, what got patched, what to watch out for. Vulnerabilities, known
issues, workarounds. Usually bullet points, but can go deeper in prose when
there's an interesting exploit, bug, or security technique worth explaining
properly.

### 4. Article of the Week

One article, properly summarised in 2-3 paragraphs. Why it was written, what
it says, and why it's worth reading. This is the "if you read one thing" pick.
Always links to the original.

### 5. Techniques & Workflows

2-3 items describing techniques and workflows people are using. CLAUDE.md
patterns, task decomposition strategies, plan mode usage, prompting approaches,
hook configurations. Short paragraphs per item.

### 6. What Are They Talking About & What Are They Building?

Starts with ecosystem: new MCP servers, interesting integrations, SDK projects,
tools built on top of Claude. Ends with community chatter: recurring
complaints, debates, interesting conversations from GitHub issues, forums,
blogs. What's the vibe?

### 7. The Wider World

Things that aren't Claude Code but matter to someone who lives in it. One prose
piece going deeper on a single adjacent topic, followed by a few bullet points
on other adjacent things worth knowing about.

### 8. Hot Take

Closes the newsletter. A direct quote from something published that week.
Cited and linked. No explanation — just the quote and its source.

## The Snippet

We aim to include one code snippet, prompt pattern, config example, or tool
invocation somewhere in the newsletter each week. It lives in whichever section
it fits naturally — not a standalone section. Not forced if nothing warrants it
that week.

## Citations

Every claim, every reference, every quote links back to its source. No orphaned
assertions. Use inline markdown links.

## Tone

Straight-talking and matter-of-fact. Says what happened, says why it matters,
moves on. Doesn't dress things up or reach for dramatic framing. If something
is important, the facts make that clear without editorial theatrics.

Has opinions but holds them lightly. Will call something out as noise or flag
when a claim doesn't hold up, but doesn't grandstand about it. More "this
doesn't hold up because X" than a clever put-down.

Respects the reader's time. Assumes you're busy and smart. Doesn't
over-explain, doesn't sell you on why you should care. If it's in the
newsletter, it's there because it matters — that's implicit.

Warm but not chatty. Not a robot delivering a briefing, but not trying to be
your friend either. A colleague who's good at their job and doesn't waste
words. Occasionally dry, never forced.

Not corporate announcement style. Not breathless tech blog excitement. Not
"we're thrilled to announce." Not hedging every opinion with "it depends."

## Word Budget

Maximum 2,500 words. Never exceed 3,000.

These are ceilings, not targets. If it's a quiet week and 1,500 words covers
everything worth saying, stop at 1,500. Don't pad to fill.

When the material exceeds the budget, curate harder — don't write shorter.
Don't compress ten items into terse one-liners — pick the five that matter
most and give them the space they deserve. Every item that makes the cut
should have enough room to say something substantive. Items that don't clear
the bar get cut entirely, not squeezed.

When deciding what to cut, drop the least impactful items from within each
section rather than dropping entire sections. Every section should still appear,
but some weeks a section might have one item instead of three. That's fine —
a section with one strong item is better than three weak ones.

## Production Pipeline

All paths below use `$RUN` to mean `data/runs/YYYY-MM-DD/` — the
date-stamped run directory created by Step 1. Each run is isolated so
re-running the pipeline doesn't clobber previous weeks.

Steps marked **(script)** are deterministic and run as CLI commands.
Steps marked **(LLM)** require editorial judgment. All subagents should be
launched with `model: "opus"`.

### Step 1: Collect recent headers (script)

```
npm run recent-headers                   # defaults to 7 days, today's date
npx tsx src/recent-headers.ts 14         # override days
npx tsx src/recent-headers.ts --date 2026-02-24   # override date for reruns
```

Outputs chunks to `$RUN/chunk-*.md`. Prints the run directory path as the
first line of stdout so downstream steps can capture it.

### Step 2: Filter for relevance (LLM)

Launch one subagent per chunk file. Each subagent should:

1. Read its assigned chunk from `$RUN/chunk-N.md`
2. Read the newsletter design in `./docs/newsletter-design.md`
3. Review every header in the chunk and decide whether it could be relevant to
   any section of the newsletter — not just Claude Code content, but also
   anything that might fit in The Wider World, Security & Bugs, Techniques, or
   community discussion
4. Write a decision for every header using this format, separated by `---`:

   ```
   ## Header: path/to/header.yaml
   **Decision:** INCLUDE
   **Reason:** Covers a new Claude Code CLI feature relevant to New Features section
   ---
   ## Header: path/to/other.yaml
   **Decision:** EXCLUDE
   **Reason:** Generic AI industry news, not specific enough for any section
   ---
   ```

   Write the output to `$RUN/filter-N.md` (matching its chunk number).

This is a filtering pass — cast a wide net. When in doubt, include it.

Extract the INCLUDE paths:

```
npx tsx src/extract-includes.ts $RUN/relevant.txt $RUN/filter-*.md
```

### Step 3: Prioritise for deep reading (LLM)

```
npx tsx src/chunk-headers.ts $RUN/relevant.txt $RUN/prioritise
```

Launch one subagent per chunk. Each subagent should:

1. Read its assigned chunk from `$RUN/prioritise/chunk-N.md`
2. Read the newsletter design in `./docs/newsletter-design.md`
3. Select the headers that are most worth reading in full — based on how
   interesting the topic is and how credible or high-quality the source appears
4. Write a decision for every header using this format, separated by `---`:

   ```
   ## Header: path/to/header.yaml
   **Decision:** INCLUDE
   **Reason:** High-quality source with concrete workflow details worth deep reading
   ---
   ## Header: path/to/other.yaml
   **Decision:** EXCLUDE
   **Reason:** Superficial listicle, unlikely to add substance on deeper read
   ---
   ```

   Write the output to `$RUN/prioritise-N.md` (matching its chunk number).

Err on the side of including something if it looks promising.

Extract the INCLUDE paths:

```
npx tsx src/extract-includes.ts $RUN/shortlist.txt $RUN/prioritise-*.md
```

### Step 4: Deep read and evaluate (LLM)

```
npx tsx src/chunk-articles.ts $RUN/shortlist.txt $RUN/deep-read
```

Launch one subagent per chunk. Each subagent should:

1. Read its assigned chunk from `$RUN/deep-read/chunk-N.md`
2. Read the newsletter design in `./docs/newsletter-design.md`
3. Read every article in full and for each one write an evaluation using this
   format, separated by `---`:

   ```
   ## Header: path/to/header.yaml
   **Decision:** INCLUDE or EXCLUDE
   **Section:** Section Name
   **Summary:** 2-3 sentences on the substance — what you actually learned
   from reading it, not just the header summary
   ---
   ```

   For articles that should NOT be included, still list them with a one-line
   summary explaining the exclusion so the decision is auditable.

Each subagent writes its evaluations to `$RUN/evaluations-N.md` (matching its
chunk number). The main agent concatenates them into `$RUN/evaluations.md`.

### Step 5: Prepare article content (script)

```
npm run prepare -- $RUN/evaluations.md $RUN/newsletter-input
```

This writes `$RUN/newsletter-input/includes.txt` (one header path per line),
calculates the total word count of all INCLUDE articles, and:

- **Under 50k words:** automatically runs `chunk-articles.ts` to write chunks
  to `$RUN/newsletter-input/single/`. Proceed to Step 6.
- **Over 50k words:** prints a message that affinity grouping is needed.
  This is an LLM step:
  1. Read `$RUN/evaluations.md` and look at the section assignments for each
     INCLUDE article
  2. Group articles that share the same or overlapping sections — e.g. all the
     New Features articles together, Security & Bugs together, etc. Articles
     assigned to multiple sections go with whichever group they fit best
  3. Write one file per group to `$RUN/newsletter-input/` (e.g.
     `group-features.txt`, `group-security.txt`), each containing header paths
     one per line
  4. Run `npx tsx src/chunk-articles.ts <group-file> $RUN/newsletter-input/group-N/`
     for each group file

### Step 6: Write the newsletter (LLM)

Launch one subagent per chunk in `$RUN/newsletter-input/single/` (or the
group directories if affinity grouping was used).

**If there is only one chunk** (everything fits), the subagent should:

1. Read the newsletter design in `./docs/newsletter-design.md`
2. Read `$RUN/evaluations.md` for section assignments and editorial notes
3. Read the full article chunk
4. Write the complete newsletter following the design doc — all sections, in
   order, with citations, in the correct tone

**If there are multiple chunks**, each subagent should:

1. Read the newsletter design in `./docs/newsletter-design.md`
2. Read `$RUN/evaluations.md` in full (so it has the big picture of the whole
   week, not just its own articles)
3. Read its assigned chunk of articles
4. Write only the newsletter sections that its articles map to, following the
   design doc format, tone, and citation requirements

The main agent then:

1. Collects all section drafts from the subagents
2. Launches a final subagent that reads the newsletter design, the full
   evaluations, and all section drafts
3. This final subagent assembles the complete newsletter: writes The Briefing
   (which synthesizes across all sections), adds Signal/Noise, selects the
   Hot Take quote, places the Snippet if one was found, and ensures the whole
   thing reads as one coherent voice
4. Writes the result to `./data/newsletters/YYYY-MM-DD.md`

### Step 7: Editorial pass (LLM)

Launch a subagent that:

1. Reads the newsletter design in `./docs/newsletter-design.md`
2. Copies the draft from `./data/newsletters/YYYY-MM-DD.md` to
   `$RUN/draft.md` (preserves the pre-edit version)
3. Reads the draft and re-reads with fresh eyes — fix factual errors, tighten
   prose, cut anything that doesn't earn its place, make sure the tone is
   consistent throughout
4. Writes a summary of editorial changes to `$RUN/editorial-changes.md`
5. Writes the final version back to `./data/newsletters/YYYY-MM-DD.md`
