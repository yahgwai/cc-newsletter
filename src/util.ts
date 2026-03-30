import { writeFileSync, mkdirSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";

export const FEEDS_DIR = "content";

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function chunkAndWrite(
  entries: string[],
  outputDir: string,
  wordsPerChunk = 30_000
): number {
  const chunks: string[] = [];
  let current = "";
  let currentWords = 0;

  for (const entry of entries) {
    const words = wordCount(entry);

    if (currentWords + words > wordsPerChunk && current) {
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

  // Clean stale chunks from a previous run that may have produced more chunks
  for (const f of readdirSync(outputDir)) {
    if (/^chunk-\d+\.md$/.test(f)) unlinkSync(join(outputDir, f));
  }

  for (let i = 0; i < chunks.length; i++) {
    const path = join(outputDir, `chunk-${i + 1}.md`);
    writeFileSync(path, chunks[i]);
  }

  return chunks.length;
}
