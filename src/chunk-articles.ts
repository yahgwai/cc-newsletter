import { readFileSync } from "fs";
import { join } from "path";
import { FEEDS_DIR, chunkAndWrite } from "./util.js";

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

const entries: string[] = [];

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

  entries.push(
    [`Header: ${headerPath}`, header, "", article, "", "---", ""].join("\n")
  );
}

const chunkCount = chunkAndWrite(entries, outputDir);

console.log(`Chunked ${headerPaths.length} articles into ${chunkCount} chunks in ${outputDir}/`);
