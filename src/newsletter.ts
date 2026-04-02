import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  existsSync,
  unlinkSync,
  rmSync,
} from "fs";
import { join } from "path";
import { marked } from "marked";
import { spawn } from "child_process";
import { recentHeaders } from "./recent-headers.js";
import { prepare } from "./prepare-articles.js";
import { extractIncludes } from "./extract-includes.js";
import { chunkHeaders } from "./chunk-headers.js";
import { chunkArticles } from "./chunk-articles.js";
import { countTokens } from "./count-tokens.js";
import { loadEmailConfig, sendNewsletter } from "./send-email.js";

const PARALLEL = 10;
const REQUEST_INTERVAL_MS = 2500;
const CALL_TIMEOUT_MS = 600_000;

async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  label?: string
): Promise<string> {
  const fullText = systemPrompt + "\n" + userPrompt;
  const tokens = await countTokens(fullText, true);
  if (tokens != null) {
    const tag = label ? ` [${label}]` : "";
    console.error(`      ${tag} ${tokens.toLocaleString()} input tokens`);
  }

  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.CLAUDECODE;

    const proc = spawn(
      "claude",
      ["-p", "--model", model, "--allowedTools", "", "--system-prompt", systemPrompt + NO_TOOLS],
      { stdio: ["pipe", "pipe", "pipe"], env }
    );

    const timer = setTimeout(() => {
      proc.kill();
      const detail = stderr || stdout.slice(0, 1000) || "(no output)";
      reject(new Error(`claude timed out after ${CALL_TIMEOUT_MS / 1000}s: ${detail}`));
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

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`claude failed to spawn: ${err.message}`));
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const detail = stderr || stdout.slice(0, 1000) || "(no output)";
        reject(new Error(`claude exited with code ${code}: ${detail}`));
        return;
      }
      resolve(stdout);
    });
  });
}

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

interface Progress {
  step: number;
  stepName: string;
  stepsTotal: number;
  chunksTotal?: number;
  chunksDone?: number;
}

function writeProgress(runDir: string, progress: Progress) {
  writeFileSync(join(runDir, "progress.json"), JSON.stringify(progress) + "\n");
}

// --- Resume helpers ---

function countFiles(dir: string, pattern: RegExp): number {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter((f) => pattern.test(f)).length;
}

function wipeFiles(dir: string, pattern: RegExp) {
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir)) {
    if (pattern.test(f)) unlinkSync(join(dir, f));
  }
}

// --- System prompts ---

const NO_TOOLS = `\n\nDo not use any tools. Do not search the web. Do not read or write files. Output your complete response as text.`;

const FILTER_SYSTEM_PROMPT = `You will receive a newsletter design document and a batch of article
headers with summaries.

Review every header and decide whether it could be relevant to any
section of the newsletter — not just Claude Code content, but also
anything that might fit in The Wider World, Security & Bugs,
Techniques, or community discussion.

Write a decision for every header using this format, separated by ---:

## Header: path/to/header.yaml
**Decision:** INCLUDE
**Reason:** Covers a new Claude Code CLI feature relevant to New Features section
---
## Header: path/to/other.yaml
**Decision:** EXCLUDE
**Reason:** Generic AI industry news, not specific enough for any section
---

This is a filtering pass — cast a wide net. When in doubt, include it.`;

const PRIORITISE_SYSTEM_PROMPT = `You will receive a newsletter design document and a batch of article
headers that passed an initial relevance filter.

Select the headers that are most worth reading in full — based on how
interesting the topic is and how credible or high-quality the source
appears.

Write a decision for every header using this format, separated by ---:

## Header: path/to/header.yaml
**Decision:** INCLUDE
**Reason:** High-quality source with concrete workflow details worth deep reading
---
## Header: path/to/other.yaml
**Decision:** EXCLUDE
**Reason:** Superficial listicle, unlikely to add substance on deeper read
---

Err on the side of including something if it looks promising.`;

const DEEP_READ_SYSTEM_PROMPT = `You will receive a newsletter design document and a batch of full
articles.

Read every article in full and write an evaluation using this format,
separated by ---:

## Header: path/to/header.yaml
**Decision:** INCLUDE or EXCLUDE
**Section:** Section Name
**Summary:** 2-3 sentences on the substance — what you actually learned
from reading it, not just the header summary
---

For articles that should NOT be included, still list them with
**Section:** N/A and a one-line summary explaining the exclusion so
the decision is auditable.

Section names: New Features, Security & Bugs, Article of the Week,
Techniques & Workflows, What Are They Talking About & What Are They
Building?, The Wider World

For articles that fit multiple sections, use semicolons:
**Section:** New Features; Security & Bugs
Put the primary section first.`;

