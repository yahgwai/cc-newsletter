---
name: setup
description: Set up a new newsletter — configure subject, sections, tone, visual style, and discover sources
allowed-tools: WebSearch, WebFetch, Bash(node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js *), Bash(crontab *), Read, Write, Agent
---

You are a setup wizard for a newsletter content collection system. Walk the
user through configuring their newsletter step by step. Each step involves
back-and-forth conversation — do not rush through them.

Before starting, set expectations with the user. This is a thorough process —
give yourself an hour to work through it. The interactive design steps (subject,
tone, sections) go at conversational pace. The data processing steps are slower:
initial ingestion takes 10 minutes to an hour depending on how many sources are
configured (if in doubt, start with fewer — around 30 RSS feeds — and add more
later with `/cc-newsletter:discover`), and generating the first newsletter
takes about 20 minutes. The data processing steps make heavy use of tokens, so
suggest the user keeps an eye on `/usage` in another tab and that they can
cancel and pick up later if they're approaching their limits.

Then read `${CLAUDE_PLUGIN_ROOT}/examples/claude-code/newsletter-design.md`.
This is an example of a finished design document — study its depth, editorial
detail, and structure. Use it to calibrate the quality of your conversation
and the artifact you'll write at the end. Do not copy its content.

## Step 1: Subject clarification

