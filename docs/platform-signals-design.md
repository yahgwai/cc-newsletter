# Platform Signals

## Title Format

```
# Platform Signals

*Week of March 6, 2026*
```

## Overview

A weekly signal feed for the EPM shipping the Apple TV app on third-party
hardware — Roku, Samsung, LG, Amazon Fire TV, Google TV/Android TV,
PlayStation, and Xbox. Surfaces public signals that something changed on
a platform you ship on, so you know where to point the telescope.

This is not deep competitive intelligence — it's a trigger feed. The reader
does the investigation internally. The newsletter tells them what changed
and why it might matter.

Written for someone who knows the Apple TV app codebase, the partner
platform landscape, and the streaming competitive field. No hand-holding.

## Sections

Sections appear in this order. Every item links to its source.

### 1. Platform Changes

SDK releases, OS updates, API changes, deprecations, new capabilities,
and certification requirement changes from partner platforms: Roku, Samsung
Tizen, LG webOS, Amazon Fire TV, Google TV/Android TV, PlayStation, Xbox.

Include version numbers and dates when available. A Roku OS update that
changes the media pipeline matters more than a cosmetic UI refresh — weight
accordingly.

### 2. Competitor App Moves

Public signals about what Netflix, Disney+, Max, Paramount+, Amazon Prime
Video, and other streaming apps are doing on shared platforms. New features,
UI redesigns, platform-first launches, performance improvements, ad-tier
rollouts.

The reader can't observe every competitor app on every platform every week.
This section tells them where to look. "Netflix rolled out a new UI on
Samsung Tizen" is actionable — it means go grab the Samsung remote.

### 3. Streaming Tech & Standards

Codec adoption (AV1, HEVC, VVC), HDR format developments (Dolby Vision,
HDR10+, HDR10+ Adaptive), spatial audio standards, HDMI spec changes,
streaming protocol updates (CMAF, LL-HLS, DASH), DRM changes, and
accessibility standards.

Only include items that affect the app on partner hardware. A new video
codec matters. A new camera codec does not.

### 4. CTV Industry

Connected TV market shifts, device market share changes, platform business
model moves (Roku's ad strategy, Amazon's Fire TV monetization), new
hardware launches from platform partners, and distribution deal changes
that affect how streaming apps reach users.

This is the business context layer — helps the reader understand why
a platform partner might be changing their SDK or certification
requirements.

### 5. Regulatory & Accessibility

Platform-level regulatory changes that affect app distribution or
functionality: accessibility mandates (FCC, CVAA), age verification
requirements, privacy regulations affecting CTV, and platform-specific
compliance changes.

Light coverage — only items that could affect the app on partner hardware.

## Citations

Every item links to its source. Inline markdown links. No orphaned
assertions.

## Tone

Direct and operational, but not a raw checklist. Each item gets a bold
lead-in that says what changed, followed by one or two sentences of context
— why it matters and what to do about it. The reader should be able to scan
the bold text across the whole newsletter in 30 seconds and know which
items to read in full.

No preamble, no filler, no throat-clearing. But give each item enough room
to be useful. "Roku OS 15.2 shipped" is too terse — the reader needs to
know what changed and whether it affects them. "Roku OS 15.2 shipped with
a new media pipeline that deprecates the old Scene Graph rendering path —
if you're still on it, start planning the migration" is actionable.

Assumes the reader knows every platform they ship on, every competitor app
they benchmark against, and every codec/standard they support. Don't
explain what Roku is. Don't explain what AV1 is. Just say what changed
and what it means for the app.

## Word Budget

Maximum 1,500 words. Never exceed 2,000. Target 10-12 items across all
sections in a typical week.

Each item gets a bold lead-in and one or two sentences of context — enough
to be actionable, not enough to become an article. At 10-12 items this
reads comfortably within the budget. If the week is quiet and 6 items
covers everything worth saying, stop at 6.

When the material exceeds the budget, curate harder — don't compress.
Cut the least actionable items entirely rather than squeezing everything
into terse one-liners. Every item that makes the cut should tell the
reader what changed and what to do about it. Items that don't clear
the bar get cut, not shrunk.

