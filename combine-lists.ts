import { readFileSync, writeFileSync } from "fs";

const outputFile = process.argv[2];
const inputFiles = process.argv.slice(3);

if (!outputFile || inputFiles.length === 0) {
  console.error("Usage: combine-lists.ts <output-file> <input-file-1> [input-file-2] ...");
  process.exit(1);
}

const lines = new Set<string>();

for (const file of inputFiles) {
  const content = readFileSync(file, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("→")) continue;
    lines.add(trimmed);
  }
}

const sorted = [...lines].sort();
writeFileSync(outputFile, sorted.join("\n") + "\n");
console.log(`Combined ${inputFiles.length} files → ${sorted.length} unique lines → ${outputFile}`);
