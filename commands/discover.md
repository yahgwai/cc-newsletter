---
name: discover
description: Discover websites and online sources relevant to the newsletter's subject
allowed-tools: WebSearch, WebFetch, Bash(node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js *), Read
---

The user will provide a newsletter name as an argument (e.g., `/cc-newsletter:discover my-newsletter`).
Use this name to construct the data path: `${CLAUDE_PLUGIN_DATA}/<name>`.

Read the Overview section of `${CLAUDE_PLUGIN_DATA}/<name>/config/newsletter-design.md` to
determine the newsletter's subject. You are searching for websites and online
sources relevant to that subject.

## Process

1. Think broadly about this subject. What kinds of people write about
   it? What kinds of places publish content about it? What communities
   discuss it? What adjacent topics might lead to relevant sources?
2. Read `${CLAUDE_PLUGIN_DATA}/<name>/discovery/found.txt` if it exists. Consider what
   types of sources are already represented and what's missing.
3. Think about what searches would fill those gaps, or what new angles
   you haven't tried.
4. Search the web. For each relevant site you find, add it using:
   ```
   node ${CLAUDE_PLUGIN_ROOT}/dist/cc-newsletter.js append-found ${CLAUDE_PLUGIN_DATA}/<name> discovery/found.txt <url> [url...]
   ```
5. Add URLs after each search, not at the end.

## URL format

Store the most useful canonical URL for each source. For example:

- A blog: https://simonwillison.net (not https://simonwillison.net/2026/some-post?utm_source=twitter)
- A subreddit: https://www.reddit.com/r/{topic} (not a specific post)
- A GitHub repo: https://github.com/{org}/{repo} (not a specific issue or PR)
- A YouTube channel: https://www.youtube.com/@{channelname} (not a specific video)
- A newsletter: https://newsletter.example.com (not an archived issue)
- A forum category: https://community.example.com/c/{topic} (not a specific thread)

If a site hosts multiple distinct sources (different subreddits,
different GitHub repos), store each one separately.
