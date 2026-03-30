import { execSync } from "child_process";
import { existsSync, mkdtempSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { describe, expect, it } from "vitest";

describe("bundle", () => {
  const bundle = "dist/cc-newsletter.js";

  it("exists", () => {
    expect(existsSync(bundle)).toBe(true);
  });

  it("runs --help", () => {
    const out = execSync(`node ${bundle} --help`, { encoding: "utf-8" });
    expect(out).toContain("Usage: cc-newsletter <command>");
  });

  it("loads every command without import errors", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "cc-newsletter-test-"));
    writeFileSync(join(tmpDir, "feeds.json"), "[]\n");
    writeFileSync(join(tmpDir, "github-releases.json"), "[]\n");
    writeFileSync(join(tmpDir, "sitemaps.json"), "[]\n");

    try {
      // Each command triggers its dynamic import() path.
      // We just need them to load — not succeed at runtime.
      const commands = [
        "sync-rss",
        "sync-github-releases",
        "sync-sitemaps",
        "summarise",
        "newsletter",
        "discover-feeds",
        "append-found",
        "recent-headers",
        "chunk-articles",
        "chunk-headers",
        "extract-includes",
        "combine-lists",
        "prepare",
      ];
      for (const cmd of commands) {
        const out = execSync(`node ${bundle} ${cmd} ${tmpDir} --help`, {
          encoding: "utf-8",
        });
        expect(out).toContain("Usage:");
      }
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });
});
