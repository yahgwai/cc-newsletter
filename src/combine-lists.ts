import { readFileSync, writeFileSync } from "fs";

export function combineLists(outputFile: string, inputFiles: string[]) {
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
}

if (process.argv[1]?.includes("combine-lists")) {
  if (process.argv[2] && process.argv[3]) {
    combineLists(process.argv[2], process.argv.slice(3));
  } else {
    console.error("Usage: combine-lists.ts <output-file> <input-file-1> [input-file-2] ...");
    process.exit(1);
  }
}
