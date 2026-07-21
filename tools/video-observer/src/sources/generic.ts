import type { Page, Locator } from "playwright";
import type { VideoSource, VideoSourceFactoryOptions } from "./types.js";

/**
 * Generic HTML5 / any-page source: navigate to a URL and capture the first <video>
 * (or full window if none). Useful for local players or future non-YouTube sources.
 */
export class GenericVideoSource implements VideoSource {
  readonly kind = "generic";
  readonly watchUrl: string;

  constructor(options: VideoSourceFactoryOptions) {
    this.watchUrl = options.urlOrId;
  }

  videoLocator(page: Page): Locator {
    return page.locator("video").first();
  }

  async prepare(page: Page): Promise<void> {
    await page.goto(this.watchUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const video = this.videoLocator(page);
    const count = await page.locator("video").count();
    if (count === 0) {
      console.warn("[generic] No <video> element found; window capture still works.");
      return;
    }
    await video.waitFor({ state: "attached", timeout: 15_000 });
    await video.evaluate(async (el) => {
      const v = el as HTMLVideoElement;
      v.muted = true;
      try {
        await v.play();
      } catch {
        // ignore
      }
    }).catch(() => undefined);
  }

  async getMediaTime(page: Page): Promise<number | null> {
    try {
      const count = await page.locator("video").count();
      if (count === 0) return null;
      return await this.videoLocator(page).evaluate((el) => {
        const v = el as HTMLVideoElement;
        return Number.isFinite(v.currentTime) ? v.currentTime : null;
      });
    } catch {
      return null;
    }
  }
}
