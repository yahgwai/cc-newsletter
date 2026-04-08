# cc-newsletter

A Claude Code plugin for automated generation of custom newsletters from RSS feeds. It works by periodically pulling data from RSS feeds of interest, summarising them and then synthesizing the result into a newsletter.

![Example newsletter output](examples/claude-code/example.png)

## Install

Add the marketplace:
```
/plugin marketplace add yahgwai/cc-newsletter
```
then install the plugin
```
/plugin install cc-newsletter@yahgwai-cc-newsletter
```

## Setup wizard

Run the setup wizard to design and configure a newsletter tailored to your needs.

1. **Subject** — nail down what the newsletter covers
2. **Title** — pick a name and scaffold the data directory
3. **Audience** — define who it's for
4. **Tone** — set the editorial voice
5. **Sections** — design 5-8 content sections
6. **Design document** — generate the editorial guide
7. **Source discovery** — find RSS feeds, GitHub repos, and sitemaps via parallel search
8. **Gap analysis** — check section coverage and adjust
9. **Visual style** — choose colors, typography, and layout for the HTML output
10. **Email delivery** — optionally configure SMTP for automatic sending
11. **First run** — ingest content and generate the first edition
12. **Scheduling** — set up cron jobs for recurring ingest and generation

```
/cc-newsletter:setup
```

## How it works

Once configured, two processes run on a cron schedule:

### Ingestion (6 hourly by default)

Pulls new content from your configured sources — RSS feeds, GitHub releases, and documentation sitemaps — and stores each article locally. Then any new articles without summaries are batched and sent to Claude for summarisation, so the content is ready when it's time to write.

### Newsletter generation (weekly by default)

Reads through the past week's summarised articles and produces a finished newsletter:

1. **Filter** — scans all article summaries and discards anything irrelevant to your sections
2. **Prioritise** — reads the full text of promising articles to build a shortlist
3. **Evaluate** — deep-reads shortlisted articles and assigns them to sections
4. **Write** — drafts each section using the selected articles and your design document
5. **Editorial** — polishes prose, checks facts against sources, and tightens the whole piece
6. **Publish** — renders to HTML with your custom styles and optionally emails the result

## Skills

The plugin provides three slash commands:

| Skill | Description |
|---|---|
| `/cc-newsletter:setup` | Interactive wizard that configures a new newsletter end-to-end |
| `/cc-newsletter:discover` | Find and add new content sources for an existing newsletter |
| `/cc-newsletter:reference` | CLI command reference for all available operations |
