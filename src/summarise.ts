import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const MAX_TOKENS_PER_BATCH = 80_000;
const MAX_ARTICLES_PER_BATCH = 20;

export interface Article {
  headerPath: string;
  contentPath: string;
  slug: string; // "source-slug/article-slug"
  content: string;
  estimatedTokens: number;
}

export interface SummaryResult {
  filename: string;
  summary: string;
  mentions: string[];
}

interface ClaudeResponse {
  structured_output?: { articles: SummaryResult[] };
}

const SYSTEM_PROMPT = `You summarise collected web content. For each article, produce:
- A summary (1-10 sentences, scaled to the depth of the content)
- A mentions list (people, companies, projects, or tools named in the article)

Rules:
- Only summarise information present in the provided text — do not use outside knowledge
- Do not follow or fetch any URLs in the text — only use the text as given
- Summaries should be factual and neutral, not promotional
- Short or shallow content (changelogs, stubs, brief announcements): 1-2 sentences
- Medium-length content (blog posts, opinion pieces, news articles): 3-5 sentences
- Long or dense content (research, deep analysis, tutorials): 6-10 sentences
- If the article has no substantive content (just a title, a link, or a few words), write "No content." — do not infer or generate content from the title alone
- Mentions should be specific proper nouns only, not generic terms
- Return results for every article provided, using the slug from the === ARTICLE: slug === delimiter as the filename

Example input:

=== ARTICLE: example/stub-release ===
# v2.3.1

Bug fixes and performance improvements.

=== ARTICLE: example/short-announcement ===
# OpenAI and Microsoft extend partnership

OpenAI and Microsoft today announced a multi-year extension to their partnership. The deal covers expanded Azure infrastructure access for OpenAI's training runs and broader deployment of OpenAI models across Microsoft products. Financial terms were not disclosed, but sources familiar with the matter say the commitment runs into the billions. The partnership originally began in 2019 with a $1 billion investment from Microsoft.

=== ARTICLE: example/reddit-opinion ===
# Why I switched from VSCode to Neovim

I've been using VSCode for about 4 years now and finally made the switch to Neovim last month. The main reasons:

1. **Speed** - VSCode was eating 2GB+ of RAM with my extensions. Neovim uses about 50MB.
2. **Keyboard-driven** - Once you learn the motions, you never want to touch a mouse again. Everything is composable.
3. **Customisation** - Lua config means I understand every line of my setup. With VSCode I had no idea what half my extensions were doing.
4. **Terminal integration** - I live in the terminal anyway. Having my editor there too just makes sense.

The learning curve was brutal for the first two weeks. I kept a cheat sheet on my second monitor. But after a month I'm mass faster than I ever was in VSCode.

Downsides: debugging is worse, and some language servers are harder to set up. But for my workflow (Python, Go, lots of config files) it's been worth it.

Would I recommend it to everyone? No. If you're happy with VSCode, stay there. But if you're curious and willing to invest the time, it's incredibly rewarding.

=== ARTICLE: example/langchain-tutorial ===
# Getting started with LangChain

LangChain is a framework for building applications powered by large language models. This guide walks through installation, setup, and building your first chain.

## Installation

\`\`\`bash
pip install langchain langchain-openai
\`\`\`

## Setting up your API key

You'll need an OpenAI API key. Set it as an environment variable:

\`\`\`bash
export OPENAI_API_KEY="sk-..."
\`\`\`

## Your first chain

A chain combines a prompt template with an LLM call:

\`\`\`python
from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate

llm = ChatOpenAI(model="gpt-4")
prompt = ChatPromptTemplate.from_template("Explain {topic} in simple terms")
chain = prompt | llm
result = chain.invoke({"topic": "quantum computing"})
print(result.content)
\`\`\`

## Adding memory

To make your chain conversational, add message history:

\`\`\`python
from langchain.memory import ConversationBufferMemory

memory = ConversationBufferMemory()
\`\`\`

This stores the full conversation and injects it into each prompt. For longer conversations, consider \`ConversationSummaryMemory\` which compresses older messages.

## Next steps

- Add retrieval with vector stores (FAISS, Chroma)
- Build agents that can use tools
- Deploy with LangServe

=== ARTICLE: example/rust-release ===
# Announcing Rust 1.80

The Rust team is happy to announce a new version of Rust, 1.80.0. Rust is a programming language empowering everyone to build reliable and efficient software.

## LazyCell and LazyLock

Rust 1.80 stabilises \`LazyCell\` and \`LazyLock\`, two new types for lazy initialisation. \`LazyCell\` is suitable for single-threaded scenarios, while \`LazyLock\` is the thread-safe variant suitable for use in statics.

Previously, the community relied on the \`lazy_static\` and \`once_cell\` crates for this functionality. With these types now in the standard library, many projects can remove those dependencies.

\`\`\`rust
use std::sync::LazyLock;

static GLOBAL_CONFIG: LazyLock<Config> = LazyLock::new(|| {
    Config::load_from_file("config.toml")
});
\`\`\`

## Exclusive range patterns

You can now use exclusive ranges in patterns (\`0..n\`), matching the existing range expression syntax:

\`\`\`rust
match value {
    0..10 => println!("single digit"),
    10..100 => println!("double digit"),
    _ => println!("triple digit or more"),
}
\`\`\`

Previously, only inclusive ranges (\`0..=9\`) were allowed in patterns, which was a common source of off-by-one confusion.

## Stabilised APIs

A number of APIs have been stabilised in this release:

- \`impl Default for Rc<[T]>\`
- \`impl Default for Arc<[T]>\`
- \`BinaryHeap::as_slice\`
- \`NonNull::offset\` and \`NonNull::byte_offset\`
- \`Duration::abs_diff\`

## Compatibility notes

- The minimum required LLVM version has been raised to 17.
- The \`wasm32-wasi\` target is now a Tier 2 target. The previous \`wasm32-wasi\` name is deprecated.
- \`soft-float\` on x86 targets now requires SSE2. This affects very old processors from the early 2000s.

The full release notes are available on the Rust blog.

=== ARTICLE: example/system-prompt-analysis ===
# Analysing Claude's system prompt

Anthropic's Claude has a system prompt that's been widely shared and discussed. I've been going through it in detail and there's a lot of interesting stuff in here. This is the kind of document that reveals how a company thinks about AI alignment in practice, not just in theory.

## The constitutional AI section

The most interesting part is the set of behavioural instructions at the top. Claude is told to be "helpful, harmless, and honest" — the classic Anthropic framing. But the implementation details are revealing.

Claude is instructed to refuse requests that could cause harm, but the definition of "harm" is nuanced. It's not a simple blocklist. The prompt describes categories of harm and asks Claude to reason about severity, reversibility, and likelihood. This is a fundamentally different approach from keyword filtering.

There's also a section on "controversial topics" where Claude is told to present multiple perspectives without taking sides. This is philosophically interesting — it's an editorial choice to avoid editorial choices.

## Tool use instructions

A significant chunk of the prompt is devoted to tool use. Claude is given detailed instructions about when to use tools vs when to answer from knowledge, how to handle tool errors, and how to chain multiple tool calls.

What stands out is the emphasis on asking before acting. Claude is told to confirm before performing actions with side effects — writing files, executing code, making API calls. This is a practical safety measure that makes a real difference in agent settings.

The prompt also includes instructions about not fabricating tool results. If a tool call fails, Claude should say so rather than making up a plausible-looking result. This is an underappreciated failure mode in agent systems — a model that confidently reports fake tool outputs can cause real damage.

## Formatting and style

There are surprisingly detailed instructions about formatting. Markdown usage, code block languages, list formatting — it's all specified. This suggests Anthropic has learned that small formatting inconsistencies erode user trust over time.

Claude is also told to be concise and avoid "filler" phrases like "Certainly!" and "Of course!". As someone who's noticed this pattern in other models, I appreciate this being called out explicitly.

## What this tells us about the industry

System prompts are becoming a form of product design. They're not just technical configurations — they encode values, priorities, and product opinions. Anthropic's prompt is notable for how much reasoning it expects from the model rather than relying on hard rules.

Whether this approach scales and whether it's robust to adversarial inputs are open questions. But as a snapshot of how one leading AI lab thinks about model behaviour, this document is fascinating.

Example output:

{"articles": [
  {"filename": "example/stub-release", "summary": "No content.", "mentions": []},
  {"filename": "example/short-announcement", "summary": "OpenAI and Microsoft announced a multi-year, multi-billion dollar extension of their partnership, expanding Azure infrastructure access for training and broader model deployment across Microsoft products.", "mentions": ["OpenAI", "Microsoft", "Azure"]},
  {"filename": "example/reddit-opinion", "summary": "A developer describes switching from VSCode to Neovim after four years, citing 2GB+ RAM usage, keyboard-driven workflow, Lua-based customisation, and terminal integration as the main motivations. The learning curve was steep for the first two weeks but after a month they report being faster than in VSCode. Downsides include worse debugging support and harder language server setup, though for their Python and Go workflow the tradeoff is worth it.", "mentions": ["VSCode", "Neovim"]},
  {"filename": "example/langchain-tutorial", "summary": "A getting-started tutorial for LangChain covering installation via pip and OpenAI API key configuration. The core walkthrough builds a first chain combining a ChatPromptTemplate with a ChatOpenAI LLM call using the pipe operator. The guide also introduces conversational memory with ConversationBufferMemory for maintaining chat history across turns. Next steps point to vector store retrieval with FAISS and Chroma, tool-using agents, and deployment with LangServe.", "mentions": ["LangChain", "OpenAI", "FAISS", "Chroma", "LangServe"]},
  {"filename": "example/rust-release", "summary": "Rust 1.80 stabilises LazyCell and LazyLock for lazy initialisation, replacing the need for the lazy_static and once_cell crates in many projects. The release also adds exclusive range patterns in match expressions, resolving a common source of off-by-one confusion with inclusive ranges. Several standard library APIs are stabilised including BinaryHeap::as_slice and Duration::abs_diff. On the compatibility side, the minimum LLVM version is now 17 and the wasm32-wasi target has been renamed.", "mentions": ["Rust", "LLVM"]},
  {"filename": "example/system-prompt-analysis", "summary": "Simon Willison analyses Claude's leaked system prompt in detail, examining how Anthropic implements its 'helpful, harmless, and honest' framework through nuanced harm categories that consider severity, reversibility, and likelihood rather than simple keyword filtering. The prompt's approach to controversial topics — presenting multiple perspectives without taking sides — is noted as an editorial choice to avoid editorial choices. A large portion of the prompt covers tool use, emphasising confirmation before side effects and prohibiting fabricated tool results, which Willison identifies as an underappreciated failure mode in agent systems. The analysis also covers surprisingly detailed formatting instructions around Markdown and code blocks, suggesting Anthropic has learned that small inconsistencies erode user trust over time. Claude is explicitly told to avoid filler phrases like 'Certainly!' that are common in other models. Willison frames system prompts as an emerging form of product design that encodes values and product opinions, noting Anthropic's approach relies on model reasoning rather than hard rules.", "mentions": ["Simon Willison", "Claude", "Anthropic"]}
]}`;

