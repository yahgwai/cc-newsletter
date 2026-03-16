import { mkdirSync, writeFileSync, existsSync, readFileSync, statSync } from "fs";
import TurndownService from "turndown";
import { slugify, formatHeader } from "./sync-lib.js";
import { countTokens } from "./count-tokens.js";

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const turndown = new TurndownService();

const CONCURRENCY = 5;

const LOCALE_SEGMENT = /^[a-z]{2}(-[a-z]{2,4})?$/;

// 6 days in milliseconds
const STALE_MS = 6 * 24 * 60 * 60 * 1000;

interface SitemapEntry {
  loc: string;
  lastmod: string | null;
}

export function parseSitemap(xml: string): SitemapEntry[] {
  const entries: SitemapEntry[] = [];
  const urlRegex = /<url>([\s\S]*?)<\/url>/g;
  let match;
  while ((match = urlRegex.exec(xml)) !== null) {
    const block = match[1];
    const locMatch = block.match(/<loc>([^<]+)<\/loc>/);
    if (!locMatch) continue;
    const lastmodMatch = block.match(/<lastmod>([^<]+)<\/lastmod>/);
    entries.push({
      loc: locMatch[1].trim(),
      lastmod: lastmodMatch ? lastmodMatch[1].trim() : null,
    });
  }
  return entries;
}

// Drop non-English locale variants by checking the sitemap as a whole.
// A URL is a locale variant if it has a short path segment (like "de", "zh-tw")
// where swapping it for "en", removing it, or swapping it for any other locale-like
// segment in the sitemap all yield matches — proving the segment is a locale, not content.
export function filterToEnglish(entries: SitemapEntry[]): SitemapEntry[] {
  const urlSet = new Set(entries.map((e) => e.loc.replace(/\/$/, "")));

  // Build a set of "canonical paths" by replacing each locale-like segment with a
  // placeholder. If two URLs produce the same canonical path, the segment is a locale.
  const localePositions = new Map<string, Set<string>>();
  for (const e of entries) {
    const url = new URL(e.loc);
    const segments = url.pathname.split("/").filter(Boolean);
    for (let i = 0; i < segments.length; i++) {
      if (!LOCALE_SEGMENT.test(segments[i].toLowerCase())) continue;
      const canonical = [...segments];
      canonical[i] = "{}";
      const key = `${url.origin}/${canonical.join("/")}`;
      let set = localePositions.get(key);
      if (!set) { set = new Set(); localePositions.set(key, set); }
      set.add(segments[i].toLowerCase());
    }
  }

  // A canonical path with 2+ locale-like segments confirms those segments are locales
  const confirmedLocale = new Set<string>();
  for (const [key, locales] of localePositions) {
    if (locales.size >= 2) {
      confirmedLocale.add(key);
    }
  }

  return entries.filter((e) => {
    const url = new URL(e.loc);
    const segments = url.pathname.split("/").filter(Boolean);

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i].toLowerCase();
      if (seg === "en" || !LOCALE_SEGMENT.test(seg)) continue;

      // Check if swapping for "en" or removing the segment matches another URL
      const enSegments = [...segments];
      enSegments[i] = "en";
      if (urlSet.has(`${url.origin}/${enSegments.join("/")}`)) return false;

      const stripped = segments.filter((_, j) => j !== i);
      if (urlSet.has(`${url.origin}/${stripped.join("/")}`)) return false;

      // Check if this position is a confirmed locale slot (2+ languages share the path)
      const canonical = [...segments];
      canonical[i] = "{}";
      if (confirmedLocale.has(`${url.origin}/${canonical.join("/")}`)) return false;
    }
    return true;
  });
}

export function slugFromUrl(url: string): string {
  const path = new URL(url).pathname.replace(/^\/|\/$/g, "");
  return slugify(path || "index");
}

export function extractContent(html: string): { title: string; content: string } {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "Untitled";

  // Try <article>, then <main>, then <body>
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) return { title, content: turndown.turndown(articleMatch[1]) };

  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) return { title, content: turndown.turndown(mainMatch[1]) };

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) return { title, content: turndown.turndown(bodyMatch[1]) };

  return { title, content: turndown.turndown(html) };
}

function shouldRefetch(entry: SitemapEntry, mdPath: string, headerPath: string): boolean {
  if (!existsSync(mdPath)) return true;

  if (entry.lastmod) {
    if (!existsSync(headerPath)) return true;
    const header = readFileSync(headerPath, "utf-8");
    const dateMatch = header.match(/^date:\s*"([^"]+)"/m);
    if (!dateMatch) return true;
    return new Date(entry.lastmod).getTime() > new Date(dateMatch[1]).getTime();
  }

  // No lastmod — re-fetch if file is older than 6 days
  const mtime = statSync(mdPath).mtimeMs;
  return Date.now() - mtime > STALE_MS;
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) throw new Error(`Status ${res.status} fetching ${url}`);
  return await res.text();
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  let i = 0;
  async function next(): Promise<void> {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => next());
  await Promise.all(workers);
}

export async function syncSitemap(
  sitemapUrl: string,
  baseDir = "feeds"
): Promise<string[]> {
  const res = await fetch(sitemapUrl, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) throw new Error(`Status ${res.status} fetching sitemap ${sitemapUrl}`);
  const xml = await res.text();

  const entries = filterToEnglish(parseSitemap(xml));

  const domainSlug = slugify(new URL(sitemapUrl).hostname);
  const dir = `${baseDir}/${domainSlug}`;
  mkdirSync(dir, { recursive: true });

  const written: string[] = [];

  await runWithConcurrency(entries, CONCURRENCY, async (entry) => {
    const slug = slugFromUrl(entry.loc);
    const mdPath = `${dir}/${slug}.md`;
    const headerPath = `${dir}/${slug}-header.yaml`;

    if (!shouldRefetch(entry, mdPath, headerPath)) return;

    let html: string;
    try {
      html = await fetchPage(entry.loc);
    } catch (err) {
      console.error(`failed to fetch ${entry.loc}:`, err);
      return;
    }

    const { title, content } = extractContent(html);

    const mdContent = `# ${title}\n\n${content}\n`;
    const tokens = await countTokens(mdContent) ?? undefined;
    const date = entry.lastmod ?? new Date().toISOString();
    writeFileSync(headerPath, formatHeader({ title, link: entry.loc, pubDate: date, tokens }));
    writeFileSync(mdPath, mdContent);
    console.log(`wrote ${mdPath}`);
    written.push(mdPath);
  });

  return written;
}