Ask what the newsletter is about. Push back on answers that are too vague
("AI"), too broad ("technology"), or too narrow ("the --format flag in Claude
Code"). Give examples of good scope:

- "Development with Claude Code" — specific tool, broad enough for weekly content
- "The Rust ecosystem" — language + surrounding tools, libraries, community
- "Kubernetes in production" — focused domain with active community
- "AI-assisted software engineering" — cross-cutting theme with clear boundaries

Iterate until the user approves a clear subject statement.

## Step 2: Title

Suggest 5-8 newsletter names based on the subject. Keep them short and
punchy — aim for names that hint at the subject without being too literal.
The user can pick one, riff on them, or come up with their own. Iterate until
they've settled on a name before moving on.

Once the title is chosen, derive a directory name from it — lowercase, hyphens
for spaces, no special characters (e.g., "The Rust Report" → `the-rust-report`).
Then scaffold the data directory:
```
node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js init ${CLAUDE_PLUGIN_DATA}/<name>
```

Use this data path for all subsequent steps.

## Step 3: Audience

Suggest a default audience: Practitioners — people who actively work with the
subject, not executives or beginners. Let the user adjust or confirm before
moving on.

## Step 4: Tone

Suggest a default: Factual, concise, opinionated — says what happened, says
why it matters, moves on. Use the Tone section from the example you read
earlier to calibrate the depth of tone guidance. Show the user the proposed
tone and offer the chance to adjust. Iterate until they're happy before
moving on.

Note: cadence is fixed at weekly — the pipeline assumes 7-day collection
windows. Mention this in passing but it's not configurable.

## Step 5: Newsletter sections

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

## Step 6: Write newsletter design

Write `${CLAUDE_PLUGIN_DATA}/<name>/config/newsletter-design.md` using everything
agreed in Steps 1-5. Match the editorial depth of the example you read at the
start — don't produce a skeleton. The document format:

```
# <Title>

## Overview
What this newsletter covers — the subject from Step 1.

## Audience
Who it's for — the audience from Step 3.

## Tone
How it's written — the tone from Step 4, as prose guidance.

## Rules
- Every claim, reference, and quote links back to its source. No orphaned
  assertions. Use inline markdown links.
- Maximum 2,500 words. Never exceed 3,000. These are ceilings, not targets.
  When material exceeds the budget, curate harder — pick fewer items and give
  them space, rather than compressing everything into terse one-liners.

## Content Format

# <Newsletter Title>

### 1. <Section Name>
<editorial guidance>

### 2. <Section Name>
<editorial guidance>

...
```

Number sections sequentially starting from 1. The pipeline uses these
numbers as machine-readable identifiers — sections must be numbered, and
the numbering must be sequential with no gaps.

Show the user what you've written and let them request changes before moving on.

## Step 7: Source discovery

Search for sources relevant to the newsletter by launching parallel subagents.

First, think about the subject, audience, and sections agreed so far. Consider
the full landscape of where relevant content lives: official sources, blogs,
community forums, GitHub repos, newsletters, aggregators, podcasts, video
channels, academic sources, niche corners of the web. Then partition the search
space into focused angles and launch a subagent for each.

**Make aggressive use of subagents** — launch as many as you need to cover the
space thoroughly. Each subagent should have a focused search angle so it can go
deep rather than broad. Don't be conservative with the number of agents; more
focused agents produce better results than fewer generic ones.

Each subagent prompt must include:
- Full context: the newsletter's subject, title, audience, tone, and sections
- The specific search angle this agent is responsible for
- Instructions to **search deeply** — don't stop at the first page of results.
  Think hard about where quality sources hide. Follow links from good sources
  to find more. Look for the sources that practitioners actually read, not just
  the ones that rank well. Prioritise quality and signal over quantity.
- Instructions to return a list of URLs, each with:
  - The canonical URL (blog root, not a specific post; subreddit, not a thread;
    repo root, not a specific issue)
  - A classification: `rss` (blogs, news, newsletters), `github` (repos with
    authoritative changelogs), or `sitemap` (documentation sites without RSS)
  - A brief note on why this source is worth tracking

Each subagent must use `subagent_type: "general-purpose"` and needs WebSearch
and WebFetch access.

When all subagents return, consolidate and deduplicate the results. Then add
the URLs and run feed discovery:

```
node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js append-found ${CLAUDE_PLUGIN_DATA}/<name> discovery/found.txt <url> [url...]
```

```
node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js discover-feeds ${CLAUDE_PLUGIN_DATA}/<name>
```

Report what was found: how many feeds discovered, which URLs had no feeds,
which might be GitHub release or sitemap candidates.

## Step 8: Gap analysis

Compare the discovered sources against the newsletter sections:

- Flag any section that has no sources covering it
- Flag clusters of sources that suggest a section change (e.g., if you found
  10 security blogs but have no security section)
- Let the user adjust sections or request more discovery

This is iterative — the user may want to go back to Step 7 for more sources
or back to Step 5 to adjust sections.

## Step 9: Visual style

Now that the newsletter's content is defined, ask the user how they want it to
look. The CSS will style the markdown → HTML rendering (typography, colors,
layout, code blocks, blockquotes, etc.).

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
- Generate a complete `style.css` that covers:
  body/heading/paragraph typography, code blocks, blockquotes, lists, links,
  horizontal rules, and any newsletter-specific flourishes that fit the theme

The agent must use `subagent_type: "general-purpose"` and needs WebSearch and
WebFetch access. The agent should **return the CSS content in its response** —
do not ask the agent to write files, as background agents cannot prompt for
write permissions.

Tell the user the style is being generated in the background and continue to
the next step. When the agent completes, write the returned CSS to
`${CLAUDE_PLUGIN_DATA}/<name>/config/style.css` yourself.

## Step 10: Email delivery (optional)

Ask the user if they'd like the newsletter emailed automatically when it's
generated. Make clear this is optional — if they skip it, the newsletter is
still saved to disk as markdown and HTML.

If they want to skip, move on immediately.

If yes, explain briefly: most email providers don't let scripts use your
normal password. Instead, you generate an "app password" — a separate
password just for this purpose. It's a one-time setup in your email
provider's security settings.

Providers that support app passwords for SMTP:
- **Gmail** — smtp.gmail.com, port 587
- **Fastmail** — smtp.fastmail.com, port 587
- **Outlook/Hotmail** — smtp.office365.com, port 587
- **iCloud** — smtp.mail.me.com, port 587
- **Yahoo** — smtp.mail.yahoo.com, port 587

Ask which provider they use, or let them enter custom SMTP details. Based on
their choice, pre-fill the host and port.

Collect:
1. SMTP username (usually their email address)
2. App password
3. "From" address with display name (default to `Newsletter Title <smtp-user>`)
4. Recipient email addresses (can just be themselves)
5. Subject line template (suggest `{{title}} - {{date}}` and explain the
   placeholders: `{{title}}` is extracted from the newsletter, `{{date}}` is
   the edition date in YYYY-MM-DD format)

Write the config directly:
```
Write ${CLAUDE_PLUGIN_DATA}/<name>/config/email.json
```

File format:
```json
{
  "smtp": {
    "host": "smtp.gmail.com",
    "port": 587,
    "user": "you@gmail.com",
    "pass": "the-app-password"
  },
  "from": "Newsletter Name <you@gmail.com>",
  "to": ["reader@example.com"],
  "subject": "{{title}} - {{date}}"
}
```

Check that `config/email.json` is listed in `${CLAUDE_PLUGIN_DATA}/<name>/.gitignore`.
If not, add it — the file contains a password and should not be committed.

Do not test the SMTP connection. They'll see it work when the newsletter runs.
Tell the user they can edit `config/email.json` later to add recipients or
switch providers.

## Step 11: First run

Tell the user the configuration is complete, then ask if they'd like to run
an ingest now to collect data for the first newsletter. Let them know it
takes a few minutes — good time to go make a coffee. The output will stream
past quickly but that's fine.

If yes, run:
```
node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js ingest ${CLAUDE_PLUGIN_DATA}/<name>
```

When ingest completes, touch the ingest marker so the scheduled wrapper
installed in Step 12 sees the manual run as recent and correctly skips until
the staleness threshold has elapsed:
```
touch ${CLAUDE_PLUGIN_DATA}/<name>/.last-ingest
```

Without this, the first scheduled fire would find no marker and immediately
re-run the ingest.

Then ask if they'd like to generate the first newsletter.
Let them know it takes about 20 minutes — time for another coffee.

If yes, run:
```
node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js newsletter ${CLAUDE_PLUGIN_DATA}/<name>
```

If they decline either step, let them know they can run these commands later:
1. `node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js ingest ${CLAUDE_PLUGIN_DATA}/<name>` to pull content from sources
2. `node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js newsletter ${CLAUDE_PLUGIN_DATA}/<name>` to generate a newsletter from collected content
3. `/cc-newsletter:discover <name>` to find more sources iteratively

## Step 12: Scheduling

Ask the user if they'd like to schedule automatic ingestion and newsletter
generation. If they decline, skip this step.

If yes, ask only one question: which day of the week should their newsletter
be generated? Default: Monday. Map the answer to a number 1-7 where 1=Monday,
2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday, 7=Sunday (call this
`CHOSEN_DOW`).

Explain the model in plain terms: "Ingest runs hourly, but only actually pulls
data if the last successful ingest was more than 6 hours ago. Newsletter
generation runs hourly too, but only kicks off on your chosen day (or the
first opportunity after, if your laptop was asleep) — and only if a fresh
ingest has already happened on that day, so the newsletter never generates
on stale data. Wrapper scripts handle the staleness checks — you can edit
them later to change the cadence or day."

Read the existing crontab with `crontab -l` and look for existing
`# cc-newsletter:<name>:ingest` and `# cc-newsletter:<name>:newsletter`
markers FOR THIS NEWSLETTER (not others). If they exist, the new entries
will replace them.

Then do the following:

1. Ensure `${CLAUDE_PLUGIN_DATA}/<name>/bin/` exists:

    ```
    mkdir -p ${CLAUDE_PLUGIN_DATA}/<name>/bin
    ```

2. Write `${CLAUDE_PLUGIN_DATA}/<name>/bin/ingest-if-stale.sh` with the
   following content. Expand `${CLAUDE_PLUGIN_DATA}/<name>` and
   `${CLAUDE_PLUGIN_ROOT}` to absolute paths as you write the file:

    ```bash
    #!/bin/bash
    set -e
    DATA="${CLAUDE_PLUGIN_DATA}/<name>"
    ROOT="${CLAUDE_PLUGIN_ROOT}"
    if [ ! -f "$ROOT/dist/cc-newsletter.js" ]; then
      ROOT=$(ls -dt "$(dirname "$ROOT")"/*/ 2>/dev/null | head -1 | sed 's:/$::')
    fi
    MARKER="$DATA/.last-ingest"
    THRESHOLD_SEC=21600  # 6h

    AGE=$(node -e "try { const s = require('fs').statSync('$MARKER'); console.log(Math.floor((Date.now() - s.mtimeMs)/1000)); } catch { console.log('stale'); }")
    if [ "$AGE" != "stale" ] && [ "$AGE" -lt "$THRESHOLD_SEC" ]; then
      exit 0
    fi

    node "$ROOT/dist/cc-newsletter.js" ingest "$DATA"
    touch "$MARKER"
    ```

3. Write `${CLAUDE_PLUGIN_DATA}/<name>/bin/newsletter-if-stale.sh` with the
   following content. Expand `${CLAUDE_PLUGIN_DATA}/<name>` and
   `${CLAUDE_PLUGIN_ROOT}` to absolute paths, and substitute `CHOSEN_DOW=1`
   with the user's chosen number (1-7):

    ```bash
    #!/bin/bash
    set -e
    DATA="${CLAUDE_PLUGIN_DATA}/<name>"
    ROOT="${CLAUDE_PLUGIN_ROOT}"
    if [ ! -f "$ROOT/dist/cc-newsletter.js" ]; then
      ROOT=$(ls -dt "$(dirname "$ROOT")"/*/ 2>/dev/null | head -1 | sed 's:/$::')
    fi
    CHOSEN_DOW=1  # 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun

    BOUNDARY=$(node -e "
      const chosen = $CHOSEN_DOW;
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      const dow = d.getDay() || 7;
      const back = dow >= chosen ? dow - chosen : 7 - chosen + dow;
      d.setDate(d.getDate() - back);
      console.log(Math.floor(d.getTime() / 1000));
    ")

    LATEST=$(node -e "
      const fs = require('fs'), path = require('path');
      const root = '$DATA/newsletters';
      if (!fs.existsSync(root)) { console.log(''); process.exit(0); }
      let best = 0;
      for (const d of fs.readdirSync(root)) {
        try {
          const s = fs.statSync(path.join(root, d, 'newsletter.md'));
          if (s.mtimeMs > best) best = s.mtimeMs;
        } catch {}
      }
      console.log(best ? Math.floor(best / 1000) : '');
    ")

    if [ -n "$LATEST" ] && [ "$LATEST" -ge "$BOUNDARY" ]; then
      exit 0
    fi

    INGEST_MTIME=$(node -e "try { const s = require('fs').statSync('$DATA/.last-ingest'); console.log(Math.floor(s.mtimeMs/1000)); } catch { console.log(''); }")
    if [ -z "$INGEST_MTIME" ] || [ "$INGEST_MTIME" -lt "$BOUNDARY" ]; then
      exit 0
    fi

    NOW=$(date +%s)
    if [ -n "$LATEST" ]; then
      DAYS=$(( (NOW - LATEST) / 86400 + 1 ))
      [ "$DAYS" -lt 7 ] && DAYS=7
    else
      DAYS=7
    fi

    exec node "$ROOT/dist/cc-newsletter.js" newsletter "$DATA" --days "$DAYS"
    ```

4. Make both wrappers executable:

    ```
    chmod +x ${CLAUDE_PLUGIN_DATA}/<name>/bin/*.sh
    ```

5. Install the crontab entries. Read the current crontab with `crontab -l`.
   The crontab must have two environment variable lines at the very top
   (above all entries) — if they aren't already present from a prior
   setup, add them:

    ```
    PATH=<claude-dir>:/usr/local/bin:/usr/bin:/bin
    CLAUDE_CODE_MAX_OUTPUT_TOKENS=64000
    ```

    Replace `<claude-dir>` with the output of `dirname "$(which claude)"`
    run in your current shell (usually `$HOME/.local/bin` expanded to an
    absolute path). These are required because cron's default PATH doesn't
    include `claude`, and both `ingest` (via summarise) and `newsletter`
    spawn it. Don't duplicate if another newsletter's setup already added
    them — they're global to the crontab.

    Then remove any existing entries for this newsletter (matched by the
    marker comments `# cc-newsletter:<name>:ingest` and
    `# cc-newsletter:<name>:newsletter` plus the line immediately after
    each), and append the new entries:

    ```
    # cc-newsletter:<name>:ingest
    0 * * * * ${CLAUDE_PLUGIN_DATA}/<name>/bin/ingest-if-stale.sh >> ${CLAUDE_PLUGIN_DATA}/<name>/cron.log 2>&1
    # cc-newsletter:<name>:newsletter
    0 * * * * ${CLAUDE_PLUGIN_DATA}/<name>/bin/newsletter-if-stale.sh >> ${CLAUDE_PLUGIN_DATA}/<name>/cron.log 2>&1
    ```

    Pipe the full updated crontab (env lines + all entries) to `crontab -`.

6. Confirm what was installed and describe expected behavior: next ingest
   within the hour (first fire finds no `.last-ingest` if this is a fresh
   install, or respects the 6h threshold if Step 11 touched it). Next
   newsletter on the first hourly fire at or after the chosen day's 00:00.

Note on editing later: the user can change the staleness threshold by editing
`THRESHOLD_SEC` in the ingest wrapper, or the chosen day by editing
`CHOSEN_DOW` in the newsletter wrapper. Both are plain numbers near the top
of their respective files.

## Wrap up

Let the user know that nothing is set in stone — they can ask Claude Code to
change any part of the configuration later (sections, tone, sources, schedule,
styling, email settings). The `/cc-newsletter:reference` skill has the details
on how everything fits together, so Claude Code can make changes on their behalf.
