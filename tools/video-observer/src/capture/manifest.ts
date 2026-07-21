import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CaptureManifest, FrameRecord, ObserverConfig } from "../types.js";

export function createManifest(config: ObserverConfig, sourceUrl: string, sourceKind: string): CaptureManifest {
  return {
    version: 1,
    source: sourceKind as CaptureManifest["source"],
    sourceUrl,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    config: {
      intervalSeconds: config.intervalSeconds,
      maxFrames: config.maxFrames,
      captureRegion: config.captureRegion,
      headless: config.headless,
      viewport: { ...config.viewport },
    },
    frames: [],
  };
}

export function appendFrame(manifest: CaptureManifest, frame: FrameRecord): void {
  manifest.frames.push(frame);
}

export function finalizeManifest(manifest: CaptureManifest): void {
  manifest.finishedAt = new Date().toISOString();
}

export function writeManifest(outputDir: string, manifest: CaptureManifest): string {
  mkdirSync(outputDir, { recursive: true });
  const path = join(outputDir, "manifest.json");
  writeFileSync(path, JSON.stringify(manifest, null, 2), "utf8");
  return path;
}

export function frameFilename(index: number): string {
  return `frame_${String(index).padStart(4, "0")}.png`;
}
