import { existsSync } from "node:fs";
import { join } from "node:path";
import type { AnalyzeFramesInput, AnalyzeFramesResult } from "../types.js";

/**
 * Placeholder vision analysis entry point.
 *
 * Plug in Claude / OpenAI / Gemini here by:
 * 1. Reading PNGs from `input.framesDir` + `input.frames[].filename`
 * 2. Calling your provider SDK / HTTP API
 * 3. Returning structured notes per frame
 *
 * This stub only validates files exist and returns a dry-run summary.
 */
export async function analyzeFrames(input: AnalyzeFramesInput): Promise<AnalyzeFramesResult> {
  const missing: string[] = [];
  for (const frame of input.frames) {
    const path = join(input.framesDir, frame.filename);
    if (!existsSync(path)) missing.push(frame.filename);
  }

  if (missing.length > 0) {
    return {
      ok: false,
      provider: "stub",
      summary: `Missing frame files: ${missing.join(", ")}`,
    };
  }

  const perFrame = input.frames.map((frame) => ({
    filename: frame.filename,
    notes:
      `[stub] Would send ${frame.filename} (t=${frame.timestamp ?? "?"}) to a vision model. ` +
      `Prompt: ${input.prompt.slice(0, 80)}${input.prompt.length > 80 ? "…" : ""}`,
  }));

  return {
    ok: true,
    provider: "stub",
    summary:
      `Dry-run analysis of ${input.frames.length} frame(s) from ${input.sourceUrl}. ` +
      `Replace analyzeFrames() with a real vision API call.`,
    perFrame,
    raw: { stub: true, prompt: input.prompt },
  };
}

/**
 * Example wiring for a future Claude Messages API call (not executed).
 *
 * import Anthropic from "@anthropic-ai/sdk";
 * const client = new Anthropic();
 * const response = await client.messages.create({ ... });
 */
export const PROVIDER_HOOK_DOCS = `
To plug in a real provider:
  - Claude:  @anthropic-ai/sdk  messages.create with image content blocks
  - OpenAI:  openai package      chat.completions / responses with image_url
  - Gemini:  @google/generative-ai  generateContent with inlineData
`.trim();
