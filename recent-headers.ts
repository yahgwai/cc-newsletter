import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "fs";
import { join } from "path";

const FEEDS_DIR = "./feeds";
const WORDS_PER_CHUNK = 30_000;

function today(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function parseArgs(): { days: number; outputDir: string } {
  const args = process.argv.slice(2);
  let days = 7;
  let date = today();

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--date" && args[i + 1]) {
      date = args[i + 1];
      i++;
    } else if (!args[i].startsWith("--")) {
      days = parseInt(args[i], 10);
    }
  }

  return { days, outputDir: `/tmp/newsletter-${date}` };
}

function parseHeaderYaml(content: string) {
  const fields: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const match = line.match(/^(\w+):\s*"(.*)"\s*$/);
    if (match) {
      fields[match[1]] = match[2];
    }
  }
  return fields;
}

function isWithinDays(dateStr: string, days: number): boolean {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return date >= cutoff;
}

function hasContent(summary: string | undefined): boolean {
  if (!summary) return false;
  if (summary === "No content.") return false;
  return true;
}

interface Article {
  headerPath: string;
  source: string;
  title: string;
  link: string;
  date: string;
  summary: string;
}

function collectArticles(days: number): Article[] {
  const articles: Article[] = [];
  const sources = readdirSync(FEEDS_DIR);

  for (const source of sources) {
    const sourceDir = join(FEEDS_DIR, source);
    if (!statSync(sourceDir).isDirectory()) continue;

    const files = readdirSync(sourceDir);
    const headers = files.filter((f) => f.endsWith("-header.yaml"));

    for (const headerFile of headers) {
      const headerPath = join(sourceDir, headerFile);
      const raw = readFileSync(headerPath, "utf-8");
      const fields = parseHeaderYaml(raw);

      if (!isWithinDays(fields.date, days)) continue;
      if (!hasContent(fields.summary)) continue;

      articles.push({
        headerPath: join(source, headerFile),
        source,
        title: fields.title || "Untitled",
        link: fields.link || "",
        date: fields.date,
        summary: fields.summary,
      });
    }
  }

  articles.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return articles;
}

function formatArticle(article: Article): string {
  return [
    `# ${article.title}`,
    `Header: ${article.headerPath}`,
    `Source: ${article.source}`,
    `Date: ${article.date}`,
    `Link: ${article.link}`,
    "",
    `**Summary:** ${article.summary}`,
    "",
    "---",
    "",
  ].join("\n");
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function writeChunks(articles: Article[], outputDir: string) {
  const chunks: string[] = [];
  let current = "";
  let currentWords = 0;

  for (const article of articles) {
    const formatted = formatArticle(article);
    const words = wordCount(formatted);

    if (currentWords + words > WORDS_PER_CHUNK && current) {
      chunks.push(current);
      current = "";
      currentWords = 0;
    }

    current += formatted + "\n";
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

  return chunks.length;
}

const { days, outputDir } = parseArgs();
const articles = collectArticles(days);
const chunkCount = writeChunks(articles, outputDir);

console.log(outputDir);
console.log(`Collected ${articles.length} articles from the last ${days} days`);
console.log(`Written to ${chunkCount} chunks in ${outputDir}/`);
