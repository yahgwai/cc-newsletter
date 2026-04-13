import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { FEEDS_DIR, wordCount } from "./util.js";
import { chunkArticles } from "./chunk-articles.js";

const AFFINITY_THRESHOLD = 50_000;

export function prepare(
  evaluationsFile: string,
  outputDir: string
): { mode: "single" | "grouped"; totalWords: number } {
  const content = readFileSync(evaluationsFile, "utf-8");

  interface Entry {
    headerPath: string;
    sections: number[];
    summary: string;
    articleWords: number;
  }

  const entries: Entry[] = [];

  // Split on --- or ``` separators between entries
  const blocks = content.split(/^(?:---|```)$/m);

  for (const block of blocks) {
    const text = block.trim();
    if (!text) continue;

    // Extract header path: "## Header: path" or "Header: path"
    const headerMatch = text.match(/^#{0,3}\s*Header:\s*(.+)$/m);
    if (!headerMatch) continue;
    const headerPath = headerMatch[1].trim();

    // Check for INCLUDE — supports both "**Decision:** INCLUDE" and bare "INCLUDE"
    const decisionMatch = text.match(
      /(?:\*\*Decision:\*\*\s*|^)(INCLUDE|EXCLUDE)/m
    );
    if (!decisionMatch || decisionMatch[1] !== "INCLUDE") continue;

    // Extract section numbers from "**Section:** <digits>[; <digits>]..."
    const sections: number[] = [];
    const sectionMatch = text.match(/\*\*Section:\*\*\s*([\d;\s]+?)(?:\n|$)/);
    if (sectionMatch) {
      const parts = sectionMatch[1].split(/[;\s]+/).map((s) => s.trim()).filter(Boolean);
      for (const part of parts) {
        const n = Number(part);
        if (Number.isInteger(n)) sections.push(n);
      }
    }

    // Extract summary: "**Summary:** text" or remaining lines
    let summary = "";
    const summaryMatch = text.match(/\*\*Summary:\*\*\s*([\s\S]+?)$/m);
    if (summaryMatch) {
      summary = summaryMatch[1].trim();
    }

    const mdPath = join(FEEDS_DIR, headerPath.replace("-header.yaml", ".md"));
    let articleWords = 0;
    try {
      articleWords = wordCount(readFileSync(mdPath, "utf-8"));
    } catch {
      // No article body
    }

    entries.push({
      headerPath,
      sections,
      summary,
      articleWords,
    });
  }

  // Write includes.txt
  mkdirSync(outputDir, { recursive: true });
  const includesPath = join(outputDir, "includes.txt");
  writeFileSync(
    includesPath,
    entries.map((e) => e.headerPath).join("\n") + "\n"
  );

  let totalWords = 0;
  for (const entry of entries) {
    totalWords += entry.articleWords;
  }

  if (totalWords <= AFFINITY_THRESHOLD) {
    const chunksDir = join(outputDir, "single");
    chunkArticles(includesPath, chunksDir);
    console.log(
      `\n${entries.length} articles, ${totalWords} words — chunked to ${chunksDir}/`
    );
    return { mode: "single", totalWords };
  } else {
    const groups = new Map<number | "other", string[]>();
    for (const entry of entries) {
      const primary = entry.sections[0];
      const key: number | "other" = Number.isInteger(primary) ? primary : "other";
      if (key === "other") {
        console.error(
          `warning: ${entry.headerPath} has no valid section number — routing to group-other`
        );
      }
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(entry.headerPath);
    }

    for (const [key, paths] of groups) {
      const groupFile = join(outputDir, `group-${key}.txt`);
      writeFileSync(groupFile, paths.join("\n") + "\n");
      const groupDir = join(outputDir, `group-${key}`);
      chunkArticles(groupFile, groupDir);
    }

    console.log(
      `\n${entries.length} articles, ${totalWords} words — grouped into ${groups.size} sections`
    );
    return { mode: "grouped", totalWords };
  }
}

if (process.argv[1]?.includes("prepare-articles")) {
  if (process.argv[2] && process.argv[3]) {
    prepare(process.argv[2], process.argv[3]);
  } else {
    console.error(
      "Usage: prepare-articles.ts <evaluations-file> <output-dir>"
    );
    process.exit(1);
  }
}
