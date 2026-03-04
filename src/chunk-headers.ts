import { readFileSync } from "fs";
import { join } from "path";
import { FEEDS_DIR, chunkAndWrite } from "./util.js";

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

const entries: string[] = [];

for (const headerPath of paths) {
  const fullPath = join(FEEDS_DIR, headerPath);
  let content: string;
  try {
    content = readFileSync(fullPath, "utf-8");
  } catch {
    continue;
  }

  entries.push(
    [`Header: ${headerPath}`, content.trim(), "", "---", ""].join("\n")
  );
}

const chunkCount = chunkAndWrite(entries, outputDir);

console.log(`Chunked ${paths.length} headers into ${chunkCount} chunks in ${outputDir}/`);