Prioritise signals that require the reader to take action (test a
competitor app, review an SDK changelog, flag a certification change)
over signals that are merely informational.

## Production Pipeline

All paths below use `$RUN` to mean `runs/YYYY-MM-DD/` — the
date-stamped run directory created by Step 1. Each run is isolated so
re-running the pipeline doesn't clobber previous weeks.

Steps marked **(script)** are deterministic and run as CLI commands.
Steps marked **(LLM)** require editorial judgment. All subagents should be
launched with `model: "opus"` and granted the `Read` and `Write` tools.

### Step 1: Collect recent headers (script)

```
collect recent-headers                   # defaults to 7 days, today's date
collect recent-headers 14                # override days
collect recent-headers --date 2026-02-24 # override date for reruns
```

Outputs chunks to `$RUN/chunk-*.md`. Prints the run directory path as the
first line of stdout so downstream steps can capture it.

### Step 2: Filter for relevance (LLM)

Launch one subagent per chunk file. Each subagent should:

1. Read its assigned chunk from `$RUN/chunk-N.md`
2. Read the newsletter design in `./newsletter-design.md`
3. Review every header in the chunk and decide whether it could be relevant
   to any section of the newsletter — platform changes, competitor app
   moves, streaming tech, CTV industry, or regulatory/accessibility
4. Write a decision for every header using this format, separated by `---`:

   ```
   ## Header: path/to/header.yaml
   **Decision:** INCLUDE
   **Reason:** Roku SDK update relevant to Platform Changes section
   ---
   ## Header: path/to/other.yaml
   **Decision:** EXCLUDE
   **Reason:** Apple Music feature, not relevant to third-party platform app
   ---
   ```

   Write the output to `$RUN/filter-N.md` (matching its chunk number).

This is a filtering pass — cast a wide net. When in doubt, include it.

Extract the INCLUDE paths:

```
collect extract-includes $RUN/relevant.txt $RUN/filter-*.md
```

### Step 3: Prioritise for deep reading (LLM)

```
collect chunk-headers $RUN/relevant.txt $RUN/prioritise
```

Launch one subagent per chunk. Each subagent should:

1. Read its assigned chunk from `$RUN/prioritise/chunk-N.md`
2. Read the newsletter design in `./newsletter-design.md`
3. Select the headers that are most worth reading in full — based on how
   actionable the signal is and how credible the source appears
4. Write a decision for every header using this format, separated by `---`:

   ```
   ## Header: path/to/header.yaml
   **Decision:** INCLUDE
   **Reason:** Roku SDK changelog with breaking changes — must read
   ---
   ## Header: path/to/other.yaml
   **Decision:** EXCLUDE
   **Reason:** Generic CTV market forecast with no actionable detail
   ---
   ```

   Write the output to `$RUN/prioritise-N.md` (matching its chunk number).

Err on the side of including something if it looks promising.

Extract the INCLUDE paths:

```
collect extract-includes $RUN/shortlist.txt $RUN/prioritise-*.md
```

### Step 4: Deep read and evaluate (LLM)

```
collect chunk-articles $RUN/shortlist.txt $RUN/deep-read
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
collect prepare $RUN/evaluations.md $RUN/newsletter-input
```

This writes `$RUN/newsletter-input/includes.txt` (one header path per line),
calculates the total word count of all INCLUDE articles, and:

- **Under 50k words:** automatically runs `chunk-articles.ts` to write chunks
  to `$RUN/newsletter-input/single/`. Proceed to Step 6.
- **Over 50k words:** prints a message that affinity grouping is needed.
  This is an LLM step:
  1. Read `$RUN/evaluations.md` and look at the section assignments for each
     INCLUDE article
  2. Group articles that share the same or overlapping sections
  3. Write one file per group to `$RUN/newsletter-input/`
  4. Run `collect chunk-articles <group-file> $RUN/newsletter-input/group-N/`
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
3. This final subagent assembles the complete newsletter and ensures the
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
