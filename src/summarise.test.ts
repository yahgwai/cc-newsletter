import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  findUnprocessedArticles,
  hasContent,
  buildBatches,
  buildUserPrompt,
  writeResults,
  type Article,
} from "./summarise.js";

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    headerPath: "/tmp/test-header.yaml",
    contentPath: "/tmp/test.md",
    slug: "source/article",
    content: "Some content here",
    estimatedTokens: 5,
    ...overrides,
  };
}

describe("findUnprocessedArticles", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "summarise-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true });
  });

  it("finds articles with headers missing summary", () => {
    const sourceDir = join(tmpDir, "test-blog");
    mkdirSync(sourceDir, { recursive: true });

    writeFileSync(join(sourceDir, "post-1-header.yaml"), 'title: "Post 1"\nlink: "https://example.com"\n');
    writeFileSync(join(sourceDir, "post-1.md"), "# Post 1\nSome content");

    const articles = findUnprocessedArticles(tmpDir);
    expect(articles).toHaveLength(1);
    expect(articles[0].slug).toBe("test-blog/post-1");
    expect(articles[0].content).toContain("Some content");
  });

  it("skips articles that already have a summary", () => {
    const sourceDir = join(tmpDir, "test-blog");
    mkdirSync(sourceDir, { recursive: true });

    writeFileSync(
      join(sourceDir, "post-1-header.yaml"),
      'title: "Post 1"\nsummary: "Already summarised"\n'
    );
    writeFileSync(join(sourceDir, "post-1.md"), "# Post 1\nContent");

    const articles = findUnprocessedArticles(tmpDir);
    expect(articles).toHaveLength(0);
  });

  it("skips headers where summary is the first line", () => {
    const sourceDir = join(tmpDir, "test-blog");
    mkdirSync(sourceDir, { recursive: true });

    writeFileSync(join(sourceDir, "post-1-header.yaml"), 'summary: "First line"\ntitle: "Post 1"\n');
    writeFileSync(join(sourceDir, "post-1.md"), "Content");

    const articles = findUnprocessedArticles(tmpDir);
    expect(articles).toHaveLength(0);
  });

  it("skips headers with no matching content file", () => {
    const sourceDir = join(tmpDir, "test-blog");
    mkdirSync(sourceDir, { recursive: true });

    writeFileSync(join(sourceDir, "post-1-header.yaml"), 'title: "Post 1"\n');

    const articles = findUnprocessedArticles(tmpDir);
    expect(articles).toHaveLength(0);
  });

  it("estimates tokens from content length", () => {
    const sourceDir = join(tmpDir, "test-blog");
    mkdirSync(sourceDir, { recursive: true });

    writeFileSync(join(sourceDir, "post-1-header.yaml"), 'title: "Post 1"\n');
    writeFileSync(join(sourceDir, "post-1.md"), "a".repeat(400));

    const articles = findUnprocessedArticles(tmpDir);
    expect(articles[0].estimatedTokens).toBe(200);
  });

  it("returns empty array for non-existent directory", () => {
    const articles = findUnprocessedArticles("/tmp/does-not-exist-xyz");
    expect(articles).toHaveLength(0);
  });

  it("scans multiple source directories", () => {
    for (const source of ["blog-a", "blog-b"]) {
      const dir = join(tmpDir, source);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "post-1-header.yaml"), 'title: "Post"\n');
      writeFileSync(join(dir, "post-1.md"), "Content");
    }

    const articles = findUnprocessedArticles(tmpDir);
    expect(articles).toHaveLength(2);
    const slugs = articles.map((a) => a.slug).sort();
    expect(slugs).toEqual(["blog-a/post-1", "blog-b/post-1"]);
  });

  it("strips link and date metadata from content", () => {
    const sourceDir = join(tmpDir, "test-blog");
    mkdirSync(sourceDir, { recursive: true });

    writeFileSync(join(sourceDir, "post-1-header.yaml"), 'title: "Post 1"\n');
    writeFileSync(join(sourceDir, "post-1.md"), '# Post 1\n\n- **Link:** https://example.com\n- **Date:** 2026-01-01\n\nActual content');

    const articles = findUnprocessedArticles(tmpDir);
    expect(articles[0].content).not.toContain("**Link:**");
    expect(articles[0].content).not.toContain("**Date:**");
    expect(articles[0].content).toContain("Actual content");
  });
});