const JSON_SCHEMA = JSON.stringify({
  type: "object",
  properties: {
    articles: {
      type: "array",
      items: {
        type: "object",
        properties: {
          filename: { type: "string", description: "The article slug from the === ARTICLE: slug === delimiter" },
          summary: { type: "string" },
          mentions: { type: "array", items: { type: "string" } },
        },
        required: ["filename", "summary", "mentions"],
      },
    },
  },
  required: ["articles"],
});

export function findUnprocessedArticles(feedsDir = "feeds"): Article[] {
  const articles: Article[] = [];

  let sources: string[];
  try {
    sources = readdirSync(feedsDir);
  } catch {
    return articles;
  }

  for (const source of sources) {
    const sourceDir = join(feedsDir, source);
    if (!statSync(sourceDir).isDirectory()) continue;

    let files: string[];
    try {
      files = readdirSync(sourceDir);
    } catch {
      continue;
    }

    for (const file of files) {
      if (!file.endsWith("-header.yaml")) continue;

      const headerPath = join(sourceDir, file);
      const headerContent = readFileSync(headerPath, "utf-8");

      if (headerContent.includes("\nsummary:") || headerContent.startsWith("summary:")) continue;

      const baseName = file.replace(/-header\.yaml$/, "");
      const contentPath = join(sourceDir, `${baseName}.md`);

      let content: string;
      try {
        content = readFileSync(contentPath, "utf-8");
      } catch {
        continue; // skip if no matching content file
      }

      // Strip link/date metadata lines — already in the header yaml
      const cleaned = content.replace(/^- \*\*Link:\*\*.*\n?/m, "").replace(/^- \*\*Date:\*\*.*\n?/m, "");

      const slug = `${source}/${baseName}`;
      const tokensMatch = headerContent.match(/^tokens:\s*(\d+)/m);
      const estimatedTokens = tokensMatch
        ? parseInt(tokensMatch[1], 10)
        : Math.ceil(cleaned.length / 2);
      articles.push({
        headerPath,
        contentPath,
        slug,
        content: cleaned,
        estimatedTokens,
      });
    }
  }

  return articles;
}

