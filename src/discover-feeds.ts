import { readFileSync, writeFileSync, existsSync } from "fs";
import Parser from "rss-parser";

const parser = new Parser();

// These categories won't have standard RSS feeds
const SKIP_PATTERNS: RegExp[] = [
  /^https:\/\/github\.com/,
  /^https:\/\/gist\.github\.com/,
  /^https:\/\/discord\.com/,
  /^https:\/\/x\.com/,
  /^https:\/\/twitter\.com/,
  /^https:\/\/(www\.)?youtube\.com/,
  /^https:\/\/podcasts\.apple\.com/,
  /^https:\/\/open\.spotify\.com/,
  /^https:\/\/(www\.)?npmjs\.com/,
  /^https:\/\/arxiv\.org/,
  /^https:\/\/(www\.)?udemy\.com/,
  /^https:\/\/(www\.)?pluralsight\.com/,
  /^https:\/\/(www\.)?skool\.com/,
  /^https:\/\/learn\.deeplearning\.ai/,
  /^https:\/\/(www\.)?reddit\.com/,
  /^https:\/\/twitter-thread\.com/,
  /^https:\/\/deepwiki\.com/,
  /^https:\/\/roadmap\.sh/,
];

function shouldSkip(url: string): boolean {
  return SKIP_PATTERNS.some((p) => p.test(url));
}

function knownFeedUrl(url: string): string | null {
  const u = new URL(url);

  // Substack — /feed
  if (u.hostname.endsWith(".substack.com")) {
    return `${u.origin}/feed`;
  }

  // dev.to — /feed/<username>
  if (u.hostname === "dev.to") {
    const username = u.pathname.split("/").filter(Boolean)[0];
    if (username) return `https://dev.to/feed/${username}`;
  }

  // Medium user or publication
  if (u.hostname === "medium.com") {
    return `https://medium.com/feed${u.pathname}`;
  }
  if (u.hostname.endsWith(".medium.com")) {
    const sub = u.hostname.replace(".medium.com", "");
    return `https://medium.com/feed/@${sub}`;
  }

  return null;
}

async function validateFeed(feedUrl: string): Promise<boolean> {
  try {
    const res = await fetch(feedUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RSS-Discovery/1.0)" },
      signal: AbortSignal.timeout(10000),
      redirect: "follow",
    });
    if (!res.ok) return false;
    const body = await res.text();
    const feed = await parser.parseString(body);
    return (feed.items?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

// Parse HTML for <link rel="alternate" type="application/(rss|atom)+xml">
function extractFeedLinks(html: string, baseUrl: string): string[] {
  const feeds: string[] = [];
  const tagRegex = /<link\s[^>]*>/gi;

  for (const match of html.matchAll(tagRegex)) {
    const tag = match[0];
    if (!/type=["']application\/(rss|atom)\+xml["']/i.test(tag)) continue;
    const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
    if (!hrefMatch) continue;
    try {
      feeds.push(new URL(hrefMatch[1], baseUrl).href);
    } catch {}
  }

  return feeds;
}

async function discoverFromHtml(url: string): Promise<string[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RSS-Discovery/1.0)" },
      signal: AbortSignal.timeout(10000),
      redirect: "follow",
    });
    if (!res.ok) return [];
    const html = await res.text();
    return extractFeedLinks(html, url);
  } catch {
    return [];
  }
}

async function tryCommonPaths(url: string): Promise<string | null> {
  const u = new URL(url);
  const base = u.origin + u.pathname.replace(/\/$/, "");

  // Common feed paths, deduplicated
  const candidates = [
    ...new Set([
      `${base}/feed`,
      `${base}/rss`,
      `${base}/feed.xml`,
      `${base}/rss.xml`,
      `${base}/atom.xml`,
      `${base}/index.xml`,
      `${u.origin}/feed`,
      `${u.origin}/rss`,
      `${u.origin}/feed.xml`,
      `${u.origin}/rss.xml`,
      `${u.origin}/atom.xml`,
      `${u.origin}/index.xml`,
    ]),
  ];

  // Check all in parallel, return first valid one
  const results = await Promise.allSettled(
    candidates.map(async (candidate) => {
      const valid = await validateFeed(candidate);
      if (valid) return candidate;
      throw new Error("not a feed");
    })
  );

  for (const r of results) {
    if (r.status === "fulfilled") return r.value;
  }
  return null;
}

