import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { spawn } from "child_process";
import { FEEDS_DIR, wordCount, chunkAndWrite } from "./util.js";

// --- Config ---

const PARALLEL = 10;
const REQUEST_INTERVAL_MS = 2500;
const WORDS_PER_CHUNK = 30_000;
const REDUCE_TARGET_WORDS = 25_000;

// --- YAML parser (from recent-headers.ts) ---

function parseHeaderYaml(content: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const match = line.match(/^(\w+):\s*"(.*)"\s*$/);
    if (match) {
      fields[match[1]] = match[2];
    }
  }
  return fields;
}

// --- Throttle + worker pool (from summarise.ts) ---

function makeThrottle() {
  let next = Date.now();
  return async () => {
    const now = Date.now();
    const wait = next - now;
    next = Math.max(now, next) + REQUEST_INTERVAL_MS;
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  };
}

async function runPool<T>(
  items: T[],
  parallel: number,
  fn: (item: T, index: number) => Promise<void>
): Promise<void> {
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const idx = nextIndex++;
      await fn(items[idx], idx);
    }
  }
  const workers = Array.from(
    { length: Math.min(parallel, items.length) },
    () => worker()
  );
  await Promise.all(workers);
}

// --- Claude call (text output, no JSON schema) ---

const CALL_TIMEOUT_MS = 120_000;

async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  model: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.CLAUDECODE;

    const proc = spawn(
      "claude",
      ["-p", "--model", model, "--allowedTools", "", "--system-prompt", systemPrompt],
      { stdio: ["pipe", "pipe", "pipe"], env }
    );

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`claude timed out after ${CALL_TIMEOUT_MS / 1000}s`));
    }, CALL_TIMEOUT_MS);

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
      clearTimeout(timer);
      if (code !== 0) {
        let detail: string;
        try {
          const parsed = JSON.parse(stderr);
          detail = parsed.result || stderr.slice(0, 500);
        } catch {
          detail = stderr || stdout.slice(0, 1000) || "(no output)";
        }
        reject(new Error(`claude exited with code ${code}: ${detail}`));
        return;
      }
      resolve(stdout);
    });
  });
}

// --- Step 1: Find ---

interface HeaderEntry {
  headerPath: string; // relative: source/slug-header.yaml
  title: string;
  date: string;
  summary: string;
}

function collectAllHeaders(days?: number): HeaderEntry[] {
  const entries: HeaderEntry[] = [];
  const sources = readdirSync(FEEDS_DIR);
  console.log(`Scanning ${sources.length} sources...`);

  let cutoff: Date | undefined;
  if (days !== undefined) {
    cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
  }

  for (const source of sources) {
    const sourceDir = join(FEEDS_DIR, source);
    if (!statSync(sourceDir).isDirectory()) continue;

    const files = readdirSync(sourceDir);
    for (const file of files) {
      if (!file.endsWith("-header.yaml")) continue;

      const headerPath = join(source, file);
      const raw = readFileSync(join(FEEDS_DIR, headerPath), "utf-8");
      const fields = parseHeaderYaml(raw);

      if (!fields.summary || fields.summary === "No content.") continue;

      if (cutoff && fields.date) {
        const articleDate = new Date(fields.date);
        if (isNaN(articleDate.getTime()) || articleDate < cutoff) continue;
      }

      entries.push({
        headerPath,
        title: fields.title || "Untitled",
        date: fields.date || "",
        summary: fields.summary || "",
      });
    }
  }

  return entries;
}

function formatHeaderForFind(entry: HeaderEntry): string {
  return [
    `Path: ${entry.headerPath}`,
    `Title: ${entry.title}`,
    `Date: ${entry.date}`,
    `Summary: ${entry.summary}`,
    "---",
  ].join("\n");
}

const FIND_SYSTEM_PROMPT = `You are a research assistant triaging articles for relevance.

You will receive a list of articles (path, title, date, summary) and a research query.

For each article, output EXACTLY one line:
path | RELEVANT
or
path | NOT RELEVANT

where "path" is the exact Path value from the article entry.

Rules:
- Be INCLUSIVE — if in doubt, mark RELEVANT
- Consider whether the article might contain useful context, even indirectly
- Output one line per article, nothing else — no headers, no explanations`;

