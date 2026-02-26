import { mkdirSync, writeFileSync, existsSync } from "fs";
import Parser from "rss-parser";
import TurndownService from "turndown";

const parser = new Parser();
const turndown = new TurndownService();

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function entrySlug(item: { guid?: string; id?: string; title?: string }): string {
  const rawId = item.guid ?? item.id;
  if (rawId) {
    return slugify(rawId.replace(/^https?:\/\/[^/]+/, "").replace(/#.*$/, ""));
  }
  return slugify(item.title ?? "untitled");
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
  const date = item.pubDate
    ? new Date(item.pubDate).toISOString().split("T")[0]
    : "";

  return [
    `# ${item.title ?? "Untitled"}`,
    "",
    `- **Link:** ${item.link ?? ""}`,
    `- **Date:** ${date}`,
    "",
    content,
    "",
  ].join("\n");
}

export async function syncFeed(url: string, baseDir = "feeds"): Promise<string[]> {
  const feed = await parser.parseURL(url);
  const feedSlug = slugify(new URL(url).hostname);
  const dir = `${baseDir}/${feedSlug}`;
  mkdirSync(dir, { recursive: true });

  const written: string[] = [];

  for (const item of feed.items) {
    const slug = entrySlug(item);
    const path = `${dir}/${slug}.md`;

    if (existsSync(path)) continue;

    writeFileSync(path, formatEntry(item));
    console.log(`wrote ${path}`);
    written.push(path);
  }

  return written;
}
