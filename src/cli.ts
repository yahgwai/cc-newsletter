import { existsSync, mkdirSync, writeFileSync } from "fs";
import { execSync } from "child_process";

const [command, ...args] = process.argv.slice(2);

function usage() {
  console.log(`Usage: collect <command> [options]

Commands:
  init                          Scaffold a new project in the current directory
  ingest                        Sync all sources and summarise new articles
  sync-rss                      Fetch new articles from all RSS feeds
  sync-github-releases          Fetch new releases from GitHub repos
  sync-sitemaps                 Fetch new pages from tracked sitemaps
  summarise                     Summarise any unsummarised articles
  newsletter [--date X] [--days N]  Run full newsletter pipeline
  recent-headers [days] [--date X]  Collect recent headers into chunks
  prepare <evals> <outdir>      Prepare evaluated articles for writing
  discover-feeds                Extract RSS feeds from discovered URLs
  append-found <file> <url...>  Deduplicate and append URLs to a file
  chunk-articles <list> <outdir>  Chunk article list with full content
  chunk-headers <list> <outdir>   Chunk header list
  extract-includes <out> <files...>  Extract INCLUDE paths from decision files
  combine-lists <out> <files...>     Deduplicate and merge text files
  pdf <date>                    Convert newsletter markdown to PDF`);
}

async function run() {
  if (command && command !== "--help" && command !== "-h" && (args.includes("--help") || args.includes("-h"))) {
    usage();
    return;
  }

  switch (command) {
    case "init": {
      mkdirSync("config", { recursive: true });
      for (const file of ["feeds.json", "github-releases.json", "sitemaps.json"]) {
        if (!existsSync(`config/${file}`)) {
          writeFileSync(`config/${file}`, "[]\n");
          console.log(`wrote config/${file}`);
        }
      }

      if (!existsSync(".gitignore")) {
        writeFileSync(".gitignore", "content/\ndiscovery/\nnewsletters/\n");
        console.log("wrote .gitignore");
      }

      console.log("\nProject initialized. Next steps:");
      console.log("  1. Run /collect:setup to configure your newsletter");
      console.log("  2. Run collect ingest to pull content from sources");
      console.log("  3. Run /collect:discover to find more sources");
      break;
    }

    case "ingest": {
      const { syncRss } = await import("./sync-rss.js");
      const { syncGithubReleases } = await import("./sync-github-releases.js");
      const { syncSitemaps } = await import("./sync-sitemap.js");
      const { main: summarise } = await import("./summarise.js");

      await syncRss();
      await syncGithubReleases();
      await syncSitemaps();
      await summarise();
      break;
    }

    case "sync-rss": {
      const { syncRss } = await import("./sync-rss.js");
      await syncRss();
      break;
    }

    case "sync-github-releases": {
      const { syncGithubReleases } = await import("./sync-github-releases.js");
      await syncGithubReleases();
      break;
    }

    case "sync-sitemaps": {
      const { syncSitemaps } = await import("./sync-sitemap.js");
      await syncSitemaps();
      break;
    }

    case "summarise": {
      const { main } = await import("./summarise.js");
      await main();
      break;
    }

    case "newsletter": {
      const { newsletter } = await import("./newsletter.js");
      await newsletter(args);
      break;
    }

    case "recent-headers": {
      const { recentHeaders } = await import("./recent-headers.js");
      recentHeaders(args);
      break;
    }

    case "prepare": {
      const { prepare } = await import("./prepare-articles.js");
      if (args.length < 2) {
        console.error("Usage: collect prepare <evaluations-file> <output-dir>");
        process.exit(1);
      }
      prepare(args[0], args[1]);
      break;
    }

    case "discover-feeds": {
      const { discoverFeeds } = await import("./discover-feeds.js");
      await discoverFeeds();
      break;
    }

    case "append-found": {
      const { appendFound } = await import("./append-found.js");
      if (args.length < 1) {
        console.error("Usage: collect append-found <file> <url...>");
        process.exit(1);
      }
      appendFound(args[0], args.slice(1));
      break;
    }

    case "chunk-articles": {
      const { chunkArticles } = await import("./chunk-articles.js");
      if (args.length < 2) {
        console.error("Usage: collect chunk-articles <shortlist-file> <output-dir>");
        process.exit(1);
      }
      chunkArticles(args[0], args[1]);
      break;
    }

    case "chunk-headers": {
      const { chunkHeaders } = await import("./chunk-headers.js");
      if (args.length < 2) {
        console.error("Usage: collect chunk-headers <input-list> <output-dir>");
        process.exit(1);
      }
      chunkHeaders(args[0], args[1]);
      break;
    }

    case "extract-includes": {
      const { extractIncludes } = await import("./extract-includes.js");
      if (args.length < 2) {
        console.error("Usage: collect extract-includes <output-file> <input-file-1> [input-file-2] ...");
        process.exit(1);
      }
      extractIncludes(args[0], args.slice(1));
      break;
    }

    case "combine-lists": {
      const { combineLists } = await import("./combine-lists.js");
      if (args.length < 2) {
        console.error("Usage: collect combine-lists <output-file> <input-file-1> [input-file-2] ...");
        process.exit(1);
      }
      combineLists(args[0], args.slice(1));
      break;
    }

    case "pdf": {
      if (args.length < 1) {
        console.error("Usage: collect pdf <date>");
        process.exit(1);
      }
      const date = args[0];
      execSync(
        `pandoc newsletters/${date}/newsletter.md -t html --css config/style.css -o newsletters/${date}/newsletter.pdf --pdf-engine=weasyprint`,
        { stdio: "inherit" }
      );
      break;
    }

    case undefined:
    case "--help":
    case "-h":
      usage();
      break;

    default:
      console.error(`Unknown command: ${command}`);
      usage();
      process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