async function stepFind(
  query: string,
  runDir: string,
  throttle: () => Promise<void>,
  days?: number
): Promise<string[]> {
  const findDir = join(runDir, "find");
  mkdirSync(findDir, { recursive: true });

  const headers = collectAllHeaders(days);
  console.log(`Find: ${headers.length} articles to triage`);

  const formatted = headers.map(formatHeaderForFind);
  const chunkCount = chunkAndWrite(formatted, findDir, WORDS_PER_CHUNK);
  console.log(`Find: written ${chunkCount} chunks`);

  const allRelevant: string[] = [];

  async function processChunk(chunkFile: string, idx: number) {
    await throttle();
    const chunkPath = join(findDir, chunkFile);
    const chunkContent = readFileSync(chunkPath, "utf-8");

    const userPrompt = `Research query: ${query}\n\n${chunkContent}`;
    const start = performance.now();

    try {
      const result = await callClaude(FIND_SYSTEM_PROMPT, userPrompt, "haiku");
      const elapsed = ((performance.now() - start) / 1000).toFixed(1);

      const resultPath = join(findDir, `result-${idx + 1}.md`);
      writeFileSync(resultPath, result);

      const relevant: string[] = [];
      for (const line of result.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.includes("|")) continue;
        const [path, verdict] = trimmed.split("|").map((s) => s.trim());
        if (verdict === "RELEVANT") {
          relevant.push(path);
        }
      }

      allRelevant.push(...relevant);
      console.log(
        `Find chunk ${idx + 1}/${chunkCount}: ${relevant.length} relevant in ${elapsed}s`
      );
    } catch (err) {
      console.error(`Find chunk ${idx + 1} failed:`, err);
    }
  }

  const chunkFiles = Array.from({ length: chunkCount }, (_, i) => `chunk-${i + 1}.md`);

  // Process first chunk alone to prime prompt cache
  await processChunk(chunkFiles[0], 0);

  if (chunkFiles.length > 1) {
    await runPool(chunkFiles.slice(1), PARALLEL, (file, idx) =>
      processChunk(file, idx + 1)
    );
  }

  const relevantPath = join(findDir, "relevant.txt");
  writeFileSync(relevantPath, allRelevant.join("\n") + "\n");
  console.log(`Find: ${allRelevant.length} relevant articles total`);

  return allRelevant;
}

// --- Step 2: Read ---

interface ArticleForRead {
  headerPath: string;
  date: string;
  header: string;
  body: string;
}

function loadArticlesForRead(headerPaths: string[]): ArticleForRead[] {
  const articles: ArticleForRead[] = [];

  for (const headerPath of headerPaths) {
    const fullHeaderPath = join(FEEDS_DIR, headerPath);
    const mdPath = join(
      FEEDS_DIR,
      headerPath.replace("-header.yaml", ".md")
    );

    let header: string;
    try {
      header = readFileSync(fullHeaderPath, "utf-8").trim();
    } catch {
      continue;
    }

    let body = "";
    try {
      body = readFileSync(mdPath, "utf-8").trim();
    } catch {
      // header-only article
    }

    const fields = parseHeaderYaml(header);

    articles.push({
      headerPath,
      date: fields.date || "",
      header,
      body,
    });
  }

  // Sort oldest first — text order = time order
  articles.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return articles;
}

function formatArticleForRead(article: ArticleForRead): string {
  return [
    `Header: ${article.headerPath}`,
    article.header,
    "",
    article.body,
    "",
    "---",
    "",
  ].join("\n");
}

