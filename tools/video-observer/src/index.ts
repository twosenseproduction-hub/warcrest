/**
 * Public module surface for programmatic use.
 * Prefer the CLI (`npm run capture`) for the prototype loop.
 */
export { loadConfig, applyCliOverrides } from "./config.js";
export { createVideoSource, YouTubeSource, GenericVideoSource } from "./sources/index.js";
export { openObservationBrowser, prepareSource } from "./capture/browser.js";
export { runCaptureLoop } from "./capture/loop.js";
export { analyzeFrames, PROVIDER_HOOK_DOCS } from "./analyze/analyze_frames.js";
export {
  loadManifest,
  prepareMultimodalPayload,
  resolveFramesDir,
} from "./analyze/prepare_payload.js";
export type * from "./types.js";