// Content is empty if stripping the markdown heading leaves only whitespace
export function hasContent(content: string): boolean {
  const stripped = content.replace(/^#.*\n?/, "").trim();
  return stripped.length > 0;
}

export function buildBatches(articles: Article[]): Article[][] {
  if (articles.length === 0) return [];

  const batches: Article[][] = [];
  let current: Article[] = [];
  let currentTokens = 0;

  for (const article of articles) {
    // Oversized article always gets its own batch
    if (article.estimatedTokens >= MAX_TOKENS_PER_BATCH) {
      if (current.length > 0) {
        batches.push(current);
        current = [];
        currentTokens = 0;
      }
      batches.push([article]);
      continue;
    }

    const wouldExceedTokens = currentTokens + article.estimatedTokens > MAX_TOKENS_PER_BATCH;
    const wouldExceedCount = current.length >= MAX_ARTICLES_PER_BATCH;

    if (current.length > 0 && (wouldExceedTokens || wouldExceedCount)) {
      batches.push(current);
      current = [];
      currentTokens = 0;
    }

    current.push(article);
    currentTokens += article.estimatedTokens;
  }

  if (current.length > 0) {
    batches.push(current);
  }

  return batches;
}

export function buildUserPrompt(articles: Article[]): string {
  return articles
    .map((a) => `=== ARTICLE: ${a.slug} ===\n${a.content}`)
    .join("\n\n");
}

export function writeResults(
  batch: Article[],
  results: SummaryResult[]
): { written: number; skipped: number } {
  const resultMap = new Map(results.map((r) => [r.filename, r]));
  let written = 0;
  let skipped = 0;

  for (const article of batch) {
    const result = resultMap.get(article.slug);
    if (!result) {
      console.log(`  Skipped (missing from response): ${article.slug}`);
      skipped++;
      continue;
    }

    const existing = readFileSync(article.headerPath, "utf-8");
    const addition = `summary: ${JSON.stringify(result.summary)}\nmentions: ${JSON.stringify(result.mentions)}\n`;
    writeFileSync(article.headerPath, existing.trimEnd() + "\n" + addition);
    written++;
  }

  return { written, skipped };
}

const CLAUDE_TIMEOUT_MS = 300_000;

// claude -p --output-format json puts errors on stderr as JSON with
// {is_error: true, result: "message"}. Extract the human-readable part.
function extractClaudeError(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    if (parsed.result) return parsed.result;
  } catch {}
  return raw.slice(0, 500);
}