describe("hasContent", () => {
  it("returns true for article with body text", () => {
    expect(hasContent("# Title\n\nSome actual content here")).toBe(true);
  });

  it("returns false for just a heading", () => {
    expect(hasContent("# Title\n\n")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(hasContent("")).toBe(false);
  });

  it("returns false for heading and whitespace only", () => {
    expect(hasContent("# Title\n\n  \n\n")).toBe(false);
  });

  it("returns true even for short body text", () => {
    expect(hasContent("# Title\n\nOk")).toBe(true);
  });
});

describe("buildBatches", () => {
  it("groups articles within token limit", () => {
    const articles = [
      makeArticle({ slug: "a/1", estimatedTokens: 30_000 }),
      makeArticle({ slug: "a/2", estimatedTokens: 30_000 }),
      makeArticle({ slug: "a/3", estimatedTokens: 30_000 }),
    ];

    const batches = buildBatches(articles);
    expect(batches).toHaveLength(2);
    expect(batches[0]).toHaveLength(2);
    expect(batches[1]).toHaveLength(1);
  });

  it("groups articles within count limit", () => {
    const articles = Array.from({ length: 25 }, (_, i) =>
      makeArticle({ slug: `a/${i}`, estimatedTokens: 100 })
    );

    const batches = buildBatches(articles);
    expect(batches).toHaveLength(2);
    expect(batches[0]).toHaveLength(20);
    expect(batches[1]).toHaveLength(5);
  });

  it("puts oversized article in its own batch", () => {
    const articles = [
      makeArticle({ slug: "a/1", estimatedTokens: 1000 }),
      makeArticle({ slug: "a/big", estimatedTokens: 100_000 }),
      makeArticle({ slug: "a/2", estimatedTokens: 1000 }),
    ];

    const batches = buildBatches(articles);
    expect(batches).toHaveLength(3);
    expect(batches[0]).toHaveLength(1);
    expect(batches[0][0].slug).toBe("a/1");
    expect(batches[1]).toHaveLength(1);
    expect(batches[1][0].slug).toBe("a/big");
    expect(batches[2]).toHaveLength(1);
    expect(batches[2][0].slug).toBe("a/2");
  });

  it("returns empty array for empty input", () => {
    expect(buildBatches([])).toEqual([]);
  });

  it("puts single article in one batch", () => {
    const batches = buildBatches([makeArticle()]);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(1);
  });
});

describe("buildUserPrompt", () => {
  it("delimits articles with slug headers", () => {
    const articles = [
      makeArticle({ slug: "blog-a/post-1", content: "Content one" }),
      makeArticle({ slug: "blog-b/post-2", content: "Content two" }),
    ];

    const prompt = buildUserPrompt(articles);
    expect(prompt).toContain("=== ARTICLE: blog-a/post-1 ===");
    expect(prompt).toContain("Content one");
    expect(prompt).toContain("=== ARTICLE: blog-b/post-2 ===");
    expect(prompt).toContain("Content two");
  });

  it("separates articles with blank lines", () => {
    const articles = [
      makeArticle({ slug: "a/1", content: "One" }),
      makeArticle({ slug: "a/2", content: "Two" }),
    ];

    const prompt = buildUserPrompt(articles);
    expect(prompt).toContain("One\n\n=== ARTICLE: a/2 ===");
  });
});

describe("writeResults", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "summarise-write-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true });
  });

  it("appends summary and mentions to header file", () => {
    const headerPath = join(tmpDir, "post-header.yaml");
    writeFileSync(headerPath, 'title: "Test Post"\nlink: "https://example.com"\n');

    const batch = [makeArticle({ headerPath, slug: "test/post" })];
    const results = [
      { filename: "test/post", summary: "A test summary.", mentions: ["Foo", "Bar"] },
    ];

    const { written, skipped } = writeResults(batch, results);
    expect(written).toBe(1);
    expect(skipped).toBe(0);

    const content = readFileSync(headerPath, "utf-8");
    expect(content).toContain('summary: "A test summary."');
    expect(content).toContain('mentions: ["Foo","Bar"]');
    expect(content).toContain('title: "Test Post"');
  });

  it("preserves existing header content", () => {
    const headerPath = join(tmpDir, "post-header.yaml");
    writeFileSync(headerPath, 'title: "Existing"\nlink: "https://x.com"\ndate: "2026-01-01"\n');

    const batch = [makeArticle({ headerPath, slug: "test/post" })];
    const results = [{ filename: "test/post", summary: "Sum.", mentions: [] }];

    writeResults(batch, results);

    const content = readFileSync(headerPath, "utf-8");
    expect(content.startsWith('title: "Existing"')).toBe(true);
    expect(content).toContain('link: "https://x.com"');
    expect(content).toContain('date: "2026-01-01"');
    expect(content).toContain('summary: "Sum."');
  });

  it("reports skipped when result is missing for an article", () => {
    const headerPath = join(tmpDir, "post-header.yaml");
    writeFileSync(headerPath, 'title: "Test"\n');

    const batch = [makeArticle({ headerPath, slug: "test/missing" })];
    const results: SummaryResult[] = [];

    const { written, skipped } = writeResults(batch, results);
    expect(written).toBe(0);
    expect(skipped).toBe(1);

    const content = readFileSync(headerPath, "utf-8");
    expect(content).toBe('title: "Test"\n');
  });

  it("handles summary with special characters", () => {
    const headerPath = join(tmpDir, "post-header.yaml");
    writeFileSync(headerPath, 'title: "Test"\n');

    const batch = [makeArticle({ headerPath, slug: "test/post" })];
    const results = [
      { filename: "test/post", summary: 'A "quoted" summary with\nnewlines', mentions: ["O'Reilly"] },
    ];

    writeResults(batch, results);

    const content = readFileSync(headerPath, "utf-8");
    expect(content).toContain("summary: ");
    expect(content).toContain("mentions: ");
  });
});