const READ_SYSTEM_PROMPT = `You are a research assistant extracting notes from articles.

You will receive full article texts and a research query.

Extract dated, sourced bullet-point notes relevant to the query.

Format each note as:
- [YYYY-MM-DD, source-slug] claim or fact

Rules:
- Only extract information relevant to the research query
- Use the article's date and source slug from the header path (the part before /)
- Be factual — extract what the article says, don't interpret or editorialize
- Include specific details: numbers, names, version numbers, concrete advice
- If an article has nothing relevant, skip it — don't force notes`;

async function stepRead(
  query: string,
  headerPaths: string[],
  runDir: string,
  throttle: () => Promise<void>
): Promise<string> {
  const readDir = join(runDir, "read");
  mkdirSync(readDir, { recursive: true });

  const articles = loadArticlesForRead(headerPaths);
  console.log(`Read: ${articles.length} articles loaded, sorted oldest-first`);

  const formatted = articles.map(formatArticleForRead);
  const chunkCount = chunkAndWrite(formatted, readDir, WORDS_PER_CHUNK);
  console.log(`Read: written ${chunkCount} chunks`);

  const chunkFiles = Array.from({ length: chunkCount }, (_, i) => `chunk-${i + 1}.md`);
  const notesByChunk: string[] = new Array(chunkCount).fill("");

  async function processChunk(chunkFile: string, idx: number) {
    await throttle();
    const chunkPath = join(readDir, chunkFile);
    const chunkContent = readFileSync(chunkPath, "utf-8");

    const userPrompt = `Research query: ${query}\n\n${chunkContent}`;
    const start = performance.now();

    try {
      const result = await callClaude(READ_SYSTEM_PROMPT, userPrompt, "haiku");
      const elapsed = ((performance.now() - start) / 1000).toFixed(1);

      const notesPath = join(readDir, `notes-${idx + 1}.md`);
      writeFileSync(notesPath, result);
      notesByChunk[idx] = result;
      console.log(
        `Read chunk ${idx + 1}/${chunkCount}: ${wordCount(result)} words in ${elapsed}s`
      );
    } catch (err) {
      console.error(`Read chunk ${idx + 1} failed:`, err);
    }
  }

  await processChunk(chunkFiles[0], 0);

  if (chunkFiles.length > 1) {
    await runPool(chunkFiles.slice(1), PARALLEL, (file, idx) =>
      processChunk(file, idx + 1)
    );
  }

  return notesByChunk.filter(Boolean).join("\n");
}

// --- Step 3: Iterative Reduce ---

const REDUCE_SYSTEM_PROMPT = `You are a research assistant compressing notes.

You will receive two sets of research notes and a query. Merge them into one concise set.

Rules:
- Compress aggressively: remove hedging, filler, redundant examples
- Merge overlapping claims, keep the most recent date
- On contradiction: keep the later claim, note the change: "X is now Y (previously Z as of [date])"
- Preserve non-overlapping topics, but still compress phrasing
- Maintain the format: - [YYYY-MM-DD, source-slug] claim
- Output only the merged notes, no commentary`;

