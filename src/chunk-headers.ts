import { readFileSync } from "fs";
import { join } from "path";
import { FEEDS_DIR, chunkAndWrite } from "./util.js";

export function chunkHeaders(inputFile: string, outputDir: string) {
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
}

if (process.argv[1]?.includes("chunk-headers")) {
  if (process.argv[2] && process.argv[3]) {
    chunkHeaders(process.argv[2], process.argv[3]);
  } else {
    console.error("Usage: chunk-headers.ts <input-list> <output-dir>");
    process.exit(1);
  }
}
