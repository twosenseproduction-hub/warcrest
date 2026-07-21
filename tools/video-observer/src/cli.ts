import { writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadConfig, applyCliOverrides } from "./config.js";
import { createVideoSource } from "./sources/index.js";
import { openObservationBrowser, prepareSource } from "./capture/browser.js";
import { runCaptureLoop } from "./capture/loop.js";
import {
  loadManifest,
  prepareMultimodalPayload,
  resolveFramesDir,
} from "./analyze/prepare_payload.js";
import { analyzeFrames } from "./analyze/analyze_frames.js";

function printHelp(): void {
  console.log(`
video-observer — local AI perception loop for video frames

Usage:
  npm run capture -- [options]
  npm run prepare-payload -- --manifest <path> [options]
  npm run analyze -- --manifest <path> [options]

Capture options:
  --config <path>       Config JSON (default: config/default.json)
  --url <url|id>        YouTube URL or video ID (overrides config)
  --source <youtube|generic>
  --interval <seconds>  Capture interval
  --output <dir>        Output directory for PNGs + manifest.json
  --max-frames <n>      Maximum frames to capture
  --region <video|window>
  --headless <true|false>

Prepare-payload options:
  --manifest <path>     Path to manifest.json
  --prompt <text>       Analysis prompt
  --out <path>          Write payload JSON (default: <framesDir>/payload.json)
  --embed-base64        Inline PNG bytes as base64
  --max-frames <n>      Limit frames included in payload
  --model <name>        Model id placeholder

Analyze options:
  --manifest <path>     Path to manifest.json
  --prompt <text>       Prompt passed to analyzeFrames stub

Examples:
  npm run capture -- --url jNQXAC9IVRw --max-frames 5 --interval 2 --headless true
  npm run prepare-payload -- --manifest output/captures/manifest.json
  npm run analyze -- --manifest output/captures/manifest.json
`.trim());
}

function parseArgs(argv: string[]): { command: string; flags: Record<string, string | undefined> } {
  const [command = "help", ...rest] = argv;
  const flags: Record<string, string | undefined> = {};
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = rest[i + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = "true";
    } else {
      flags[key] = next;
      i++;
    }
  }
  return { command, flags };
}

async function cmdCapture(flags: Record<string, string | undefined>): Promise<void> {
  const base = loadConfig(flags.config);
  const config = applyCliOverrides(base, {
    url: flags.url,
    source: flags.source,
    interval: flags.interval,
    output: flags.output,
    maxFrames: flags["max-frames"],
    region: flags.region,
    headless: flags.headless,
  });

  console.log("[capture] config:", {
    source: config.source,
    url: config.url,
    intervalSeconds: config.intervalSeconds,
    outputDir: config.outputDir,
    maxFrames: config.maxFrames,
    captureRegion: config.captureRegion,
    headless: config.headless,
  });

  const source = createVideoSource(config.source, config.url);
  const session = await openObservationBrowser(config);

  try {
    console.log(`[capture] opening ${source.watchUrl}`);
    await prepareSource(session.page, source, config.startupWaitSeconds);
    const result = await runCaptureLoop(session.page, source, config);
    console.log(`[capture] done: ${result.frameCount} frames`);
    console.log(`[capture] manifest: ${result.manifestPath}`);
  } finally {
    await session.browser.close();
  }
}

async function cmdPreparePayload(flags: Record<string, string | undefined>): Promise<void> {
  if (!flags.manifest) {
    throw new Error("--manifest is required");
  }
  const manifest = loadManifest(flags.manifest);
  const framesDir = resolveFramesDir(flags.manifest);
  const payload = prepareMultimodalPayload({
    manifest,
    framesDir,
    prompt:
      flags.prompt ||
      "Describe what is visually happening across these video frames. Focus on on-screen action, UI, and scene changes.",
    model: flags.model,
    embedBase64: flags["embed-base64"] === "true",
    maxFrames: flags["max-frames"] ? Number(flags["max-frames"]) : undefined,
  });

  const outPath = flags.out
    ? resolve(process.cwd(), flags.out)
    : join(framesDir, "payload.json");
  mkdirSync(resolve(outPath, ".."), { recursive: true });
  writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`[prepare-payload] wrote ${outPath} (${payload.frameCount} frames)`);
}

async function cmdAnalyze(flags: Record<string, string | undefined>): Promise<void> {
  if (!flags.manifest) {
    throw new Error("--manifest is required");
  }
  const manifest = loadManifest(flags.manifest);
  const framesDir = resolveFramesDir(flags.manifest);
  const prompt =
    flags.prompt ||
    "Describe what is visually happening across these video frames.";

  const result = await analyzeFrames({
    frames: manifest.frames,
    framesDir,
    prompt,
    sourceUrl: manifest.sourceUrl,
  });

  console.log(JSON.stringify(result, null, 2));
}

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv.slice(2));
  if (command === "help" || flags.help === "true" || flags.h === "true") {
    printHelp();
    return;
  }

  switch (command) {
    case "capture":
      await cmdCapture(flags);
      break;
    case "prepare-payload":
      await cmdPreparePayload(flags);
      break;
    case "analyze":
      await cmdAnalyze(flags);
      break;
    default:
      printHelp();
      throw new Error(`Unknown command: ${command}`);
  }
}

main().catch((err) => {
  console.error("[video-observer]", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
