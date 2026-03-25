# Apple Services

## Title Format

```
# Apple Services

*Week of March 6, 2026*
```

## Overview

A weekly intelligence briefing on Apple's services business — TV+, sports,
content deals, services revenue, and product strategy — synthesized from
news sites, trade publications, and analyst commentary. Written for an
engineering program manager inside Apple Services who wants to stay informed
without reading dozens of sources. Output is markdown.

## Sections

Sections appear in this order. Every claim, reference, and quote must link
back to its source.

### 1. The Briefing

No section heading — the newsletter opens straight into 3-4 paragraphs of
narrative prose. The week at a glance — biggest stories across services
revenue, TV+, sports, and product strategy. Connects dots: why does this
deal matter in context of that earnings signal? Assumes the reader knows
the org, the players, and the competitive landscape.

Ends with:

- **Signal:** One thing that deserves more attention than it got.
- **Noise:** One thing that got more attention than it deserved.

These may or may not repeat something mentioned earlier in the briefing.

### 2. Services & Financials

How Apple's services business is performing. Quarterly earnings get deep
treatment — revenue numbers, growth rates, commentary from the call.
Between quarters: analyst takes, market positioning relative to competitors,
pricing changes to subscriptions or bundles, anything that moves the
services revenue narrative.

Include specific numbers when available. "Services grew 12% YoY to $25B"
is useful. "Services continued to grow" is not.

### 3. TV+ & Originals

Content strategy in action. Show renewals, cancellations, new series
orders, film acquisitions, talent signings, production deals. Awards
season coverage when relevant. Viewership signals — Apple rarely gives
numbers, so note when third-party estimates or indirect signals emerge.

Frame content moves in competitive context when it matters: what Netflix,
Disney+, Amazon, or Max are doing that makes an Apple move more or less
significant.

### 4. Sports

MLS Season Pass, any new sports rights deals or negotiations, partnerships
with leagues or broadcasters. Features built for sports viewing (multiview,
stats overlays, spatial video for sports). The intersection of live sports
and streaming technology.

Also covers sports rights deals going to competitors when they affect
Apple's positioning — e.g., if Amazon or ESPN secures something Apple was
reportedly pursuing.

### 5. Product & Strategy

Major Apple announcements and launches. New hardware that affects the
services ecosystem (Apple TV hardware, Vision Pro and spatial video,
iPhone features that drive services adoption). Pricing changes, bundling
strategy (Apple One), international expansion.

Press releases and official announcements land here — even straightforward
news deserves a line or two so you're never caught off guard. Depth is
proportional to significance.

### 6. Developer & Platform

Light coverage. Major SDK changes, App Store policy shifts, API updates,
regulatory-driven changes to the platform (EU DMA compliance, alternative
payment systems). Only what a services EPM should be aware of — not
deep developer tooling coverage.

### 7. The Wider World

What competitors and adjacent players are doing that matters for context.
Netflix earnings or strategy shifts, Disney+ restructuring, sports
streaming rights going elsewhere, regulatory moves (EU, DOJ antitrust).
One or two items that help frame Apple's position.

## Citations

Every claim, every reference, every quote links back to its source. No
orphaned assertions. Use inline markdown links.

## Tone

Straight-talking and informed. Reports what happened, explains why it
matters to someone inside the services org, moves on. Doesn't rehash basic
context — assumes the reader knows who Eddy Cue is, what MLS Season Pass
does, and how Apple's services revenue is structured.

Major Apple announcements get covered even when they're straightforward — a
new product launch or press release deserves a line or two so you're never
caught off guard. But the depth is proportional to significance: a show
renewal is a bullet point, a landmark sports rights deal gets real space.

Has a point of view but stays grounded. Will note when an analyst take
doesn't hold up or when a deal signals something bigger, but doesn't
editorialize for the sake of it. More "this matters because X" than hot
takes.

Respects the reader's time. Assumes you're busy and smart. Doesn't
over-explain, doesn't sell you on why you should care. If it's in the
newsletter, it's there because it matters — that's implicit.

Professional but not corporate. Not a press release summary, not a fan blog.
A sharp colleague who reads everything so you don't have to. Occasionally
dry, never forced.

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

All paths below use `$RUN` to mean `runs/YYYY-MM-DD/` — the
date-stamped run directory created by Step 1. Each run is isolated so
re-running the pipeline doesn't clobber previous weeks.

Steps marked **(script)** are deterministic and run as CLI commands.
Steps marked **(LLM)** require editorial judgment. All subagents should be
launched with `model: "opus"` and granted the `Read` and `Write` tools.

### Step 1: Collect recent headers (script)

```
cc-newsletter recent-headers                   # defaults to 7 days, today's date
cc-newsletter recent-headers 14                # override days
cc-newsletter recent-headers --date 2026-02-24 # override date for reruns
```

