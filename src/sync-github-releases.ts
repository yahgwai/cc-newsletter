import { readFileSync } from "fs";
import { syncGithubReleases } from "./sync-github-releases-lib.js";

const repos: string[] = JSON.parse(
  readFileSync("data/github-releases.json", "utf-8")
);

for (const repo of repos) {
  try {
    await syncGithubReleases(repo);
  } catch (err) {
    console.error(`failed to fetch releases for ${repo}:`, err);
  }
}
