# Newsletter Project

This project uses [collect-runner](https://github.com/chrisberkhout/collect-runner) for content collection.

## Pipeline
See newsletter-design.md for the full newsletter production pipeline.
Run `/setup` to create it interactively.

## File layout
- `feeds.json`, `github-releases.json`, `sitemaps.json` — source configs
- `feeds/` — synced articles (auto-created)
- `discovery/` — feed discovery working files
- `runs/` — pipeline run artifacts
- `newsletters/` — generated newsletters