Outputs chunks to `$RUN/chunk-*.md`. Prints the run directory path as the
first line of stdout so downstream steps can capture it.

### Step 2: Filter for relevance (LLM)

Launch one subagent per chunk file. Each subagent should:

1. Read its assigned chunk from `$RUN/chunk-N.md`
2. Read the newsletter design in `./newsletter-design.md`
3. Review every header in the chunk and decide whether it could be relevant to
   any section of the newsletter — not just Apple services content, but also
   anything that might fit in The Wider World, Sports, Developer & Platform,
   or Product & Strategy
4. Write a decision for every header using this format, separated by `---`:

   ```
   ## Header: path/to/header.yaml
   **Decision:** INCLUDE
   **Reason:** Covers Apple TV+ content deal relevant to TV+ & Originals section
   ---
   ## Header: path/to/other.yaml
   **Decision:** EXCLUDE
   **Reason:** Generic consumer tech review, not relevant to services business
   ---
   ```

   Write the output to `$RUN/filter-N.md` (matching its chunk number).

This is a filtering pass — cast a wide net. When in doubt, include it.

Extract the INCLUDE paths:

```
cc-newsletter extract-includes $RUN/relevant.txt $RUN/filter-*.md
```

### Step 3: Prioritise for deep reading (LLM)

```
cc-newsletter chunk-headers $RUN/relevant.txt $RUN/prioritise
```

Launch one subagent per chunk. Each subagent should:

1. Read its assigned chunk from `$RUN/prioritise/chunk-N.md`
2. Read the newsletter design in `./newsletter-design.md`
3. Select the headers that are most worth reading in full — based on how
   interesting the topic is and how credible or high-quality the source appears
4. Write a decision for every header using this format, separated by `---`:

   ```
   ## Header: path/to/header.yaml
   **Decision:** INCLUDE
   **Reason:** Bloomberg analysis with concrete revenue figures worth deep reading
   ---
   ## Header: path/to/other.yaml
   **Decision:** EXCLUDE
   **Reason:** Rehash of press release with no added analysis
   ---
   ```

   Write the output to `$RUN/prioritise-N.md` (matching its chunk number).

Err on the side of including something if it looks promising.

Extract the INCLUDE paths:

```
cc-newsletter extract-includes $RUN/shortlist.txt $RUN/prioritise-*.md
```

### Step 4: Deep read and evaluate (LLM)

```
cc-newsletter chunk-articles $RUN/shortlist.txt $RUN/deep-read
```

Launch one subagent per chunk. The chunk files contain the full article
content — do not fetch source URLs. Each subagent should:

1. Read its assigned chunk from `$RUN/deep-read/chunk-N.md`
2. Read the newsletter design in `./newsletter-design.md`
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
cc-newsletter prepare $RUN/evaluations.md $RUN/newsletter-input
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
     Services & Financials articles together, TV+ & Originals together, etc.
     Articles assigned to multiple sections go with whichever group they fit best
  3. Write one file per group to `$RUN/newsletter-input/` (e.g.
     `group-services.txt`, `group-tv.txt`), each containing header paths
     one per line
  4. Run `cc-newsletter chunk-articles <group-file> $RUN/newsletter-input/group-N/`
     for each group file

### Step 6: Write the newsletter (LLM)

Launch one subagent per chunk in `$RUN/newsletter-input/single/` (or the
group directories if affinity grouping was used). The chunk files contain
the full article content — do not fetch source URLs.

**If there is only one chunk** (everything fits), the subagent should:

1. Read the newsletter design in `./newsletter-design.md`
2. Read `$RUN/evaluations.md` for section assignments and editorial notes
3. Read the full article chunk
4. Write the complete newsletter following the design doc — all sections, in
   order, with citations, in the correct tone

**If there are multiple chunks**, each subagent should:

1. Read the newsletter design in `./newsletter-design.md`
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
   (which synthesizes across all sections), adds Signal/Noise, and ensures the
   whole thing reads as one coherent voice
4. Writes the result to `./newsletters/YYYY-MM-DD.md`

### Step 7: Editorial pass (LLM)

Launch a subagent that:

1. Reads the newsletter design in `./newsletter-design.md`
2. Copies the draft from `./newsletters/YYYY-MM-DD.md` to
   `$RUN/draft.md` (preserves the pre-edit version)
3. Reads the draft and re-reads with fresh eyes — fix factual errors, tighten
   prose, cut anything that doesn't earn its place, make sure the tone is
   consistent throughout
4. Writes a summary of editorial changes to `$RUN/editorial-changes.md`
5. Writes the final version back to `./newsletters/YYYY-MM-DD.md`
