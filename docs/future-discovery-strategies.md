# Feed Discovery Strategies

## 1. Agent-driven search (building now)
Give an agent a subject and categories of sources to look for (official blogs, GitHub repos, personal blogs, community forums, aggregators). The agent searches the web, finds sites, and we mechanically extract and validate feed URLs from them.

## 2. Link following / graph expansion (shelved)
After syncing feeds, extract URLs from the collected Markdown content. Fetch those URLs and check for RSS/Atom feeds. Repeat in cycles — each sync brings new links to follow.

**Problem:** links often point to irrelevant sites. Without relevance filtering, noise compounds — one off-topic feed leads to more off-topic links. Filtering requires an LLM to check each URL against the subject, adding cost. Worth revisiting once we have a better sense of what filtering is needed.

## 3. Social/aggregator mining (not explored)
Aggregators like Hacker News, Reddit, Lobste.rs have per-tag/topic feeds. Posts shared on them link to blogs we might not find through search. Partially covered by strategy 1 (the aggregator feeds themselves are discoverable by search).

## 4. Blogrolls / recommendation lists (not explored)
Some bloggers maintain curated lists of blogs they recommend. These are high-signal discovery sources but hard to find programmatically.