async function callClaude(userPrompt: string): Promise<SummaryResult[]> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.CLAUDECODE;

    const proc = spawn("claude", [
      "-p",
      "--model", "haiku",
      "--output-format", "json",
      "--json-schema", JSON_SCHEMA,
      "--allowedTools", "",
      "--system-prompt", SYSTEM_PROMPT,
    ], { stdio: ["pipe", "pipe", "pipe"], env });

    const timeout = setTimeout(() => {
      proc.kill();
      reject(new Error(`claude timed out after ${CLAUDE_TIMEOUT_MS / 1000}s`));
    }, CLAUDE_TIMEOUT_MS);

    proc.stdin.write(userPrompt);
    proc.stdin.end();

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      clearTimeout(timeout);

      if (code !== 0) {
        const detail = extractClaudeError(stderr || stdout) || "(no output)";
        reject(new Error(`claude exited with code ${code}: ${detail}`));
        return;
      }

      try {
        const parsed: ClaudeResponse = JSON.parse(stdout);
        if (!parsed.structured_output) {
          reject(new Error(`No structured_output in response.\nRaw: ${stdout.slice(0, 500)}`));
          return;
        }
        resolve(parsed.structured_output.articles ?? []);
      } catch (err) {
        reject(new Error(`Failed to parse claude output: ${err}\nRaw: ${stdout.slice(0, 500)}`));
      }
    });
  });
}