async function stepReduce(
  query: string,
  notes: string,
  runDir: string,
  throttle: () => Promise<void>
): Promise<string> {
  const reduceDir = join(runDir, "reduce");
  mkdirSync(reduceDir, { recursive: true });

  let currentNotes = notes;
  let round = 0;

  while (true) {
    const currentWords = wordCount(currentNotes);

    if (currentWords <= REDUCE_TARGET_WORDS) {
      console.log(
        `Reduce: ${currentWords} words fits in target (${REDUCE_TARGET_WORDS}), done`
      );
      break;
    }

    round++;
    const roundDir = join(reduceDir, `round-${round}`);
    mkdirSync(roundDir, { recursive: true });

    console.log(`Reduce round ${round}: ${currentWords} words`);

    // Split notes into chunks
    const noteLines = currentNotes.split("\n");
    const noteChunks: string[] = [];
    let current = "";
    let currentWordCount = 0;
    const chunkTarget = REDUCE_TARGET_WORDS; // each chunk ≈ target size

    for (const line of noteLines) {
      const lineWords = wordCount(line);
      if (currentWordCount + lineWords > chunkTarget && current) {
        noteChunks.push(current);
        current = "";
        currentWordCount = 0;
      }
      current += line + "\n";
      currentWordCount += lineWords;
    }
    if (current.trim()) {
      noteChunks.push(current);
    }

    // Pair chunks for 2-way merge
    const mergedResults: string[] = [];
    const pairs: Array<{ a: string; b?: string; idx: number }> = [];

    for (let i = 0; i < noteChunks.length; i += 2) {
      if (i + 1 < noteChunks.length) {
        pairs.push({ a: noteChunks[i], b: noteChunks[i + 1], idx: i / 2 });
      } else {
        // Odd chunk — compress solo
        pairs.push({ a: noteChunks[i], idx: i / 2 });
      }
    }

    // Pre-allocate to maintain order
    const results: string[] = new Array(pairs.length).fill("");

    async function processPair(
      pair: { a: string; b?: string; idx: number },
      _poolIdx: number
    ) {
      await throttle();
      const start = performance.now();

      let userPrompt: string;
      if (pair.b) {
        userPrompt = `Research query: ${query}\n\n=== NOTES SET A ===\n${pair.a}\n=== NOTES SET B ===\n${pair.b}`;
      } else {
        userPrompt = `Research query: ${query}\n\nCompress these notes, removing redundancy and filler while preserving all distinct claims:\n\n${pair.a}`;
      }

      try {
        const result = await callClaude(
          REDUCE_SYSTEM_PROMPT,
          userPrompt,
          "haiku"
        );
        const elapsed = ((performance.now() - start) / 1000).toFixed(1);
        results[pair.idx] = result;

        const mergedPath = join(roundDir, `merged-${pair.idx + 1}.md`);
        writeFileSync(mergedPath, result);
        console.log(
          `Reduce round ${round} pair ${pair.idx + 1}/${pairs.length}: ${wordCount(result)} words in ${elapsed}s`
        );
      } catch (err) {
        console.error(`Reduce round ${round} pair ${pair.idx + 1} failed:`, err);
        // On failure, keep original chunks
        results[pair.idx] = pair.a + (pair.b ? "\n" + pair.b : "");
      }
    }

    await processPair(pairs[0], 0);
    if (pairs.length > 1) {
      await runPool(pairs.slice(1), PARALLEL, (pair, idx) =>
        processPair(pair, idx + 1)
      );
    }

    const merged = results.join("\n");
    const mergedWords = wordCount(merged);
    const shrinkage = 1 - mergedWords / currentWords;

    console.log(
      `Reduce round ${round}: ${currentWords} → ${mergedWords} words (${(shrinkage * 100).toFixed(0)}% reduction)`
    );

    if (shrinkage < 0.5) {
      console.log("Reduce: <50% reduction, stopping (diminishing returns)");
      currentNotes = merged;
      break;
    }

    currentNotes = merged;
  }

  const finalPath = join(reduceDir, "final.md");
  writeFileSync(finalPath, currentNotes);

  return currentNotes;
}

// --- Step 4: Answer ---

const ANSWER_SYSTEM_PROMPT = `You are a research analyst answering a query based on collected research notes.

Rules:
- Answer the query directly and comprehensively using ONLY the provided notes
- Cite dates when advice or facts changed over time
- Do NOT fill gaps with outside knowledge — if the notes don't cover something, say so
- Organize the answer clearly with headings where appropriate
- When sources disagree, note the disagreement and which is more recent`;

