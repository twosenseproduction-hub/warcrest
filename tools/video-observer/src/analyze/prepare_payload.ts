import { readFileSync, existsSync } from "node:fs";
import { join, resolve, isAbsolute } from "node:path";
import type {
  AnalyzeFramesInput,
  AnalyzeFramesResult,
  CaptureManifest,
  FrameRecord,
  MultimodalContentPart,
  MultimodalRequestPayload,
} from "../types.js";

export function loadManifest(manifestPath: string): CaptureManifest {
  const path = isAbsolute(manifestPath) ? manifestPath : resolve(process.cwd(), manifestPath);
  if (!existsSync(path)) {
    throw new Error(`Manifest not found: ${path}`);
  }
  return JSON.parse(readFileSync(path, "utf8")) as CaptureManifest;
}

export function resolveFramesDir(manifestPath: string): string {
  const path = isAbsolute(manifestPath) ? manifestPath : resolve(process.cwd(), manifestPath);
  return resolve(path, "..");
}

/**
 * Build a provider-agnostic multimodal payload from captured frames.
 * Use --embed-base64 later if an API requires inline images.
 */
export function prepareMultimodalPayload(options: {
  manifest: CaptureManifest;
  framesDir: string;
  prompt: string;
  model?: string;
  frameIndices?: number[];
  embedBase64?: boolean;
  maxFrames?: number;
}): MultimodalRequestPayload {
  const {
    manifest,
    framesDir,
    prompt,
    model = "vision-model-placeholder",
    embedBase64 = false,
    maxFrames,
  } = options;

  let frames: FrameRecord[] = manifest.frames;
  if (options.frameIndices && options.frameIndices.length > 0) {
    const set = new Set(options.frameIndices);
    frames = frames.filter((f) => set.has(f.index));
  }
  if (typeof maxFrames === "number" && maxFrames > 0) {
    frames = frames.slice(0, maxFrames);
  }

  const content: MultimodalContentPart[] = [
    {
      type: "text",
      text:
        prompt ||
        "Describe what is visually happening across these video frames. Focus on on-screen action, UI, and scene changes.",
    },
  ];

  for (const frame of frames) {
    const imagePath = join(framesDir, frame.filename);
    const part: MultimodalContentPart = {
      type: "image",
      imagePath,
      mediaType: "image/png",
    };
    if (embedBase64) {
      if (!existsSync(imagePath)) {
        throw new Error(`Frame file missing: ${imagePath}`);
      }
      part.imageBase64 = readFileSync(imagePath).toString("base64");
    }
    content.push(part);
    content.push({
      type: "text",
      text: `Frame ${frame.index}: mediaTime=${frame.timestamp ?? "unknown"}s wallClock=${frame.wallClock}`,
    });
  }

  return {
    model,
    createdAt: new Date().toISOString(),
    sourceUrl: manifest.sourceUrl,
    frameCount: frames.length,
    messages: [{ role: "user", content }],
    providerOptions: {},
  };
}
