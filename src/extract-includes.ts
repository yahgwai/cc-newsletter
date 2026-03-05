import { readFileSync, writeFileSync } from "fs";

const outputFile = process.argv[2];
const inputFiles = process.argv.slice(3);

if (!outputFile || inputFiles.length === 0) {
  console.error(
    "Usage: extract-includes.ts <output-file> <input-file-1> [input-file-2] ..."
  );
  process.exit(1);
}

const paths = new Set<string>();

for (const file of inputFiles) {
  const content = readFileSync(file, "utf-8");
  let currentHeader: string | null = null;

  for (const line of content.split("\n")) {
    const headerMatch = line.match(/^## Header:\s*(.+)/);
    if (headerMatch) {
      currentHeader = headerMatch[1].trim();
      continue;
    }

    const decisionMatch = line.match(/^\*\*Decision:\*\*\s*(.+)/);
    if (decisionMatch && currentHeader) {
      if (decisionMatch[1].trim().toUpperCase() === "INCLUDE") {
        paths.add(currentHeader);
      }
      currentHeader = null;
    }
  }
}

const sorted = [...paths].sort();
writeFileSync(outputFile, sorted.join("\n") + "\n");
console.log(
  `Extracted ${sorted.length} INCLUDE paths from ${inputFiles.length} files → ${outputFile}`
);
