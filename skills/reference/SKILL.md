---
name: reference
description: Reference for all cc-newsletter CLI commands — syncing, ingesting, newsletter pipeline, and utilities
---

# cc-newsletter CLI

Content collection and newsletter production CLI, bundled with the cc-newsletter plugin.
Every command takes a `<data-dir>` argument — the full path to the newsletter's data directory.

All commands use the prefix: `node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js <command> <data-dir>`

When invoked from skills, the data dir is `${CLAUDE_PLUGIN_DATA}/<name>`.

## Data directory structure

Each newsletter lives in its own data directory with this layout:

```
my-newsletter/
├── .last-ingest                  # Marker file, touched after successful ingest
├── bin/
│   ├── ingest-if-stale.sh        # Cron wrapper: ingests if >6h since last run
│   └── newsletter-if-stale.sh    # Cron wrapper: generates if not yet this week
├── feeds.json                    # RSS feed URLs to sync
├── github-releases.json          # GitHub repos to track releases from
├── sitemaps.json                 # Documentation sitemaps to crawl
├── config/
│   ├── newsletter-design.md      # Editorial guide: subject, tone, sections
│   ├── style.css                 # Custom CSS for HTML rendering
│   └── email.json                # SMTP config (gitignored)
├── content/
│   └── <source-slug>/            # One directory per feed/repo/sitemap
│       ├── <article-slug>.md           # Article body (markdown)
│       └── <article-slug>-header.yaml  # Metadata: title, link, date, tokens, summary
├── discovery/
│   ├── found.txt                 # Raw URLs found during source discovery
│   ├── feeds.txt                 # Validated RSS feeds extracted from found.txt
│   └── checked.json              # URLs already checked for feeds
└── newsletters/
    └── <YYYY-MM-DD>/             # One directory per edition
        ├── chunk-*.md            # Intermediate: article header chunks
        ├── filter-*.md           # Intermediate: relevance filter results
        ├── relevant.txt          # Articles that passed the filter
        ├── shortlist.txt         # Articles prioritised for deep reading
        ├── evaluations-*.md      # Intermediate: deep read evaluations
        ├── evaluations.md        # Combined evaluations
        ├── draft.md              # Pre-editorial draft
        ├── newsletter.md         # Final newsletter (markdown)
        ├── newsletter.html       # Final newsletter (HTML with style.css)
        └── progress.json         # Pipeline step completion tracking
```

## High-level workflows

**First-time setup:**
```
node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js init ${CLAUDE_PLUGIN_DATA}/my-newsletter
```

**Weekly newsletter production:**
```
node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js ingest ${CLAUDE_PLUGIN_DATA}/my-newsletter && node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js newsletter ${CLAUDE_PLUGIN_DATA}/my-newsletter
```

## Commands

### Management

- `ls ${CLAUDE_PLUGIN_DATA}` — List existing newsletters (each directory is a newsletter)
- `node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js init <data-dir>` — Scaffold a new newsletter: creates config files and `.gitignore` in the data directory

### Content syncing

- `node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js ingest <data-dir>` — Run all sync commands then summarise new articles (sync-rss + sync-github-releases + sync-sitemaps + summarise)
- `node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js sync-rss <data-dir>` — Fetch new articles from all RSS feeds in `feeds.json`
- `node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js sync-github-releases <data-dir>` — Fetch new releases from repos in `github-releases.json`
- `node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js sync-sitemaps <data-dir>` — Fetch new pages from sites in `sitemaps.json`
- `node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js summarise <data-dir>` — Summarise any unsummarised articles using Claude

### Newsletter pipeline

- `node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js newsletter <data-dir> [--date YYYY-MM-DD] [--days N]` — Run the full newsletter pipeline. Defaults: today's date, 7 days. Produces `newsletters/YYYY-MM-DD/newsletter.md` and `newsletter.html`. If `config/email.json` exists, emails the result. Progress written to `newsletters/YYYY-MM-DD/progress.json`. Requires `CLAUDE_CODE_MAX_OUTPUT_TOKENS=64000` and a `PATH` that includes the `claude` CLI — both set automatically by the scheduled wrapper (`bin/newsletter-if-stale.sh`). When running manually outside the wrapper, export these yourself.
- `node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js recent-headers <data-dir> [days] [--date YYYY-MM-DD]` — Collect recent article headers into chunks in `newsletters/YYYY-MM-DD/`

