import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const FEEDS_DIR = "./feeds";
const WORDS_PER_CHUNK = 30_000;

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

const inputFile = process.argv[2];
const outputDir = process.argv[3];

if (!inputFile || !outputDir) {
  console.error("Usage: chunk-articles.ts <shortlist-file> <output-dir>");
  process.exit(1);
}

const headerPaths = readFileSync(inputFile, "utf-8")
  .split("\n")
  .map((l) => l.replace(/\s*\|.*$/, "").trim())
  .filter((l) => l && !l.startsWith("→"));

const chunks: string[] = [];
let current = "";
let currentWords = 0;

for (const headerPath of headerPaths) {
  const headerFullPath = join(FEEDS_DIR, headerPath);
  const mdPath = join(FEEDS_DIR, headerPath.replace("-header.yaml", ".md"));

  let header: string;
  try {
    header = readFileSync(headerFullPath, "utf-8").trim();
  } catch {
    continue;
  }

  let article = "";
  try {
    article = readFileSync(mdPath, "utf-8").trim();
  } catch {
    // No article body — include header only
  }

  const entry = [
    `Header: ${headerPath}`,
    header,
    "",
    article,
    "",
    "---",
    "",
  ].join("\n");

  const words = wordCount(entry);

  if (currentWords + words > WORDS_PER_CHUNK && current) {
    chunks.push(current);
    current = "";
    currentWords = 0;
  }

  current += entry + "\n";
  currentWords += words;
}

if (current.trim()) {
  chunks.push(current);
}

mkdirSync(outputDir, { recursive: true });

for (let i = 0; i < chunks.length; i++) {
  const path = join(outputDir, `chunk-${i + 1}.md`);
  writeFileSync(path, chunks[i]);
}

console.log(`Chunked ${headerPaths.length} articles into ${chunks.length} chunks in ${outputDir}/`);
