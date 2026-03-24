import { mkdirSync, writeFileSync, existsSync } from "fs";
import { slugify, formatHeader } from "./sync-lib.js";
import { countTokens } from "./count-tokens.js";

interface GitHubRelease {
  tag_name: string;
  name: string | null;
  html_url: string;
  published_at: string | null;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
}

export async function syncGithubReleases(
  repo: string,
  baseDir = "content"
): Promise<string[]> {
  const dirSlug = repo.replace("/", "--");
  const dir = `${baseDir}/${dirSlug}`;
  mkdirSync(dir, { recursive: true });

  const written: string[] = [];
  let page = 1;

  while (true) {
    const url = `https://api.github.com/repos/${repo}/releases?per_page=30&page=${page}`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "collect-runner",
      },
    });
    if (!res.ok) throw new Error(`GitHub API returned ${res.status} for ${repo}`);

    const releases: GitHubRelease[] = await res.json();
    if (releases.length === 0) break;

    let hitExisting = false;

    for (const release of releases) {
      if (release.draft) continue;
      if (!release.body?.trim()) continue;

      const slug = slugify(release.tag_name);
      const path = `${dir}/${slug}.md`;
      const headerPath = `${dir}/${slug}-header.yaml`;

      if (existsSync(path)) {
        hitExisting = true;
        continue;
      }

      const title = release.name || release.tag_name;
      const content = `# ${title}\n\n${release.body}\n`;
      const tokens = await countTokens(content) ?? undefined;
      writeFileSync(
        headerPath,
        formatHeader({
          title,
          link: release.html_url,
          pubDate: release.published_at ?? undefined,
          tokens,
        })
      );
      writeFileSync(path, content);
      console.log(`wrote ${path}`);
      written.push(path);
    }

    // Stop paginating if we hit an existing release — older ones are already synced
    if (hitExisting) break;

    page++;
  }

  return written;
}
