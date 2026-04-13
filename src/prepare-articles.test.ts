import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  readdirSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { prepare } from "./prepare-articles.js";

// prepare() reads article bodies via FEEDS_DIR (= "content"), which is a CWD-relative
// path. Tests switch CWD into a temp directory that contains a fake content/ tree.
describe("prepare", () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = mkdtempSync(join(tmpdir(), "prepare-test-"));
    mkdirSync(join(tmpDir, "content"), { recursive: true });
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true });
    vi.restoreAllMocks();
  });

  // Create a fake article on disk: content/<source>/<slug>.md (+ -header.yaml).
  // Returns the header path that prepare() expects in its evaluations input.
  function addArticle(source: string, slug: string, body: string): string {
    const dir = join("content", source);
    mkdirSync(dir, { recursive: true });
    const headerPath = `${source}/${slug}-header.yaml`;
    writeFileSync(join("content", headerPath), `title: "${slug}"\n`);
    writeFileSync(join(dir, `${slug}.md`), body);
    return headerPath;
  }

  function writeEvaluations(blocks: string[]): string {
    const evalPath = join(tmpDir, "evaluations.md");
    writeFileSync(evalPath, blocks.join("\n---\n\n"));
    return evalPath;
  }

  function bigBody(): string {
    // Push total words above AFFINITY_THRESHOLD (50_000) on a single article.
    return "word ".repeat(60_000);
  }

  it("groups articles by numeric section", () => {
    const a = addArticle("blog-a", "post-1", bigBody());
    const b = addArticle("blog-a", "post-2", "hello world");
    const c = addArticle("blog-b", "post-3", "another article");

    const evalPath = writeEvaluations([
      `## Header: ${a}\n**Decision:** INCLUDE\n**Section:** 2\n**Summary:** s`,
      `## Header: ${b}\n**Decision:** INCLUDE\n**Section:** 5\n**Summary:** s`,
      `## Header: ${c}\n**Decision:** INCLUDE\n**Section:** 2\n**Summary:** s`,
    ]);
    const outDir = join(tmpDir, "out");

    const result = prepare(evalPath, outDir);

    expect(result.mode).toBe("grouped");
    const group2 = readFileSync(join(outDir, "group-2.txt"), "utf-8");
    const group5 = readFileSync(join(outDir, "group-5.txt"), "utf-8");
    expect(group2).toContain(a);
    expect(group2).toContain(c);
    expect(group5).toContain(b);
    expect(existsSync(join(outDir, "group-other.txt"))).toBe(false);
    expect(existsSync(join(outDir, "group-2"))).toBe(true);
    expect(existsSync(join(outDir, "group-5"))).toBe(true);
  });

  it("uses the primary section when multiple are given", () => {
    const a = addArticle("blog-a", "post-1", bigBody());
    const b = addArticle("blog-a", "post-2", "short");

    const evalPath = writeEvaluations([
      `## Header: ${a}\n**Decision:** INCLUDE\n**Section:** 2; 5\n**Summary:** s`,
      `## Header: ${b}\n**Decision:** INCLUDE\n**Section:** 3\n**Summary:** s`,
    ]);
    const outDir = join(tmpDir, "out");

    const result = prepare(evalPath, outDir);
    expect(result.mode).toBe("grouped");

    const group2 = readFileSync(join(outDir, "group-2.txt"), "utf-8");
    expect(group2).toContain(a);
    expect(group2).not.toContain(b);
    expect(existsSync(join(outDir, "group-5.txt"))).toBe(false);
    expect(existsSync(join(outDir, "group-3.txt"))).toBe(true);
  });

  it("routes malformed sections to group-other with a warning", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const a = addArticle("blog-a", "post-1", bigBody());
    const b = addArticle("blog-a", "post-2", "short");
    const c = addArticle("blog-a", "post-3", "short");

    const evalPath = writeEvaluations([
      `## Header: ${a}\n**Decision:** INCLUDE\n**Section:** 2\n**Summary:** s`,
      `## Header: ${b}\n**Decision:** INCLUDE\n**Section:** N/A\n**Summary:** s`,
      `## Header: ${c}\n**Decision:** INCLUDE\n**Section:** wibble\n**Summary:** s`,
    ]);
    const outDir = join(tmpDir, "out");

    prepare(evalPath, outDir);

    const other = readFileSync(join(outDir, "group-other.txt"), "utf-8");
    expect(other).toContain(b);
    expect(other).toContain(c);
    expect(existsSync(join(outDir, "group-2.txt"))).toBe(true);

    const warnings = errSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(warnings).toContain(b);
    expect(warnings).toContain(c);
  });

  it("still groups entries whose article body is missing", () => {
    const a = addArticle("blog-a", "post-1", bigBody());
    // Reference a header path whose .md file does not exist.
    const missingHeader = "blog-a/ghost-header.yaml";
    writeFileSync(join("content", missingHeader), 'title: "ghost"\n');

    const evalPath = writeEvaluations([
      `## Header: ${a}\n**Decision:** INCLUDE\n**Section:** 2\n**Summary:** s`,
      `## Header: ${missingHeader}\n**Decision:** INCLUDE\n**Section:** 4\n**Summary:** s`,
    ]);
    const outDir = join(tmpDir, "out");

    const result = prepare(evalPath, outDir);
    expect(result.mode).toBe("grouped");

    const group4 = readFileSync(join(outDir, "group-4.txt"), "utf-8");
    expect(group4).toContain(missingHeader);
  });

  it("produces single-mode output when total words are under the threshold", () => {
    const a = addArticle("blog-a", "post-1", "short article one");
    const b = addArticle("blog-a", "post-2", "short article two");

    const evalPath = writeEvaluations([
      `## Header: ${a}\n**Decision:** INCLUDE\n**Section:** 2\n**Summary:** s`,
      `## Header: ${b}\n**Decision:** INCLUDE\n**Section:** 3\n**Summary:** s`,
    ]);
    const outDir = join(tmpDir, "out");

    const result = prepare(evalPath, outDir);

    expect(result.mode).toBe("single");
    expect(existsSync(join(outDir, "single"))).toBe(true);
    const singleChunks = readdirSync(join(outDir, "single")).filter((f) =>
      /^chunk-\d+\.md$/.test(f)
    );
    expect(singleChunks.length).toBeGreaterThan(0);
    expect(existsSync(join(outDir, "group-2.txt"))).toBe(false);
  });

  it("skips EXCLUDE entries", () => {
    const a = addArticle("blog-a", "post-1", bigBody());
    const b = addArticle("blog-a", "post-2", "short");

    const evalPath = writeEvaluations([
      `## Header: ${a}\n**Decision:** INCLUDE\n**Section:** 2\n**Summary:** s`,
      `## Header: ${b}\n**Decision:** EXCLUDE\n**Section:** N/A\n**Summary:** off topic`,
    ]);
    const outDir = join(tmpDir, "out");

    prepare(evalPath, outDir);

    const group2 = readFileSync(join(outDir, "group-2.txt"), "utf-8");
    expect(group2).toContain(a);
    expect(group2).not.toContain(b);
    expect(existsSync(join(outDir, "group-other.txt"))).toBe(false);
  });
});