async function stepAnswer(
  query: string,
  notes: string,
  runDir: string,
  throttle: () => Promise<void>
): Promise<string> {
  const notesWords = wordCount(notes);

  // Notes fit in one call
  if (notesWords <= WORDS_PER_CHUNK) {
    console.log(`Answer: ${notesWords} words, single call`);
    await throttle();
    const userPrompt = `Research query: ${query}\n\nResearch notes:\n${notes}`;
    const answer = await callClaude(ANSWER_SYSTEM_PROMPT, userPrompt, "sonnet");
    const answerPath = join(runDir, "answer.md");
    writeFileSync(answerPath, answer);
    return answer;
  }

  // Notes too large — chunk, get partial answers, then merge
  console.log(`Answer: ${notesWords} words, chunked approach`);

  const noteLines = notes.split("\n");
  const noteChunks: string[] = [];
  let current = "";
  let currentWordCount = 0;

  for (const line of noteLines) {
    const lineWords = wordCount(line);
    if (currentWordCount + lineWords > WORDS_PER_CHUNK && current) {
      noteChunks.push(current);
      current = "";
      currentWordCount = 0;
    }
    current += line + "\n";
    currentWordCount += lineWords;
  }
  if (current.trim()) {
    noteChunks.push(current);
  }

  const partialAnswers: string[] = new Array(noteChunks.length).fill("");

  async function processChunk(chunk: string, idx: number) {
    await throttle();
    const userPrompt = `Research query: ${query}\n\nResearch notes (part ${idx + 1} of ${noteChunks.length}):\n${chunk}`;
    const start = performance.now();

    try {
      const result = await callClaude(
        ANSWER_SYSTEM_PROMPT +
          "\n\nThis is a partial set of notes. Provide a partial answer covering what these notes address.",
        userPrompt,
        "sonnet"
      );
      const elapsed = ((performance.now() - start) / 1000).toFixed(1);
      partialAnswers[idx] = result;
      console.log(`Answer chunk ${idx + 1}/${noteChunks.length}: done in ${elapsed}s`);
    } catch (err) {
      console.error(`Answer chunk ${idx + 1} failed:`, err);
    }
  }

  await processChunk(noteChunks[0], 0);
  if (noteChunks.length > 1) {
    await runPool(noteChunks.slice(1), PARALLEL, (chunk, idx) =>
      processChunk(chunk, idx + 1)
    );
  }

  // Final merge
  console.log("Answer: merging partial answers");
  await throttle();
  const mergePrompt = `Research query: ${query}\n\nBelow are partial answers from different sections of the research notes. Merge them into one coherent, comprehensive answer.\n\n${partialAnswers.map((a, i) => `=== PARTIAL ANSWER ${i + 1} ===\n${a}`).join("\n\n")}`;
  const finalAnswer = await callClaude(ANSWER_SYSTEM_PROMPT, mergePrompt, "sonnet");

  const answerPath = join(runDir, "answer.md");
  writeFileSync(answerPath, finalAnswer);
  return finalAnswer;
}

// --- Main ---

async function main() {
  const args = process.argv.slice(2);
  let query = "";
  let days: number | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--days" && args[i + 1]) {
      days = parseInt(args[i + 1], 10);
      i++;
    } else if (!args[i].startsWith("--")) {
      query = args[i];
    }
  }

  if (!query) {
    console.error('Usage: collect research "your research question" [--days N]');
    process.exit(1);
  }

  const runId = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const runDir = join("research", runId);
  mkdirSync(runDir, { recursive: true });
  writeFileSync(join(runDir, "query.txt"), query);

  console.log(`Research: "${query}"`);
  if (days !== undefined) console.log(`Date filter: last ${days} days`);
  console.log(`Run directory: ${runDir}`);

  const throttle = makeThrottle();
  const totalStart = performance.now();

  // Step 1: Find relevant articles
  const relevant = await stepFind(query, runDir, throttle, days);

  if (relevant.length === 0) {
    console.log("No relevant articles found.");
    return;
  }

  // Step 2: Read and extract notes
  const notes = await stepRead(query, relevant, runDir, throttle);

  if (!notes.trim()) {
    console.log("No notes extracted.");
    return;
  }

  // Step 3: Reduce notes if needed
  const reducedNotes = await stepReduce(query, notes, runDir, throttle);

  // Step 4: Answer
  const answer = await stepAnswer(query, reducedNotes, runDir, throttle);

  const totalElapsed = ((performance.now() - totalStart) / 1000).toFixed(1);
  console.log(`\nDone in ${totalElapsed}s\n`);
  console.log(answer);
}

export { main };

if (process.argv[1]?.includes("research")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
