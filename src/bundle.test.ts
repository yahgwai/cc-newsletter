import { execSync } from "child_process";
import { existsSync } from "fs";
import { describe, expect, it } from "vitest";

describe("bundle", () => {
  const bundle = "dist/collect.js";

  it("exists", () => {
    expect(existsSync(bundle)).toBe(true);
  });

  it("runs --help", () => {
    const out = execSync(`node ${bundle} --help`, { encoding: "utf-8" });
    expect(out).toContain("Usage: collect <command>");
  });

  it("loads every command without import errors", () => {
    // Each command triggers its dynamic import() path.
    // We just need them to load — not succeed at runtime.
    const commands = [
      "sync-rss --help",
      "sync-github-releases --help",
      "sync-sitemaps --help",
      "summarise --help",
      "newsletter --help",
      "discover-feeds --help",
      "append-found --help",
      "recent-headers --help",
      "chunk-articles --help",
      "chunk-headers --help",
      "extract-includes --help",
      "combine-lists --help",
      "prepare --help",
    ];
    for (const cmd of commands) {
      // --help triggers usage() before the command runs, so it exits 0
      // without needing real data or network access
      const out = execSync(`node ${bundle} ${cmd}`, { encoding: "utf-8" });
      expect(out).toContain("Usage:");
    }
  });
});
