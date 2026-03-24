import { readFileSync } from "fs";
import { syncFeed } from "./sync-lib.js";

export async function syncRss() {
  const feeds: string[] = JSON.parse(readFileSync("config/feeds.json", "utf-8"));

  for (const url of feeds) {
    try {
      await syncFeed(url);
    } catch (err) {
      console.error(`failed to fetch ${url}:`, err);
    }
  }
}
