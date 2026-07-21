import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "playwright";
import type { ObserverConfig, CaptureRegionBox, FrameRecord } from "../types.js";
import type { VideoSource } from "../sources/types.js";
import {
  appendFrame,
  createManifest,
  finalizeManifest,
  frameFilename,
  writeManifest,
} from "./manifest.js";

export interface CaptureLoopResult {
  outputDir: string;
  manifestPath: string;
  frameCount: number;
}

async function resolveCaptureClip(
  page: Page,
  source: VideoSource,
  mode: ObserverConfig["captureRegion"],
): Promise<{ clip?: CaptureRegionBox; regionMeta: FrameRecord["captureRegion"] }> {
  if (mode === "window") {
    return { regionMeta: "window" };
  }

  try {
    const video = source.videoLocator(page);
    await video.waitFor({ state: "visible", timeout: 5000 });
    const box = await video.boundingBox();
    if (box && box.width > 8 && box.height > 8) {
      const clip: CaptureRegionBox = {
        x: Math.max(0, Math.floor(box.x)),
        y: Math.max(0, Math.floor(box.y)),
        width: Math.floor(box.width),
        height: Math.floor(box.height),
      };
      return { clip, regionMeta: clip };
    }
  } catch {
    // fall through
  }

  console.warn("[capture] Video region unavailable; falling back to full window.");
  return { regionMeta: "window" };
}

/**
 * Timed screenshot loop against the prepared observation page.
 * Prefer element/region clip; fall back to full-page window capture.
 */
export async function runCaptureLoop(
  page: Page,
  source: VideoSource,
  config: ObserverConfig,
): Promise<CaptureLoopResult> {
  mkdirSync(config.outputDir, { recursive: true });

  const manifest = createManifest(config, source.watchUrl, source.kind);
  writeManifest(config.outputDir, manifest);

  const intervalMs = Math.max(0.2, config.intervalSeconds) * 1000;

  for (let i = 0; i < config.maxFrames; i++) {
    const { clip, regionMeta } = await resolveCaptureClip(page, source, config.captureRegion);
    const filename = frameFilename(i);
    const filePath = join(config.outputDir, filename);
    const mediaTime = await source.getMediaTime(page);

    try {
      if (clip) {
        await page.screenshot({ path: filePath, type: "png", clip, animations: "disabled" });
      } else {
        // Prefer element screenshot when possible for "video" mode without a clip.
        if (config.captureRegion === "video") {
          try {
            await source.videoLocator(page).screenshot({ path: filePath, type: "png", animations: "disabled" });
          } catch {
            await page.screenshot({ path: filePath, type: "png", animations: "disabled" });
          }
        } else {
          await page.screenshot({ path: filePath, type: "png", animations: "disabled" });
        }
      }
    } catch (err) {
      console.warn(`[capture] Region/element screenshot failed (${String(err)}); retrying full window.`);
      await page.screenshot({ path: filePath, type: "png", animations: "disabled" });
    }

    const frame: FrameRecord = {
      index: i,
      filename,
      timestamp: mediaTime,
      wallClock: new Date().toISOString(),
      sourceUrl: source.watchUrl,
      captureRegion: regionMeta,
    };
    appendFrame(manifest, frame);
    writeManifest(config.outputDir, manifest);

    console.log(
      `[capture] ${i + 1}/${config.maxFrames} -> ${filename}` +
        (mediaTime != null ? ` @ ${mediaTime.toFixed(2)}s` : ""),
    );

    if (i < config.maxFrames - 1) {
      await page.waitForTimeout(intervalMs);
    }
  }

  finalizeManifest(manifest);
  const manifestPath = writeManifest(config.outputDir, manifest);

  return {
    outputDir: config.outputDir,
    manifestPath,
    frameCount: manifest.frames.length,
  };
}