const WRITE_SINGLE_SYSTEM_PROMPT = `You will receive a newsletter design document, evaluation notes for
all articles, and the full article texts.

Write the complete newsletter following the design doc — all sections,
in order, with citations, in the correct tone. Stay within the word
budget (max 2,500 words, ceiling 3,000).

Output only the newsletter markdown.`;

const WRITE_SECTION_SYSTEM_PROMPT_TEMPLATE = `You will receive a newsletter design document, evaluation notes for
ALL articles (so you have the big picture of the whole week), and a
chunk of articles assigned to your section.

Write only the newsletter sections that these articles map to,
following the design doc format, tone, and citation requirements. Do
not write other sections.

Section to write: {SECTION}

Output only the section markdown, starting with the section heading.`;

const ASSEMBLE_SYSTEM_PROMPT = `You will receive a newsletter design document, evaluation notes, and
section drafts written by different authors.

Assemble the complete newsletter:
1. Write The Briefing (3-4 paragraphs synthesizing across all
   sections), ending with Signal and Noise
2. Select the Hot Take quote from the source material
3. Place one code snippet, prompt pattern, config example, or tool
   invocation somewhere natural if not already present
4. Ensure the whole thing reads as one coherent voice
5. Stay within the word budget (max 2,500, ceiling 3,000)

Output the complete newsletter markdown.`;

const EDITORIAL_SYSTEM_PROMPT = `You will receive a newsletter design document and a draft newsletter.

Re-read the draft with fresh eyes. Fix factual errors, tighten prose,
cut anything that doesn't earn its place, make sure the tone is
consistent throughout.

Output in this exact format:

=== EDITORIAL CHANGES ===
Summary of changes made (factual corrections, structural changes,
prose tightening, items verified correct)

=== REVISED NEWSLETTER ===
The complete revised newsletter markdown`;

// --- Section key ↔ name mapping ---

const SECTION_NAME_MAP: Record<string, string> = {
  features: "New Features",
  security: "Security & Bugs",
  article: "Article of the Week",
  techniques: "Techniques & Workflows",
  building: "What Are They Talking About & What Are They Building?",
  wider: "The Wider World",
};

// --- Main pipeline ---

