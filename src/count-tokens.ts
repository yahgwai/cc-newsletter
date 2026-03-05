import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

const MIN_CHARS_FOR_API_COUNT = 100_000; // ~50K tokens at chars/2

const skipTokenCount = process.argv.includes("--skip-token-count");

export async function countTokens(text: string): Promise<number | null> {
  if (skipTokenCount) return null;
  if (text.length < MIN_CHARS_FOR_API_COUNT) return null;
  try {
    if (!client) client = new Anthropic();
    const result = await client.messages.countTokens({
      model: "claude-haiku-4-5-20251001",
      messages: [{ role: "user", content: text }],
    });
    return result.input_tokens;
  } catch (err) {
    throw new Error(`Token counting failed (use --skip-token-count to bypass): ${err instanceof Error ? err.message : err}`);
  }
}
