import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { FEEDS_DIR, chunkAndWrite } from "./util.js";

function today(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function parseCliArgs(argv: string[]): { days: number; outputDir: string } {
  let days = 7;
  let date = today();

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--date" && argv[i + 1]) {
      date = argv[i + 1];
      i++;
    } else if (!argv[i].startsWith("--")) {
      days = parseInt(argv[i], 10);
    }
  }

  return { days, outputDir: `runs/${date}` };
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

function hasSummary(summary: string | undefined): boolean {
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
      if (!hasSummary(fields.summary)) continue;

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

export function recentHeaders(args: string[]) {
  const { days, outputDir } = parseCliArgs(args);
  const articles = collectArticles(days);
  const entries = articles.map(formatArticle);
  const chunkCount = chunkAndWrite(entries, outputDir);

  console.log(outputDir);
  console.log(`Collected ${articles.length} articles from the last ${days} days`);
  console.log(`Written to ${chunkCount} chunks in ${outputDir}/`);
}
