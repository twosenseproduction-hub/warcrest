import type { VideoSourceKind } from "../types.js";
import type { VideoSource } from "./types.js";
import { YouTubeSource } from "./youtube.js";
import { GenericVideoSource } from "./generic.js";

export type { VideoSource } from "./types.js";
export { YouTubeSource, normalizeYouTubeUrl } from "./youtube.js";
export { GenericVideoSource } from "./generic.js";

export function createVideoSource(kind: VideoSourceKind, urlOrId: string): VideoSource {
  switch (kind) {
    case "youtube":
      return new YouTubeSource({ urlOrId });
    case "generic":
      return new GenericVideoSource({ urlOrId });
    default: {
      const _exhaustive: never = kind;
      throw new Error(`Unknown video source: ${_exhaustive}`);
    }
  }
}