### Email delivery

The newsletter pipeline optionally sends the generated HTML via email after each run. To enable, create `config/email.json` in the data directory:

```json
{
  "smtp": {
    "host": "smtp.gmail.com",
    "port": 587,
    "user": "you@gmail.com",
    "pass": "your-app-password"
  },
  "from": "Newsletter Name <you@gmail.com>",
  "to": ["reader1@example.com", "reader2@example.com"],
  "subject": "{{title}} - {{date}}"
}
```

Common SMTP providers: Gmail (smtp.gmail.com:587), Fastmail (smtp.fastmail.com:587), Outlook (smtp.office365.com:587), iCloud (smtp.mail.me.com:587), Yahoo (smtp.mail.yahoo.com:587). Use an app password, not your regular password.

Subject template placeholders: `{{date}}` is replaced with the newsletter date (YYYY-MM-DD), `{{title}}` with the newsletter title. When `config/email.json` is absent, email is silently skipped. SMTP failures are logged but do not prevent the newsletter from being saved to disk.

### Source discovery

- `node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js discover-feeds <data-dir>` — Extract RSS feeds from URLs in `discovery/found.txt`, write results to `discovery/feeds.txt`
- `node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js append-found <data-dir> <file> <url...>` — Deduplicate and append URLs to a discovery file

### Pipeline utilities

These are used internally by the newsletter pipeline but can be run standalone:

- `node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js prepare <data-dir> <evaluations-file> <output-dir>` — Parse evaluations, group articles, chunk for writing
- `node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js chunk-articles <data-dir> <list-file> <output-dir>` — Chunk a list of articles with full content
- `node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js chunk-headers <data-dir> <list-file> <output-dir>` — Chunk a list of headers (no article bodies)
- `node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js extract-includes <data-dir> <output-file> <input-files...>` — Extract INCLUDE header paths from decision files
- `node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js combine-lists <data-dir> <output-file> <input-files...>` — Deduplicate and merge text list files

### Scheduling

Scheduling is optional — newsletters run fine manually. When enabled, two wrapper scripts at `${CLAUDE_PLUGIN_DATA}/<name>/bin/` gate the work behind staleness checks, and two hourly crontab entries invoke them. The setup wizard (`/cc-newsletter:setup`) installs this at Step 12, but scheduling can also be added to an existing newsletter at any time using the procedure below.

Day-of-week convention used throughout: **1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun**.

#### What the wrappers do

- **`ingest-if-stale.sh`** — checks `.last-ingest` mtime. Skips if less than `THRESHOLD_SEC` (default 21600 = 6h) ago. Otherwise runs `ingest <data-dir>` and touches the marker on success.

- **`newsletter-if-stale.sh`** — checks the newest `newsletters/*/newsletter.md` mtime against this week's chosen-day 00:00 boundary. Skips if a newsletter was generated since that boundary. Also requires `.last-ingest` mtime to be on or after that same boundary — ensures the newsletter isn't generated on stale data. If no fresh ingest has happened since the chosen day, the wrapper waits (the next hourly fire picks up again). Otherwise runs `newsletter <data-dir> --days N`, where N is the number of days since the last newsletter (minimum 7 — widens automatically for catch-up after missed windows).

#### Installing scheduling

To add scheduling to an existing newsletter (or re-add it after it was skipped at setup time):

1. Ask the user which day of the week they want newsletter generation on. Default Monday. Map to a number 1-7 per the convention above — call it `CHOSEN_DOW`.

2. Ensure `${CLAUDE_PLUGIN_DATA}/<name>/bin/` exists (`mkdir -p`).