export async function newsletter(args: string[]) {
  let date = new Date().toISOString().slice(0, 10);
  let days = 7;
  let force = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--date" && args[i + 1]) {
      date = args[i + 1];
      i++;
    } else if (args[i] === "--days" && args[i + 1]) {
      days = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--force") {
      force = true;
    }
  }

  const runDir = `newsletters/${date}`;
  mkdirSync(runDir, { recursive: true });
  const designDoc = readFileSync("config/newsletter-design.md", "utf-8");
  const emailConfig = loadEmailConfig();
  const stepsTotal = emailConfig ? 9 : 8;
  const throttle = makeThrottle();
  const totalStart = performance.now();
  const draftPath = join(runDir, "draft.md");

  // Step 1: Collect recent headers
  if (!force && countFiles(runDir, /^chunk-\d+\.md$/) > 0) {
    console.error(`[1/${stepsTotal}] Collecting recent headers... skipped (cached)`);
  } else {
    console.error(`[1/${stepsTotal}] Collecting recent headers...`);
    writeProgress(runDir, { step: 1, stepName: "collect", stepsTotal });
    recentHeaders([String(days), "--date", date]);
  }

  const chunkFiles = readdirSync(runDir)
    .filter((f) => /^chunk-\d+\.md$/.test(f))
    .sort();
  console.error(`      ${chunkFiles.length} chunks`);

  if (chunkFiles.length === 0) {
    console.error("No articles found. Nothing to do.");
    return;
  }

  // Step 2: Filter for relevance
  const relevantPath = join(runDir, "relevant.txt");

  if (
    !force &&
    existsSync(relevantPath) &&
    countFiles(runDir, /^filter-\d+\.md$/) === chunkFiles.length
  ) {
    console.error(`[2/${stepsTotal}] Filtering for relevance... skipped (cached)`);
  } else {
    console.error(`[2/${stepsTotal}] Filtering for relevance...`);
    wipeFiles(runDir, /^filter-\d+\.md$/);
    if (existsSync(relevantPath)) unlinkSync(relevantPath);

    const filterResults: string[] = [];

    async function filterChunk(chunkFile: string, idx: number) {
      await throttle();
      const chunkContent = readFileSync(join(runDir, chunkFile), "utf-8");
      const userPrompt = `=== NEWSLETTER DESIGN ===\n${designDoc}\n\n=== ARTICLE HEADERS ===\n${chunkContent}`;
      const start = performance.now();

      try {
        const result = await callClaude(FILTER_SYSTEM_PROMPT, userPrompt, "opus", `filter ${idx + 1}/${chunkFiles.length}`);
        const elapsed = ((performance.now() - start) / 1000).toFixed(0);
        const outPath = join(runDir, `filter-${idx + 1}.md`);
        writeFileSync(outPath, result);
        filterResults.push(outPath);
        console.error(
          `      filter ${idx + 1}/${chunkFiles.length} ✓ (${elapsed}s)`
        );
        writeProgress(runDir, {
          step: 2,
          stepName: "filter",
          stepsTotal,
          chunksTotal: chunkFiles.length,
          chunksDone: filterResults.length,
        });
      } catch (err) {
        console.error(
          `      filter ${idx + 1}/${chunkFiles.length} ✗ ${err}`
        );
      }
    }

    await runPool(chunkFiles, PARALLEL, (file, idx) =>
      filterChunk(file, idx)
    );

    extractIncludes(relevantPath, filterResults.sort());
  }

  const relevantCount = readFileSync(relevantPath, "utf-8")
    .split("\n")
    .filter(Boolean).length;
  console.error(`      ${relevantCount} included → relevant.txt`);

  if (relevantCount === 0) {
    console.error("No relevant articles after filtering. Nothing to do.");
    return;
  }

  // Step 3: Prioritise for deep reading
  const prioritiseDir = join(runDir, "prioritise");
  const shortlistPath = join(runDir, "shortlist.txt");
  const prioritiseChunkCount = countFiles(prioritiseDir, /^chunk-\d+\.md$/);
  const prioritiseResultCount = countFiles(runDir, /^prioritise-\d+\.md$/);

  if (
    !force &&
    existsSync(shortlistPath) &&
    prioritiseChunkCount > 0 &&
    prioritiseResultCount === prioritiseChunkCount
  ) {
    console.error(`[3/${stepsTotal}] Prioritising for deep reading... skipped (cached)`);
  } else {
    console.error(`[3/${stepsTotal}] Prioritising for deep reading...`);
    wipeFiles(runDir, /^prioritise-\d+\.md$/);
    if (existsSync(shortlistPath)) unlinkSync(shortlistPath);
    if (existsSync(prioritiseDir)) rmSync(prioritiseDir, { recursive: true });

    chunkHeaders(relevantPath, prioritiseDir);

    const prioritiseChunks = readdirSync(prioritiseDir)
      .filter((f) => /^chunk-\d+\.md$/.test(f))
      .sort();
    const prioritiseResults: string[] = [];

    async function prioritiseChunk(chunkFile: string, idx: number) {
      await throttle();
      const chunkContent = readFileSync(join(prioritiseDir, chunkFile), "utf-8");
      const userPrompt = `=== NEWSLETTER DESIGN ===\n${designDoc}\n\n=== ARTICLE HEADERS ===\n${chunkContent}`;
      const start = performance.now();

      try {
        const result = await callClaude(
          PRIORITISE_SYSTEM_PROMPT,
          userPrompt,
          "opus",
          `prioritise ${idx + 1}/${prioritiseChunks.length}`
        );
        const elapsed = ((performance.now() - start) / 1000).toFixed(0);
        const outPath = join(runDir, `prioritise-${idx + 1}.md`);
        writeFileSync(outPath, result);
        prioritiseResults.push(outPath);
        console.error(
          `      prioritise ${idx + 1}/${prioritiseChunks.length} ✓ (${elapsed}s)`
        );
        writeProgress(runDir, {
          step: 3,
          stepName: "prioritise",
          stepsTotal,
          chunksTotal: prioritiseChunks.length,
          chunksDone: prioritiseResults.length,
        });
      } catch (err) {
        console.error(
          `      prioritise ${idx + 1}/${prioritiseChunks.length} ✗ ${err}`
        );
      }
    }

    await runPool(prioritiseChunks, PARALLEL, (file, idx) =>
      prioritiseChunk(file, idx)
    );

    extractIncludes(shortlistPath, prioritiseResults.sort());
  }

  const shortlistCount = readFileSync(shortlistPath, "utf-8")
    .split("\n")
    .filter(Boolean).length;
  console.error(`      ${shortlistCount} shortlisted → shortlist.txt`);

  if (shortlistCount === 0) {
    console.error("No articles shortlisted. Nothing to do.");
    return;
  }

  // Step 4: Deep read and evaluate
  const deepReadDir = join(runDir, "deep-read");
  const evaluationsPath = join(runDir, "evaluations.md");
  const deepReadChunkCount = countFiles(deepReadDir, /^chunk-\d+\.md$/);
  const evaluationResultCount = countFiles(runDir, /^evaluations-\d+\.md$/);

  if (
    !force &&
    existsSync(evaluationsPath) &&
    deepReadChunkCount > 0 &&
    evaluationResultCount === deepReadChunkCount
  ) {
    console.error(`[4/${stepsTotal}] Deep reading and evaluating... skipped (cached)`);
  } else {
    console.error(`[4/${stepsTotal}] Deep reading and evaluating...`);
    wipeFiles(runDir, /^evaluations-\d+\.md$/);
    if (existsSync(evaluationsPath)) unlinkSync(evaluationsPath);
    if (existsSync(deepReadDir)) rmSync(deepReadDir, { recursive: true });

    chunkArticles(shortlistPath, deepReadDir);

    const deepReadChunks = readdirSync(deepReadDir)
      .filter((f) => /^chunk-\d+\.md$/.test(f))
      .sort();
    const evaluationFiles: string[] = [];

    async function deepReadChunk(chunkFile: string, idx: number) {
      await throttle();
      const chunkContent = readFileSync(join(deepReadDir, chunkFile), "utf-8");
      const userPrompt = `=== NEWSLETTER DESIGN ===\n${designDoc}\n\n=== ARTICLES ===\n${chunkContent}`;
      const start = performance.now();

      try {
        const result = await callClaude(
          DEEP_READ_SYSTEM_PROMPT,
          userPrompt,
          "opus",
          `deep-read ${idx + 1}/${deepReadChunks.length}`
        );
        const elapsed = ((performance.now() - start) / 1000).toFixed(0);
        const outPath = join(runDir, `evaluations-${idx + 1}.md`);
        writeFileSync(outPath, result);
        evaluationFiles.push(outPath);
        console.error(
          `      deep-read ${idx + 1}/${deepReadChunks.length} ✓ (${elapsed}s)`
        );
        writeProgress(runDir, {
          step: 4,
          stepName: "deep-read",
          stepsTotal,
          chunksTotal: deepReadChunks.length,
          chunksDone: evaluationFiles.length,
        });
      } catch (err) {
        console.error(
          `      deep-read ${idx + 1}/${deepReadChunks.length} ✗ ${err}`
        );
      }
    }

    await runPool(deepReadChunks, PARALLEL, (file, idx) =>
      deepReadChunk(file, idx)
    );

    const evaluationsContent = evaluationFiles
      .sort()
      .map((f) => readFileSync(f, "utf-8"))
      .join("\n---\n\n");
    writeFileSync(evaluationsPath, evaluationsContent);
    console.error(`      evaluations written → evaluations.md`);
  }

  // Step 5: Prepare article content
  const newsletterInputDir = join(runDir, "newsletter-input");
  const singleDirExists = existsSync(join(newsletterInputDir, "single"));
  const hasGroupDirs =
    existsSync(newsletterInputDir) &&
    readdirSync(newsletterInputDir, { withFileTypes: true }).some(
      (f) => f.isDirectory() && f.name.startsWith("group-")
    );

  let mode: "single" | "grouped";

  if (!force && (singleDirExists || hasGroupDirs)) {
    console.error(`[5/${stepsTotal}] Preparing article content... skipped (cached)`);
    mode = singleDirExists ? "single" : "grouped";
  } else {
    console.error(`[5/${stepsTotal}] Preparing article content...`);
    writeProgress(runDir, { step: 5, stepName: "prepare", stepsTotal });
    if (existsSync(newsletterInputDir))
      rmSync(newsletterInputDir, { recursive: true });
    const prepareResult = prepare(evaluationsPath, newsletterInputDir);
    mode = prepareResult.mode;
    console.error(
      `      ${prepareResult.mode} mode, ${prepareResult.totalWords} words`
    );
  }

  // Step 6: Write the newsletter
  const newsletterPath = join(runDir, "newsletter.md");
  const evaluations = readFileSync(evaluationsPath, "utf-8");

  if (!force && existsSync(draftPath)) {
    console.error(`[6/${stepsTotal}] Writing newsletter... skipped (cached)`);
  } else if (mode === "single") {
    console.error(`[6/${stepsTotal}] Writing newsletter...`);
    writeProgress(runDir, { step: 6, stepName: "write", stepsTotal });

    const singleDir = join(newsletterInputDir, "single");
    const articleChunks = readdirSync(singleDir)
      .filter((f) => /^chunk-\d+\.md$/.test(f))
      .sort();
    const articlesContent = articleChunks
      .map((f) => readFileSync(join(singleDir, f), "utf-8"))
      .join("\n");

    const userPrompt = `=== NEWSLETTER DESIGN ===\n${designDoc}\n\n=== EVALUATIONS ===\n${evaluations}\n\n=== ARTICLES ===\n${articlesContent}`;
    await throttle();
    const start = performance.now();
    const result = await callClaude(
      WRITE_SINGLE_SYSTEM_PROMPT,
      userPrompt,
      "opus",
      "write-single"
    );
    const elapsed = ((performance.now() - start) / 1000).toFixed(0);
    writeFileSync(draftPath, result);
    console.error(`      written in ${elapsed}s → ${draftPath}`);
  } else {
    // Grouped mode
    console.error(`[6/${stepsTotal}] Writing newsletter...`);
    writeProgress(runDir, { step: 6, stepName: "write", stepsTotal });

    const groupDirs = readdirSync(newsletterInputDir, { withFileTypes: true })
      .filter((f) => f.isDirectory() && f.name.startsWith("group-"))
      .map((f) => f.name)
      .sort();

    interface SectionTask {
      key: string;
      sectionName: string;
      chunkFile: string;
      chunkIndex: number;
      totalChunks: number;
    }

    const tasks: SectionTask[] = [];
    for (const groupDir of groupDirs) {
      const key = groupDir.replace("group-", "");
      const sectionName = SECTION_NAME_MAP[key] || key;
      const groupPath = join(newsletterInputDir, groupDir);
      const groupChunks = readdirSync(groupPath)
        .filter((f) => /^chunk-\d+\.md$/.test(f))
        .sort();
      for (let i = 0; i < groupChunks.length; i++) {
        tasks.push({
          key,
          sectionName,
          chunkFile: join(groupPath, groupChunks[i]),
          chunkIndex: i,
          totalChunks: groupChunks.length,
        });
      }
    }

    // Derive expected section files from tasks
    const expectedSections = tasks.map((task) => {
      const suffix = task.totalChunks > 1 ? `-${task.chunkIndex + 1}` : "";
      return `section-${task.key}${suffix}.md`;
    });
    const allSectionsExist = expectedSections.every((f) =>
      existsSync(join(runDir, f))
    );

    if (force || !allSectionsExist) {
      wipeFiles(runDir, /^section-.*\.md$/);

      async function writeSectionDraft(task: SectionTask) {
        await throttle();
        const chunkContent = readFileSync(task.chunkFile, "utf-8");
        const systemPrompt = WRITE_SECTION_SYSTEM_PROMPT_TEMPLATE.replace(
          "{SECTION}",
          task.sectionName
        );
        const userPrompt = `=== NEWSLETTER DESIGN ===\n${designDoc}\n\n=== EVALUATIONS ===\n${evaluations}\n\n=== ARTICLES ===\n${chunkContent}`;
        const start = performance.now();

        const result = await callClaude(systemPrompt, userPrompt, "opus", `section ${task.key} ${task.chunkIndex + 1}/${task.totalChunks}`);
        const elapsed = ((performance.now() - start) / 1000).toFixed(0);

        const suffix = task.totalChunks > 1 ? `-${task.chunkIndex + 1}` : "";
        const outPath = join(runDir, `section-${task.key}${suffix}.md`);
        writeFileSync(outPath, result);

        console.error(
          `      section ${task.key} chunk ${task.chunkIndex + 1}/${task.totalChunks} ✓ (${elapsed}s)`
        );
      }

      await runPool(tasks, PARALLEL, (task) => writeSectionDraft(task));
    } else {
      console.error(`      section drafts cached, skipping to assembly`);
    }

    // Assembly
    console.error(`      assembling...`);
    const sectionDraftFiles = readdirSync(runDir)
      .filter((f) => f.startsWith("section-") && f.endsWith(".md"))
      .sort();
    const draftsContent = sectionDraftFiles
      .map((f) => `=== ${f} ===\n${readFileSync(join(runDir, f), "utf-8")}`)
      .join("\n\n");

    const assemblePrompt = `=== NEWSLETTER DESIGN ===\n${designDoc}\n\n=== EVALUATIONS ===\n${evaluations}\n\n=== SECTION DRAFTS ===\n${draftsContent}`;
    await throttle();
    const assembleStart = performance.now();
    const assembled = await callClaude(
      ASSEMBLE_SYSTEM_PROMPT,
      assemblePrompt,
      "opus",
      "assemble"
    );
    const assembleElapsed = (
      (performance.now() - assembleStart) /
      1000
    ).toFixed(0);
    writeFileSync(draftPath, assembled);
    console.error(
      `      assembled in ${assembleElapsed}s → ${draftPath}`
    );
  }

  // Step 7: Editorial pass
  if (!force && existsSync(newsletterPath)) {
    console.error(`[7/${stepsTotal}] Editorial pass... skipped (cached)`);
  } else {
    console.error(`[7/${stepsTotal}] Editorial pass...`);
    writeProgress(runDir, { step: 7, stepName: "editorial", stepsTotal });

    const draftContent = readFileSync(draftPath, "utf-8");
    const editorialPrompt = `=== NEWSLETTER DESIGN ===\n${designDoc}\n\n=== DRAFT ===\n${draftContent}`;
    await throttle();
    const editorialStart = performance.now();
    const editorialOutput = await callClaude(
      EDITORIAL_SYSTEM_PROMPT,
      editorialPrompt,
      "opus",
      "editorial"
    );
    const editorialElapsed = (
      (performance.now() - editorialStart) /
      1000
    ).toFixed(0);

    // Parse editorial output
    const revisedSplit = editorialOutput.split("=== REVISED NEWSLETTER ===");
    if (revisedSplit.length >= 2) {
      const changesSplit = revisedSplit[0].split("=== EDITORIAL CHANGES ===");
      if (changesSplit.length >= 2) {
        writeFileSync(
          join(runDir, "editorial-changes.md"),
          changesSplit[1].trim()
        );
      }
      writeFileSync(newsletterPath, revisedSplit[1].trim());
    } else {
      writeFileSync(newsletterPath, editorialOutput);
    }

    console.error(
      `      editorial pass done (${editorialElapsed}s) → ${newsletterPath}`
    );
  }

  // Step 8: Generate HTML
  const htmlPath = join(runDir, "newsletter.html");
  console.error(`[8/${stepsTotal}] Generating HTML...`);
  const finalMd = readFileSync(newsletterPath, "utf-8");
  const css = existsSync("config/style.css")
    ? readFileSync("config/style.css", "utf-8")
    : "";
  const body = await marked(finalMd);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
${css}
</style>
</head>
<body>
${body}
</body>
</html>`;
  writeFileSync(htmlPath, html);
  console.error(`      → ${htmlPath}`);

  // Step 9: Send email (only when config/email.json exists)
  if (emailConfig) {
    console.error(`[9/${stepsTotal}] Sending email...`);
    writeProgress(runDir, { step: 9, stepName: "email", stepsTotal });
    try {
      await sendNewsletter(emailConfig, htmlPath, date);
      console.error(`      sent to ${emailConfig.to.length} recipient(s)`);
    } catch (err) {
      console.error(`      email failed: ${err}`);
      console.error(`      (newsletter saved to ${htmlPath})`);
    }
  }

  writeProgress(runDir, { step: stepsTotal, stepName: "done", stepsTotal });

  const totalElapsed = ((performance.now() - totalStart) / 1000).toFixed(0);
  console.error(`\nDone in ${totalElapsed}s → ${newsletterPath}`);
}
