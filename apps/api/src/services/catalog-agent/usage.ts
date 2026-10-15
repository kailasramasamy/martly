import type Anthropic from "@anthropic-ai/sdk";

// USD per million tokens. Claude Haiku 5.5 is list price; the image model's rates are gpt-image-1's, an estimate for flare.
const HAIKU = { input: 0.1, cacheWrite: 0.125, cacheRead: 0.01, output: 0.5 };
const IMAGE = { textIn: 5, imageIn: 10, imageOut: 40 };

export interface UsageEntry {
  step: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  usd: number;
}

export function claudeUsage(step: string, model: string, usage: Anthropic.Beta.BetaUsage): UsageEntry {
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const usd = (usage.input_tokens * HAIKU.input + cacheWrite * HAIKU.cacheWrite + cacheRead * HAIKU.cacheRead + usage.output_tokens * HAIKU.output) / 1e6;
  return { step, model, inputTokens: usage.input_tokens + cacheWrite + cacheRead, outputTokens: usage.output_tokens, usd };
}

interface ImageTokens {
  input_tokens: number;
  output_tokens: number;
  input_tokens_details?: { image_tokens?: number; text_tokens?: number };
}

export function imageUsage(step: string, model: string, usage: ImageTokens | undefined): UsageEntry {
  const imageIn = usage?.input_tokens_details?.image_tokens ?? 0;
  const textIn = usage?.input_tokens_details?.text_tokens ?? 0;
  const out = usage?.output_tokens ?? 0;
  const usd = (textIn * IMAGE.textIn + imageIn * IMAGE.imageIn + out * IMAGE.imageOut) / 1e6;
  return { step, model, inputTokens: usage?.input_tokens ?? 0, outputTokens: out, usd };
}

/** Photoroom bills per image, not per token */
export function flatUsage(step: string, model: string, usd: number): UsageEntry {
  return { step, model, inputTokens: 0, outputTokens: 0, usd };
}
