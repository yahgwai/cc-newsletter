import { readFileSync, appendFileSync, mkdirSync, existsSync } from "fs";
import { dirname } from "path";

export function appendFound(file: string, urls: string[]) {
  mkdirSync(dirname(file), { recursive: true });

  const existing = new Set(
    existsSync(file) ? readFileSync(file, "utf-8").split("\n").filter(Boolean) : []
  );

  const added: string[] = [];
  for (const url of urls) {
    if (!existing.has(url)) {
      appendFileSync(file, url + "\n");
      existing.add(url);
      added.push(url);
    }
  }

  const dupes = urls.length - added.length;
  if (added.length) console.log(`Added ${added.length}: ${added.join(", ")}`);
  if (dupes) console.log(`Skipped ${dupes} already in list`);
}

if (process.argv[1]?.includes("append-found")) {
  appendFound(process.argv[2], process.argv.slice(3));
}
