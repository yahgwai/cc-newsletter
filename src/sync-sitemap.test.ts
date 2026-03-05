import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync, utimesSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { parseSitemap, filterToEnglish, slugFromUrl, extractContent, syncSitemap } from "./sync-sitemap-lib.js";

const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.example.com/news/hello-world</loc>
    <lastmod>2026-03-01T00:00:00Z</lastmod>
  </url>
  <url>
    <loc>https://www.example.com/research/paper</loc>
  </url>
</urlset>`;

const PAGE_HTML = `<!doctype html>
<html>
<head><title>Hello World</title></head>
<body>
<article><h2>Intro</h2><p>Some content here.</p></article>
</body>
</html>`;

describe("parseSitemap", () => {
  it("extracts loc and lastmod from sitemap XML", () => {
    const entries = parseSitemap(SITEMAP_XML);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      loc: "https://www.example.com/news/hello-world",
      lastmod: "2026-03-01T00:00:00Z",
    });
    expect(entries[1]).toEqual({
      loc: "https://www.example.com/research/paper",
      lastmod: null,
    });
  });

  it("returns empty array for empty sitemap", () => {
    expect(parseSitemap("<urlset></urlset>")).toEqual([]);
  });

  it("skips url entries without loc", () => {
    const xml = `<urlset><url><lastmod>2026-01-01</lastmod></url></urlset>`;
    expect(parseSitemap(xml)).toEqual([]);
  });
});

describe("filterToEnglish", () => {
  function entries(...urls: string[]) {
    return urls.map((loc) => ({ loc, lastmod: null }));
  }
  function urls(result: { loc: string }[]) {
    return result.map((e) => e.loc);
  }

  it("keeps URLs with no locale segment", () => {
    const input = entries(
      "https://www.anthropic.com/news/hello",
      "https://www.anthropic.com/research/paper"
    );
    expect(urls(filterToEnglish(input))).toEqual([
      "https://www.anthropic.com/news/hello",
      "https://www.anthropic.com/research/paper",
    ]);
  });

  it("drops locale variants when no-locale sibling exists", () => {
    const input = entries(
      "https://www.anthropic.com/news/hello",
      "https://www.anthropic.com/de/news/hello",
      "https://www.anthropic.com/ja/news/hello"
    );
    expect(urls(filterToEnglish(input))).toEqual([
      "https://www.anthropic.com/news/hello",
    ]);
  });

  it("drops locale variants when /en/ sibling exists", () => {
    const input = entries(
      "https://code.claude.com/docs/en/hooks",
      "https://code.claude.com/docs/id/hooks",
      "https://code.claude.com/docs/zh-tw/hooks",
      "https://code.claude.com/docs/zh-cn/hooks"
    );
    expect(urls(filterToEnglish(input))).toEqual([
      "https://code.claude.com/docs/en/hooks",
    ]);
  });

  it("drops locale variants even when no /en/ version exists", () => {
    const input = entries(
      "https://platform.claude.com/docs/de/prompt/be-clear",
      "https://platform.claude.com/docs/es/prompt/be-clear",
      "https://platform.claude.com/docs/ja/prompt/be-clear"
    );
    expect(urls(filterToEnglish(input))).toEqual([]);
  });

  it("keeps URLs where short segment has no English sibling", () => {
    const input = entries(
      "https://example.com/docs/ai/overview"
    );
    expect(urls(filterToEnglish(input))).toEqual([
      "https://example.com/docs/ai/overview",
    ]);
  });
});

describe("slugFromUrl", () => {
  it("derives slug from URL path", () => {
    expect(slugFromUrl("https://www.anthropic.com/news/anthropic-acquires-bun")).toBe(
      "news-anthropic-acquires-bun"
    );
  });

  it("uses 'index' for root path", () => {
    expect(slugFromUrl("https://www.anthropic.com/")).toBe("index");
  });
});

describe("extractContent", () => {
  it("extracts title and article content", () => {
    const { title, content } = extractContent(PAGE_HTML);
    expect(title).toBe("Hello World");
    expect(content).toContain("Some content here.");
  });

  it("falls back to main when no article", () => {
    const html = `<html><head><title>Test</title></head><body><main><p>Main content</p></main></body></html>`;
    const { title, content } = extractContent(html);
    expect(title).toBe("Test");
    expect(content).toContain("Main content");
  });

  it("falls back to body when no article or main", () => {
    const html = `<html><head><title>Test</title></head><body><p>Body content</p></body></html>`;
    const { content } = extractContent(html);
    expect(content).toContain("Body content");
  });

  it("uses 'Untitled' when no title tag", () => {
    const html = `<html><body><p>No title</p></body></html>`;
    const { title } = extractContent(html);
    expect(title).toBe("Untitled");
  });
});

describe("syncSitemap", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "sitemap-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true });
    vi.restoreAllMocks();
  });

  function mockFetch(responses: Record<string, { status: number; body: string }>) {
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      const resp = responses[url];
      if (!resp) return new Response("Not Found", { status: 404 });
      return new Response(resp.body, {
        status: resp.status,
        headers: { "Content-Type": "text/html" },
      });
    });
  }

  it("writes header and content files for sitemap entries", async () => {
    mockFetch({
      "https://www.example.com/sitemap.xml": {
        status: 200,
        body: SITEMAP_XML,
      },
      "https://www.example.com/news/hello-world": {
        status: 200,
        body: PAGE_HTML,
      },
      "https://www.example.com/research/paper": {
        status: 200,
        body: `<html><head><title>Paper</title></head><body><article><p>Research</p></article></body></html>`,
      },
    });

    const written = await syncSitemap("https://www.example.com/sitemap.xml", tmpDir);

    expect(written).toHaveLength(2);

    const header = readFileSync(join(tmpDir, "www-example-com", "news-hello-world-header.yaml"), "utf-8");
    expect(header).toContain('title: "Hello World"');
    expect(header).toContain('"https://www.example.com/news/hello-world"');
    expect(header).toContain('date: "2026-03-01T00:00:00.000Z"');

    const content = readFileSync(join(tmpDir, "www-example-com", "news-hello-world.md"), "utf-8");
    expect(content).toContain("# Hello World");
    expect(content).toContain("Some content here.");
  });

  it("skips existing files when lastmod has not changed", async () => {
    mockFetch({
      "https://www.example.com/sitemap.xml": {
        status: 200,
        body: SITEMAP_XML,
      },
      "https://www.example.com/news/hello-world": {
        status: 200,
        body: PAGE_HTML,
      },
      "https://www.example.com/research/paper": {
        status: 200,
        body: `<html><head><title>Paper</title></head><body><article><p>Research</p></article></body></html>`,
      },
    });

    await syncSitemap("https://www.example.com/sitemap.xml", tmpDir);
    const written = await syncSitemap("https://www.example.com/sitemap.xml", tmpDir);

    // Entry with lastmod: date hasn't changed, should skip
    // Entry without lastmod: file is fresh (just written), should skip
    expect(written).toHaveLength(0);
  });

  it("re-fetches when lastmod is newer than stored date", async () => {
    const dir = join(tmpDir, "www-example-com");
    mkdirSync(dir, { recursive: true });

    // Pre-create with an older date
    writeFileSync(join(dir, "news-hello-world-header.yaml"),
      'title: "Hello World"\nlink: "https://www.example.com/news/hello-world"\ndate: "2026-02-01T00:00:00.000Z"\n');
    writeFileSync(join(dir, "news-hello-world.md"), "# old content\n");

    // Sitemap has lastmod 2026-03-01 which is newer than stored 2026-02-01
    const sitemapWithLastmod = `<urlset>
      <url><loc>https://www.example.com/news/hello-world</loc><lastmod>2026-03-01T00:00:00Z</lastmod></url>
    </urlset>`;

    mockFetch({
      "https://www.example.com/sitemap.xml": { status: 200, body: sitemapWithLastmod },
      "https://www.example.com/news/hello-world": { status: 200, body: PAGE_HTML },
    });

    const written = await syncSitemap("https://www.example.com/sitemap.xml", tmpDir);
    expect(written).toHaveLength(1);

    const content = readFileSync(join(dir, "news-hello-world.md"), "utf-8");
    expect(content).toContain("Some content here.");
  });

  it("re-fetches when file mtime is stale and no lastmod", async () => {
    const dir = join(tmpDir, "www-example-com");
    mkdirSync(dir, { recursive: true });

    const mdPath = join(dir, "research-paper.md");
    writeFileSync(mdPath, "# old\n");
    // Set mtime to 7 days ago
    const staleTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    utimesSync(mdPath, staleTime, staleTime);

    const sitemapNoLastmod = `<urlset>
      <url><loc>https://www.example.com/research/paper</loc></url>
    </urlset>`;

    mockFetch({
      "https://www.example.com/sitemap.xml": { status: 200, body: sitemapNoLastmod },
      "https://www.example.com/research/paper": {
        status: 200,
        body: `<html><head><title>Paper</title></head><body><article><p>Fresh content</p></article></body></html>`,
      },
    });

    const written = await syncSitemap("https://www.example.com/sitemap.xml", tmpDir);
    expect(written).toHaveLength(1);

    const content = readFileSync(mdPath, "utf-8");
    expect(content).toContain("Fresh content");
  });

  it("filters out non-English URLs", async () => {
    const sitemap = `<urlset>
      <url><loc>https://www.example.com/news/hello</loc></url>
      <url><loc>https://www.example.com/de/news/hello</loc></url>
      <url><loc>https://www.example.com/ja/news/hello</loc></url>
    </urlset>`;

    mockFetch({
      "https://www.example.com/sitemap.xml": { status: 200, body: sitemap },
      "https://www.example.com/news/hello": {
        status: 200,
        body: `<html><head><title>Hello</title></head><body><p>English</p></body></html>`,
      },
    });

    const written = await syncSitemap("https://www.example.com/sitemap.xml", tmpDir);
    expect(written).toHaveLength(1);

    // Non-English files should not exist
    expect(existsSync(join(tmpDir, "www-example-com", "de-news-hello.md"))).toBe(false);
    expect(existsSync(join(tmpDir, "www-example-com", "ja-news-hello.md"))).toBe(false);
  });

  it("skips pages that fail to fetch without crashing", async () => {
    const sitemap = `<urlset>
      <url><loc>https://www.example.com/good</loc></url>
      <url><loc>https://www.example.com/bad</loc></url>
    </urlset>`;

    mockFetch({
      "https://www.example.com/sitemap.xml": { status: 200, body: sitemap },
      "https://www.example.com/good": {
        status: 200,
        body: `<html><head><title>Good</title></head><body><p>OK</p></body></html>`,
      },
      "https://www.example.com/bad": { status: 500, body: "error" },
    });

    const written = await syncSitemap("https://www.example.com/sitemap.xml", tmpDir);
    expect(written).toHaveLength(1);
    expect(written[0]).toContain("good.md");
  });

  it("throws when sitemap fetch fails", async () => {
    mockFetch({
      "https://www.example.com/sitemap.xml": { status: 500, body: "error" },
    });

    await expect(syncSitemap("https://www.example.com/sitemap.xml", tmpDir)).rejects.toThrow(
      "Status 500 fetching sitemap"
    );
  });
});
