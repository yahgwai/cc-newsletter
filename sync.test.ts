import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { slugify, entrySlug, formatEntry, syncFeed } from "./sync-lib.js";

describe("slugify", () => {
  it("lowercases and replaces spaces", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("replaces special characters with hyphens", () => {
    expect(slugify("foo@bar!baz")).toBe("foo-bar-baz");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("--hello--")).toBe("hello");
  });

  it("collapses consecutive hyphens", () => {
    expect(slugify("a   b___c")).toBe("a-b-c");
  });

  it("returns empty string for empty input", () => {
    expect(slugify("")).toBe("");
  });
});

describe("entrySlug", () => {
  it("uses guid when present", () => {
    expect(entrySlug({ guid: "abc-123" })).toBe("abc-123");
  });

  it("prefers guid over id", () => {
    expect(entrySlug({ guid: "from-guid", id: "from-id" })).toBe("from-guid");
  });

  it("strips protocol, host, and fragment from Atom id", () => {
    expect(entrySlug({ id: "https://example.com/2026/post#feed" })).toBe("2026-post");
  });

  it("falls back to title when no guid or id", () => {
    expect(entrySlug({ title: "My Post" })).toBe("my-post");
  });

  it("falls back to 'untitled' when nothing is available", () => {
    expect(entrySlug({})).toBe("untitled");
  });
});

describe("formatEntry", () => {
  it("formats a full entry", () => {
    const md = formatEntry({
      title: "Test Post",
      link: "https://example.com/post",
      pubDate: "2026-02-26T12:00:00Z",
      content: "<p>Hello <strong>world</strong></p>",
    });

    expect(md).toContain("# Test Post");
    expect(md).toContain("- **Link:** https://example.com/post");
    expect(md).toContain("- **Date:** 2026-02-26");
    expect(md).toContain("Hello **world**");
  });

  it("uses content:encoded over content", () => {
    const md = formatEntry({
      "content:encoded": "<p>encoded</p>",
      content: "<p>plain</p>",
    });
    expect(md).toContain("encoded");
    expect(md).not.toContain("plain");
  });

  it("falls back to summary", () => {
    const md = formatEntry({ summary: "<p>summary text</p>" });
    expect(md).toContain("summary text");
  });

  it("handles missing fields gracefully", () => {
    const md = formatEntry({});
    expect(md).toContain("# Untitled");
    expect(md).toContain("- **Link:** ");
    expect(md).toContain("- **Date:** ");
  });
});

describe("syncFeed", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "sync-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true });
    vi.restoreAllMocks();
  });

  const mockFeed = {
    title: "Test Blog",
    items: [
      {
        guid: "post-1",
        title: "First Post",
        link: "https://example.com/1",
        pubDate: "2026-01-01T00:00:00Z",
        content: "<p>Content one</p>",
      },
      {
        guid: "post-2",
        title: "Second Post",
        link: "https://example.com/2",
        pubDate: "2026-01-02T00:00:00Z",
        content: "<p>Content two</p>",
      },
    ],
  };

  function mockParser(feed: unknown) {
    const Parser = require("rss-parser");
    vi.spyOn(Parser.prototype, "parseURL").mockResolvedValue(feed);
  }

  it("writes files for each entry", async () => {
    mockParser(mockFeed);
    const written = await syncFeed("https://example.com/feed.xml", tmpDir);

    expect(written).toHaveLength(2);
    expect(existsSync(join(tmpDir, "example-com", "post-1.md"))).toBe(true);
    expect(existsSync(join(tmpDir, "example-com", "post-2.md"))).toBe(true);

    const content = readFileSync(join(tmpDir, "example-com", "post-1.md"), "utf-8");
    expect(content).toContain("# First Post");
    expect(content).toContain("Content one");
  });

  it("skips existing files (deduplication)", async () => {
    mockParser(mockFeed);

    const first = await syncFeed("https://example.com/feed.xml", tmpDir);
    expect(first).toHaveLength(2);

    const second = await syncFeed("https://example.com/feed.xml", tmpDir);
    expect(second).toHaveLength(0);
  });

  it("re-creates deleted files", async () => {
    mockParser(mockFeed);

    await syncFeed("https://example.com/feed.xml", tmpDir);
    rmSync(join(tmpDir, "example-com", "post-1.md"));

    const written = await syncFeed("https://example.com/feed.xml", tmpDir);
    expect(written).toHaveLength(1);
    expect(written[0]).toContain("post-1.md");
  });

  it("handles entries with only summary", async () => {
    mockParser({
      title: "Summary Blog",
      items: [{ guid: "s1", summary: "<p>Just a summary</p>" }],
    });

    await syncFeed("https://example.com/feed.xml", tmpDir);
    const content = readFileSync(join(tmpDir, "example-com", "s1.md"), "utf-8");
    expect(content).toContain("Just a summary");
  });

  it("handles entries with no content", async () => {
    mockParser({
      title: "Empty Blog",
      items: [{ guid: "e1", title: "Empty" }],
    });

    await syncFeed("https://example.com/feed.xml", tmpDir);
    const content = readFileSync(join(tmpDir, "example-com", "e1.md"), "utf-8");
    expect(content).toContain("# Empty");
  });
});

describe("error isolation", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "sync-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true });
    vi.restoreAllMocks();
  });

  it("one failing feed does not block others", async () => {
    const Parser = require("rss-parser");
    let callCount = 0;
    vi.spyOn(Parser.prototype, "parseURL").mockImplementation(async (url: string) => {
      callCount++;
      if (url === "https://bad.com/feed.xml") throw new Error("network error");
      return {
        title: "Good Blog",
        items: [{ guid: "g1", title: "Good Post", content: "<p>ok</p>" }],
      };
    });

    // Simulate what sync.ts does: try/catch per feed
    const urls = ["https://bad.com/feed.xml", "https://good.com/feed.xml"];
    for (const url of urls) {
      try {
        await syncFeed(url, tmpDir);
      } catch {
        // logged and continued
      }
    }

    expect(callCount).toBe(2);
    expect(existsSync(join(tmpDir, "good-com", "g1.md"))).toBe(true);
  });
});
