import { mkdirSync, writeFileSync, existsSync } from "fs";
import Parser from "rss-parser";
import TurndownService from "turndown";
import { countTokens } from "./count-tokens.js";

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const parser = new Parser();
const turndown = new TurndownService();

async function fetchFeed(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/xml, text/xml, */*" },
  });
  if (!res.ok) throw new Error(`Status code ${res.status}`);
  return await parser.parseString(await res.text());
}

export function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (slug.length <= 240) return slug;
  // 240 + "-header.yaml" (12) fits within the 255-byte filesystem name limit
  const truncated = slug.slice(0, 240).replace(/-[^-]*$/, "");
  return truncated || slug.slice(0, 240);
}

export function entrySlug(item: { guid?: string; id?: string; title?: string }): string {
  const rawId = item.guid ?? item.id;
  if (rawId) {
    return slugify(rawId.replace(/^https?:\/\/[^/]+/, "").replace(/#.*$/, ""));
  }
  return slugify(item.title ?? "untitled");
}

export function formatHeader(item: {
  title?: string;
  link?: string;
  pubDate?: string;
  tokens?: number;
}): string {
  const date = item.pubDate
    ? new Date(item.pubDate).toISOString()
    : "";

  const lines = [
    `title: ${JSON.stringify(item.title ?? "Untitled")}`,
    `link: ${JSON.stringify(item.link ?? "")}`,
    `date: ${JSON.stringify(date)}`,
  ];
  if (item.tokens != null) lines.push(`tokens: ${item.tokens}`);
  lines.push("");

  return lines.join("\n");
}

export function formatEntry(item: {
  title?: string;
  link?: string;
  pubDate?: string;
  "content:encoded"?: string;
  content?: string;
  summary?: string;
}): string {
  const content = turndown.turndown(
    item["content:encoded"] ?? item.content ?? item.summary ?? ""
  );

  return `# ${item.title ?? "Untitled"}\n\n${content}\n`;
}

export async function syncFeed(url: string, baseDir = "feeds"): Promise<string[]> {
  const feed = await fetchFeed(url);
  const feedSlug = slugify(new URL(url).hostname);
  const dir = `${baseDir}/${feedSlug}`;
  mkdirSync(dir, { recursive: true });

  const written: string[] = [];

  for (const item of feed.items) {
    const slug = entrySlug(item);
    const path = `${dir}/${slug}.md`;
    const headerPath = `${dir}/${slug}-header.yaml`;

    if (existsSync(path)) continue;

    const content = formatEntry(item);
    const tokens = await countTokens(content) ?? undefined;
    writeFileSync(headerPath, formatHeader({ ...item, tokens }));
    writeFileSync(path, content);
    console.log(`wrote ${path}`);
    written.push(path);
  }

  return written;
}
