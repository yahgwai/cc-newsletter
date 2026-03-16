import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";

let client: Anthropic | null = null;

const MIN_CHARS_FOR_API_COUNT = 100_000; // ~50K tokens at chars/2

const skipTokenCount = process.argv.includes("--skip-token-count");

function loadApiKey(): string | undefined {
  if (process.env.COLLECT_ANTHROPIC_API_KEY) return process.env.COLLECT_ANTHROPIC_API_KEY;
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  try {
    const env = readFileSync(".env", "utf-8");
    const match = env.match(/^\s*ANTHROPIC_API_KEY\s*=\s*(.+)\s*$/m);
    return match?.[1];
  } catch {
    return undefined;
  }
}

export async function countTokens(text: string, force = false): Promise<number | null> {
  if (skipTokenCount) return null;
  if (!force && text.length < MIN_CHARS_FOR_API_COUNT) return null;
  try {
    if (!client) client = new Anthropic({ apiKey: loadApiKey() });
    const result = await client.messages.countTokens({
      model: "claude-haiku-4-5-20251001",
      messages: [{ role: "user", content: text }],
    });
    return result.input_tokens;
  } catch (err) {
    throw new Error(`Token counting failed (use --skip-token-count to bypass): ${err instanceof Error ? err.message : err}`);
  }
}
