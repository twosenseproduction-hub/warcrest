import { readFileSync, existsSync } from "node:fs";
import { resolve, isAbsolute } from "node:path";
import type { ObserverConfig, CaptureRegionMode, VideoSourceKind } from "./types.js";

const DEFAULTS: ObserverConfig = {
  source: "youtube",
  url: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
  intervalSeconds: 2,
  outputDir: "./output/captures",
  maxFrames: 5,
  captureRegion: "video",
  headless: false,
  viewport: { width: 1280, height: 720 },
  startupWaitSeconds: 3,
  playTimeoutSeconds: 30,
};

function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.toLowerCase();
    if (v === "true" || v === "1") return true;
    if (v === "false" || v === "0") return false;
  }
  return fallback;
}

function asNumber(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asRegion(value: unknown, fallback: CaptureRegionMode): CaptureRegionMode {
  if (value === "video" || value === "window") return value;
  return fallback;
}

function asSource(value: unknown, fallback: VideoSourceKind): VideoSourceKind {
  if (value === "youtube" || value === "generic") return value;
  return fallback;
}

export function loadConfig(configPath?: string): ObserverConfig {
  const path = configPath
    ? isAbsolute(configPath)
      ? configPath
      : resolve(process.cwd(), configPath)
    : resolve(process.cwd(), "config/default.json");

  let file: Partial<ObserverConfig> = {};
  if (existsSync(path)) {
    file = JSON.parse(readFileSync(path, "utf8")) as Partial<ObserverConfig>;
  } else if (configPath) {
    throw new Error(`Config file not found: ${path}`);
  }

  const outputDir = file.outputDir ?? DEFAULTS.outputDir;

  return {
    source: asSource(file.source, DEFAULTS.source),
    url: String(file.url ?? DEFAULTS.url),
    intervalSeconds: asNumber(file.intervalSeconds, DEFAULTS.intervalSeconds),
    outputDir: isAbsolute(outputDir) ? outputDir : resolve(process.cwd(), outputDir),
    maxFrames: asNumber(file.maxFrames, DEFAULTS.maxFrames),
    captureRegion: asRegion(file.captureRegion, DEFAULTS.captureRegion),
    headless: asBool(file.headless, DEFAULTS.headless),
    viewport: {
      width: asNumber(file.viewport?.width, DEFAULTS.viewport.width),
      height: asNumber(file.viewport?.height, DEFAULTS.viewport.height),
    },
    startupWaitSeconds: asNumber(file.startupWaitSeconds, DEFAULTS.startupWaitSeconds),
    playTimeoutSeconds: asNumber(file.playTimeoutSeconds, DEFAULTS.playTimeoutSeconds),
  };
}

/** CLI overrides applied on top of a loaded config. */
export function applyCliOverrides(
  config: ObserverConfig,
  overrides: Record<string, string | undefined>,
): ObserverConfig {
  const next = { ...config, viewport: { ...config.viewport } };

  if (overrides.url) next.url = overrides.url;
  if (overrides.source) next.source = asSource(overrides.source, next.source);
  if (overrides.interval) next.intervalSeconds = asNumber(overrides.interval, next.intervalSeconds);
  if (overrides.output) {
    next.outputDir = isAbsolute(overrides.output)
      ? overrides.output
      : resolve(process.cwd(), overrides.output);
  }
  if (overrides.maxFrames) next.maxFrames = asNumber(overrides.maxFrames, next.maxFrames);
  if (overrides.region) next.captureRegion = asRegion(overrides.region, next.captureRegion);
  if (overrides.headless !== undefined) next.headless = asBool(overrides.headless, next.headless);

  return next;
}
