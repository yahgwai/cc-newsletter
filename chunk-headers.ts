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
  console.error("Usage: chunk-headers.ts <input-list> <output-dir>");
  process.exit(1);
}

const paths = readFileSync(inputFile, "utf-8")
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean);

const chunks: string[] = [];
let current = "";
let currentWords = 0;

for (const headerPath of paths) {
  const fullPath = join(FEEDS_DIR, headerPath);
  let content: string;
  try {
    content = readFileSync(fullPath, "utf-8");
  } catch {
    continue;
  }

  const entry = [`Header: ${headerPath}`, content.trim(), "", "---", ""].join("\n");
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

console.log(`Chunked ${paths.length} headers into ${chunks.length} chunks in ${outputDir}/`);
