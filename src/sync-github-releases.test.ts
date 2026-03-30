import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { syncGithubReleases } from "./sync-github-releases-lib.js";

function makeRelease(overrides: Record<string, unknown> = {}) {
  return {
    tag_name: "v1.0.0",
    name: "Release 1.0.0",
    html_url: "https://github.com/owner/repo/releases/tag/v1.0.0",
    published_at: "2026-03-01T12:00:00Z",
    body: "## What's new\n\n- Feature A\n- Feature B\n",
    draft: false,
    prerelease: false,
    ...overrides,
  };
}

describe("syncGithubReleases", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "gh-releases-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true });
    vi.restoreAllMocks();
  });

  function mockFetch(pages: Record<number, unknown[]>) {
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      const pageMatch = url.match(/[?&]page=(\d+)/);
      const page = pageMatch ? Number(pageMatch[1]) : 1;
      const data = pages[page] ?? [];
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
  }

  it("writes header and content files for each release", async () => {
    const releases = [
      makeRelease({ tag_name: "v2.0.0", name: "Release 2.0.0" }),
      makeRelease({ tag_name: "v1.0.0", name: "Release 1.0.0" }),
    ];
    mockFetch({ 1: releases, 2: [] });

    const written = await syncGithubReleases("owner/repo", tmpDir);

    expect(written).toHaveLength(2);

    const header = readFileSync(join(tmpDir, "owner--repo", "v2-0-0-header.yaml"), "utf-8");
    expect(header).toContain('title: "Release 2.0.0"');
    expect(header).toContain('"https://github.com/owner/repo/releases/tag/v1.0.0"');
    expect(header).toContain('date: "2026-03-01T12:00:00.000Z"');

    const content = readFileSync(join(tmpDir, "owner--repo", "v2-0-0.md"), "utf-8");
    expect(content).toContain("# Release 2.0.0");
    expect(content).toContain("- Feature A");
  });

  it("skips existing files (deduplication)", async () => {
    mockFetch({ 1: [makeRelease()], 2: [] });

    const first = await syncGithubReleases("owner/repo", tmpDir);
    expect(first).toHaveLength(1);

    const second = await syncGithubReleases("owner/repo", tmpDir);
    expect(second).toHaveLength(0);
  });

  it("skips releases with empty body", async () => {
    mockFetch({
      1: [
        makeRelease({ tag_name: "v2.0.0", body: "" }),
        makeRelease({ tag_name: "v1.0.0", body: null }),
        makeRelease({ tag_name: "v0.9.0", body: "Real content" }),
      ],
      2: [],
    });

    const written = await syncGithubReleases("owner/repo", tmpDir);
    expect(written).toHaveLength(1);
    expect(written[0]).toContain("v0-9-0.md");
  });

  it("skips draft releases", async () => {
    mockFetch({
      1: [makeRelease({ tag_name: "v2.0.0", draft: true })],
      2: [],
    });

    const written = await syncGithubReleases("owner/repo", tmpDir);
    expect(written).toHaveLength(0);
  });

  it("stops paginating when hitting an existing release", async () => {
    // Pre-create v1.0.0 so it looks like it was already synced
    const dir = join(tmpDir, "owner--repo");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "v1-0-0.md"), "existing");

    mockFetch({
      1: [
        makeRelease({ tag_name: "v2.0.0", name: "Release 2.0.0" }),
        makeRelease({ tag_name: "v1.0.0", name: "Release 1.0.0" }),
      ],
      2: [makeRelease({ tag_name: "v0.9.0", name: "Release 0.9.0" })],
    });

    const written = await syncGithubReleases("owner/repo", tmpDir);

    // Should write v2.0.0 but stop before page 2
    expect(written).toHaveLength(1);
    expect(written[0]).toContain("v2-0-0.md");
    expect(existsSync(join(dir, "v0-9-0.md"))).toBe(false);
  });

  it("uses tag_name as title when name is null", async () => {
    mockFetch({
      1: [makeRelease({ tag_name: "v3.0.0", name: null })],
      2: [],
    });

    await syncGithubReleases("owner/repo", tmpDir);

    const header = readFileSync(join(tmpDir, "owner--repo", "v3-0-0-header.yaml"), "utf-8");
    expect(header).toContain('title: "v3.0.0"');

    const content = readFileSync(join(tmpDir, "owner--repo", "v3-0-0.md"), "utf-8");
    expect(content).toContain("# v3.0.0");
  });

  it("throws on API error", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("", { status: 403 })
    );

    await expect(syncGithubReleases("owner/repo", tmpDir)).rejects.toThrow(
      "GitHub API returned 403"
    );
  });
});
