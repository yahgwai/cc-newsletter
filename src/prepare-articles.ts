import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { FEEDS_DIR, wordCount } from "./util.js";

const AFFINITY_THRESHOLD = 50_000;

const evaluationsFile = process.argv[2];
const outputDir = process.argv[3];

if (!evaluationsFile || !outputDir) {
  console.error(
    "Usage: prepare-articles.ts <evaluations-file> <output-dir>"
  );
  process.exit(1);
}

const content = readFileSync(evaluationsFile, "utf-8");

interface Entry {
  headerPath: string;
  section: string;
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

  // Extract section: "**Section:** Name" or "INCLUDE — Name"
  let section = "Unknown";
  const sectionMatch = text.match(/\*\*Section:\*\*\s*(.+)$/m);
  const inlineMatch = text.match(/^INCLUDE\s*[—–-]\s*(.+)$/m);
  if (sectionMatch) {
    section = sectionMatch[1].trim();
  } else if (inlineMatch) {
    section = inlineMatch[1].trim();
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
    section,
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
  execSync(`npx tsx src/chunk-articles.ts ${includesPath} ${chunksDir}`, {
    stdio: "inherit",
  });
  console.log(
    `\n${entries.length} articles, ${totalWords} words — chunked to ${chunksDir}/`
  );
} else {
  console.log(
    `\n${entries.length} articles, ${totalWords} words — exceeds ${AFFINITY_THRESHOLD}, affinity grouping needed`
  );
  console.log("Write group files to the output dir, then run:");
  console.log(
    "  npx tsx src/chunk-articles.ts <group-file> <output-dir>/group-N"
  );
}
