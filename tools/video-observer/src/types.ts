/** Shared types for the video observation prototype. */

export type CaptureRegionMode = "video" | "window";

export type VideoSourceKind = "youtube" | "generic";

export interface ViewportConfig {
  width: number;
  height: number;
}

export interface ObserverConfig {
  /** Source adapter key. Default: youtube */
  source: VideoSourceKind;
  /** Full URL or YouTube video ID */
  url: string;
  /** Seconds between frame captures */
  intervalSeconds: number;
  /** Directory for PNG frames + manifest.json */
  outputDir: string;
  /** Stop after this many frames */
  maxFrames: number;
  /** Capture only the video element box, or the full browser window */
  captureRegion: CaptureRegionMode;
  /** Run Chromium headless (false = visible observation window) */
  headless: boolean;
  viewport: ViewportConfig;
  /** Extra settle time after navigation before forcing play */
  startupWaitSeconds: number;
  /** Max wait for video playback to start */
  playTimeoutSeconds: number;
}

export interface CaptureRegionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FrameRecord {
  index: number;
  filename: string;
  /** Approximate media time in seconds when known, else null */
  timestamp: number | null;
  /** ISO wall-clock time of capture */
  wallClock: string;
  sourceUrl: string;
  captureRegion: CaptureRegionMode | CaptureRegionBox;
}

export interface CaptureManifest {
  version: 1;
  source: VideoSourceKind;
  sourceUrl: string;
  startedAt: string;
  finishedAt: string | null;
  config: {
    intervalSeconds: number;
    maxFrames: number;
    captureRegion: CaptureRegionMode;
    headless: boolean;
    viewport: ViewportConfig;
  };
  frames: FrameRecord[];
}

/** Multimodal request payload ready for a vision API adapter. */
export interface MultimodalContentPart {
  type: "text" | "image";
  text?: string;
  /** Absolute or relative path to a local PNG */
  imagePath?: string;
  /** Optional base64 (filled by prepare-payload when --embed-base64) */
  imageBase64?: string;
  mediaType?: "image/png";
}

export interface MultimodalRequestPayload {
  model: string;
  createdAt: string;
  sourceUrl: string;
  frameCount: number;
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: MultimodalContentPart[];
  }>;
  /** Provider-specific hook; left empty for the stub */
  providerOptions: Record<string, unknown>;
}

export interface AnalyzeFramesInput {
  frames: FrameRecord[];
  framesDir: string;
  prompt: string;
  sourceUrl: string;
}

export interface AnalyzeFramesResult {
  ok: boolean;
  provider: string;
  summary: string;
  perFrame?: Array<{ filename: string; notes: string }>;
  raw?: unknown;
}
