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
  2. Group articles that share the same or overlapping sections — e.g. all the
     Services & Financials articles together, TV+ & Originals together, etc.
     Articles assigned to multiple sections go with whichever group they fit best
  3. Write one file per group to `$RUN/newsletter-input/` (e.g.
     `group-services.txt`, `group-tv.txt`), each containing header paths
     one per line
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