function parseArgs(argv: string[]): { parallel: number } {
  let parallel = 10;
  const idx = argv.indexOf("--parallel");
  if (idx !== -1 && argv[idx + 1]) {
    const n = parseInt(argv[idx + 1], 10);
    if (!isNaN(n) && n > 0) parallel = n;
  }
  return { parallel };
}

const REQUEST_INTERVAL_MS = 2500;

function makeThrottle() {
  let next = Date.now();
  return async () => {
    const now = Date.now();
    const wait = next - now;
    next = Math.max(now, next) + REQUEST_INTERVAL_MS;
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  };
}

async function main() {
  const { parallel } = parseArgs(process.argv);

  const allArticles = findUnprocessedArticles();

  // Write "No content." for empty articles without calling claude
  const articlesToSummarise: Article[] = [];
  let emptyCount = 0;
  for (const article of allArticles) {
    if (!hasContent(article.content)) {
      const existing = readFileSync(article.headerPath, "utf-8");
      writeFileSync(article.headerPath, existing.trimEnd() + "\nsummary: \"No content.\"\nmentions: []\n");
      emptyCount++;
    } else {
      articlesToSummarise.push(article);
    }
  }

  if (articlesToSummarise.length === 0) {
    if (emptyCount > 0) {
      console.log(`Wrote ${emptyCount} empty articles. No articles to summarise.`);
    } else {
      console.log("No unprocessed articles found.");
    }
    return;
  }

  const batches = buildBatches(articlesToSummarise);
  console.log(
    `Found ${articlesToSummarise.length} articles to summarise (${emptyCount} empty), ${batches.length} batches (parallel: ${parallel}).`
  );

  let totalWritten = emptyCount;
  let totalSkipped = 0;
  const throttle = makeThrottle();

  async function processBatch(batch: Article[], batchNum: number) {
    const totalTokens = batch.reduce((s, a) => s + a.estimatedTokens, 0);
    const estTokens = Math.round(totalTokens / 1000);
    if (totalTokens > 160_000) {
      console.log(`Batch ${batchNum}/${batches.length}: skipped, too large for haiku (est. ${estTokens}K tokens): ${batch.map(a => a.slug).join(", ")}`);
      totalSkipped += batch.length;
      return;
    }
    await throttle();
    const start = performance.now();
    const prompt = buildUserPrompt(batch);
    try {
      const results = await callClaude(prompt);
      const elapsed = ((performance.now() - start) / 1000).toFixed(1);
      const { written, skipped } = writeResults(batch, results);
      totalWritten += written;
      totalSkipped += skipped;
      console.log(`Batch ${batchNum}/${batches.length}: wrote ${written} summaries in ${elapsed}s (est. ${estTokens}K tokens)`);
    } catch (err) {
      const elapsed = ((performance.now() - start) / 1000).toFixed(1);
      console.error(`  Batch ${batchNum} failed after ${elapsed}s:`, err);
      totalSkipped += batch.length;
    }
  }

  const totalStart = performance.now();

  // Run first batch alone to prime prompt cache
  await processBatch(batches[0], 1);

  // Process remaining batches with concurrency pool
  const remaining = batches.slice(1);
  if (remaining.length > 0) {
    let nextIndex = 0;

    async function worker() {
      while (nextIndex < remaining.length) {
        const idx = nextIndex++;
        await processBatch(remaining[idx], idx + 2);
      }
    }

    const workers = Array.from({ length: Math.min(parallel, remaining.length) }, () => worker());
    await Promise.all(workers);
  }

  const totalElapsed = ((performance.now() - totalStart) / 1000).toFixed(1);
  console.log(
    `Done in ${totalElapsed}s. Wrote ${totalWritten} summaries, ${totalSkipped} failed/skipped.`
  );
}

export { main };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
