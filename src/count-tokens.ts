import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

const MIN_CHARS_FOR_API_COUNT = 100_000;

function loadApiKey(): string | undefined {
  return process.env.COLLECT_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY;
}

export async function countTokens(text: string, force = false): Promise<number | null> {
  if (!force && text.length < MIN_CHARS_FOR_API_COUNT) return null;

  const apiKey = loadApiKey();
  if (!apiKey) return Math.ceil(text.length / 4);

  if (!client) client = new Anthropic({ apiKey });
  const result = await client.messages.countTokens({
    model: "claude-haiku-4-5-20251001",
    messages: [{ role: "user", content: text }],
  });
  return result.input_tokens;
}
