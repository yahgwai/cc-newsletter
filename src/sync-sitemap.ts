import { readFileSync } from "fs";
import { syncSitemap } from "./sync-sitemap-lib.js";

export async function syncSitemaps() {
  const sitemaps: string[] = JSON.parse(readFileSync("sitemaps.json", "utf-8"));

  for (const url of sitemaps) {
    try {
      await syncSitemap(url);
    } catch (err) {
      console.error(`failed to sync sitemap ${url}:`, err);
    }
  }
}