3. Write `${CLAUDE_PLUGIN_DATA}/<name>/bin/ingest-if-stale.sh`. The `${CLAUDE_PLUGIN_DATA}/<name>` and `${CLAUDE_PLUGIN_ROOT}` placeholders in the content below must be expanded to absolute paths at write time — the written file has no env var references:

    ```bash
    #!/bin/bash
    set -e
    DATA="${CLAUDE_PLUGIN_DATA}/<name>"
    ROOT="${CLAUDE_PLUGIN_ROOT}"
    MARKER="$DATA/.last-ingest"
    THRESHOLD_SEC=21600  # 6h

    AGE=$(node -e "try { const s = require('fs').statSync('$MARKER'); console.log(Math.floor((Date.now() - s.mtimeMs)/1000)); } catch { console.log('stale'); }")
    if [ "$AGE" != "stale" ] && [ "$AGE" -lt "$THRESHOLD_SEC" ]; then
      exit 0
    fi

    node "$ROOT/dist/cc-newsletter.js" ingest "$DATA"
    touch "$MARKER"
    ```

4. Write `${CLAUDE_PLUGIN_DATA}/<name>/bin/newsletter-if-stale.sh`, with `DATA` and `ROOT` as absolute paths and `CHOSEN_DOW` replaced with the user's chosen number:

    ```bash
    #!/bin/bash
    set -e
    DATA="${CLAUDE_PLUGIN_DATA}/<name>"
    ROOT="${CLAUDE_PLUGIN_ROOT}"
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

5. Make both wrappers executable: `chmod +x ${CLAUDE_PLUGIN_DATA}/<name>/bin/*.sh`.

6. If an ingest has already been run for this newsletter, touch `${CLAUDE_PLUGIN_DATA}/<name>/.last-ingest` so the first scheduled fire respects the 6h threshold. If no ingest has happened yet, leave the marker absent — the next cron fire will run the first ingest.

7. Install the crontab entries. Read the current crontab with `crontab -l`. The crontab must have two environment variable lines at the very top (above all entries) — if they're not already present from a prior setup, add them:

    ```
    PATH=<claude-dir>:/usr/local/bin:/usr/bin:/bin
    CLAUDE_CODE_MAX_OUTPUT_TOKENS=64000
    ```

    Replace `<claude-dir>` with the output of `dirname "$(which claude)"` run in the user's interactive shell (usually `$HOME/.local/bin`, absolute). These are required because cron's default PATH doesn't include `claude`, and summarise/newsletter invoke it via `spawn`. They're global to the crontab, so set them once — don't duplicate if another newsletter's setup already added them.

    Then remove any existing `# cc-newsletter:<name>:ingest` or `# cc-newsletter:<name>:newsletter` marker comments (and the line immediately following each), and append:

    ```
    # cc-newsletter:<name>:ingest
    0 * * * * ${CLAUDE_PLUGIN_DATA}/<name>/bin/ingest-if-stale.sh >> ${CLAUDE_PLUGIN_DATA}/<name>/cron.log 2>&1
    # cc-newsletter:<name>:newsletter
    0 * * * * ${CLAUDE_PLUGIN_DATA}/<name>/bin/newsletter-if-stale.sh >> ${CLAUDE_PLUGIN_DATA}/<name>/cron.log 2>&1
    ```

    Both fire hourly. Expand `${CLAUDE_PLUGIN_DATA}/<name>` to an absolute path. Pipe the full updated crontab (env lines + all entries) to `crontab -`.

8. Confirm to the user what was installed and the day their newsletter will generate on.

#### Changing or removing scheduling

- **Change staleness threshold:** edit `THRESHOLD_SEC` in `bin/ingest-if-stale.sh` (value in seconds).
- **Change day of week:** edit `CHOSEN_DOW` in `bin/newsletter-if-stale.sh`.
- **Force a run outside the wrapper's gate:** invoke the CLI directly — `node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js ingest <data-dir>` or `node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js newsletter <data-dir>`.
- **Remove scheduling:** read `crontab -l`, strip the two `# cc-newsletter:<name>:...` marker comments and their following lines, pipe back to `crontab -`. The wrapper files in `bin/` can be left in place or deleted.

Run `crontab -l | grep cc-newsletter` to see installed schedules.
