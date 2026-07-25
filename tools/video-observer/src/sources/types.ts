import type { Page, Locator } from "playwright";

/**
 * Pluggable video observation target.
 * Swap YouTube for a local HTML5 player, Twitch, etc. by implementing this.
 */
export interface VideoSource {
  readonly kind: string;
  /** Canonical watch URL after normalizing input */
  readonly watchUrl: string;
  /** Navigate, dismiss overlays, start playback. */
  prepare(page: Page): Promise<void>;
  /** Best-effort locator for the primary video surface. */
  videoLocator(page: Page): Locator;
  /** Current media time in seconds, or null if unknown. */
  getMediaTime(page: Page): Promise<number | null>;
}

export interface VideoSourceFactoryOptions {
  urlOrId: string;
}
