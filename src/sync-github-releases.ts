import { readFileSync } from "fs";
import { syncGithubReleases as syncRepo } from "./sync-github-releases-lib.js";

export async function syncGithubReleases() {
  const repos: string[] = JSON.parse(
    readFileSync("config/github-releases.json", "utf-8")
  );

  for (const repo of repos) {
    try {
      await syncRepo(repo);
    } catch (err) {
      console.error(`failed to fetch releases for ${repo}:`, err);
    }
  }
}