async function discoverFeed(
  url: string
): Promise<{ method: string; feed: string } | null> {
  // 1. Known platform patterns
  const known = knownFeedUrl(url);
  if (known) {
    if (await validateFeed(known)) return { method: "known", feed: known };
  }

  // 2. HTML autodiscovery
  const htmlFeeds = await discoverFromHtml(url);
  for (const feed of htmlFeeds) {
    if (await validateFeed(feed)) return { method: "html", feed };
  }

  // 3. Common path probing
  const commonFeed = await tryCommonPaths(url);
  if (commonFeed) return { method: "path", feed: commonFeed };

  return null;
}

// Run with concurrency limit
async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  const queue = items.map((item, i) => ({ item, i }));

  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (queue.length > 0) {
        const { item, i } = queue.shift()!;
        results[i] = await fn(item);
      }
    })
  );

  return results;
}

// --- Main ---

interface Result {
  url: string;
  status: "found" | "skipped" | "none" | "error";
  method?: string;
  feed?: string;
  error?: string;
}

export async function discoverFeeds() {
  const existingFeeds: string[] = existsSync("feeds.json")
    ? JSON.parse(readFileSync("feeds.json", "utf-8"))
    : [];
  const existingFeedSet = new Set(existingFeeds);

  const CHECKED_PATH = "discovery/checked.json";
  const checked: Record<string, string | null> = existsSync(CHECKED_PATH)
    ? JSON.parse(readFileSync(CHECKED_PATH, "utf-8"))
    : {};

  const urls = [
    ...new Set(
      readFileSync("discovery/found.txt", "utf-8")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
    ),
  ];

  console.log(`Processing ${urls.length} URLs (${existingFeedSet.size} feeds already known)...\n`);

  const results = await mapConcurrent<string, Result>(urls, 10, async (url) => {
    if (shouldSkip(url)) {
      console.log(`SKIP  ${url}`);
      return { url, status: "skipped" };
    }

    if (url in checked) {
      console.log(`DONE  ${url}`);
      return { url, status: "skipped" };
    }

    try {
      const result = await discoverFeed(url);
      if (result) {
        checked[url] = result.feed;
        if (existingFeedSet.has(result.feed)) {
          console.log(`HAVE  ${url} → ${result.feed}`);
          return { url, status: "skipped" };
        }
        console.log(`FOUND ${url}\n   → ${result.feed} (${result.method})`);
        return { url, status: "found", method: result.method, feed: result.feed };
      }
      checked[url] = null;
      console.log(`NONE  ${url}`);
      return { url, status: "none" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      checked[url] = null;
      console.log(`ERR   ${url}: ${msg}`);
      return { url, status: "error", error: msg };
    }
  });

  const found = results.filter((r) => r.status === "found");
  const skipped = results.filter((r) => r.status === "skipped");
  const noFeed = results.filter((r) => r.status === "none" || r.status === "error");

  // Append new feeds to feeds.json
  const newFeeds = found.map((r) => r.feed!);
  if (newFeeds.length > 0) {
    const merged = [...existingFeeds, ...newFeeds];
    writeFileSync("feeds.json", JSON.stringify(merged, null, 2) + "\n");
  }

  writeFileSync(CHECKED_PATH, JSON.stringify(checked, null, 2) + "\n");

  writeFileSync(
    "discovery/skipped.txt",
    skipped.map((r) => r.url).join("\n") + "\n"
  );
  writeFileSync(
    "discovery/no-feed.txt",
    noFeed.map((r) => r.url).join("\n") + "\n"
  );

  console.log(`\n--- Summary ---`);
  console.log(`New feeds found: ${newFeeds.length}`);
  console.log(`Skipped: ${skipped.length}`);
  console.log(`No feed found: ${noFeed.length}`);
  if (newFeeds.length > 0) {
    console.log(`\nAppended ${newFeeds.length} new feeds to feeds.json (${existingFeeds.length} → ${existingFeeds.length + newFeeds.length} total)`)
  }
}
