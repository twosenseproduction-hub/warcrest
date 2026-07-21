import type { Page, Locator } from "playwright";
import type { VideoSource, VideoSourceFactoryOptions } from "./types.js";

/** Normalize a YouTube URL or bare video ID into a watch URL. */
export function normalizeYouTubeUrl(urlOrId: string): string {
  const raw = urlOrId.trim();
  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      if (u.hostname.includes("youtu.be")) {
        const id = u.pathname.replace(/^\//, "").split("/")[0];
        if (id) return `https://www.youtube.com/watch?v=${id}`;
      }
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/watch?v=${v}`;
      // Shorts / embed paths
      const m = u.pathname.match(/\/(embed|shorts|live)\/([^/?#]+)/);
      if (m?.[2]) return `https://www.youtube.com/watch?v=${m[2]}`;
      return raw;
    } catch {
      return raw;
    }
  }
  // Bare ID
  if (/^[\w-]{6,}$/.test(raw)) {
    return `https://www.youtube.com/watch?v=${raw}`;
  }
  return raw;
}

/**
 * Observes youtube.com/watch in a real Chromium window (not an iframe embed).
 * Direct navigation is more reliable than embed APIs for screenshot capture.
 */
export class YouTubeSource implements VideoSource {
  readonly kind = "youtube";
  readonly watchUrl: string;

  constructor(options: VideoSourceFactoryOptions) {
    this.watchUrl = normalizeYouTubeUrl(options.urlOrId);
  }

  videoLocator(page: Page): Locator {
    // Prefer the main player video; fall back to any video element.
    return page.locator("video.html5-main-video, #movie_player video, video").first();
  }

  async prepare(page: Page): Promise<void> {
    await page.goto(this.watchUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await this.dismissConsent(page);
    await this.dismissOverlays(page);
    await this.ensurePlaying(page);
  }

  async getMediaTime(page: Page): Promise<number | null> {
    try {
      const t = await this.videoLocator(page).evaluate((el) => {
        const video = el as HTMLVideoElement;
        return Number.isFinite(video.currentTime) ? video.currentTime : null;
      });
      return typeof t === "number" ? t : null;
    } catch {
      return null;
    }
  }

  private async dismissConsent(page: Page): Promise<void> {
    // YouTube / Google consent dialogs vary by region.
    const candidates = [
      'button[aria-label="Accept all"]',
      'button[aria-label="Accept the use of cookies and other data for the purposes described"]',
      'button:has-text("Accept all")',
      'button:has-text("I agree")',
      'button:has-text("Accept")',
      "form[action*='consent'] button",
    ];
    for (const sel of candidates) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 800 })) {
          await btn.click({ timeout: 2000 }).catch(() => undefined);
          await page.waitForTimeout(500);
          break;
        }
      } catch {
        // ignore
      }
    }
  }

  private async dismissOverlays(page: Page): Promise<void> {
    const dismiss = [
      "button.ytp-ad-skip-button",
      "button.ytp-ad-skip-button-modern",
      ".ytp-ad-overlay-close-button",
      'button[aria-label="No thanks"]',
      'button:has-text("No thanks")',
      'tp-yt-paper-button:has-text("Dismiss")',
    ];
    for (const sel of dismiss) {
      try {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 400 })) {
          await el.click({ timeout: 1500 }).catch(() => undefined);
        }
      } catch {
        // ignore
      }
    }
  }

  private async ensurePlaying(page: Page): Promise<void> {
    const video = this.videoLocator(page);
    await video.waitFor({ state: "attached", timeout: 30_000 });

    // Muted autoplay is the most reliable path under browser policies.
    await video.evaluate((el) => {
      const v = el as HTMLVideoElement;
      v.muted = true;
      v.volume = 0;
    }).catch(() => undefined);

    // Click the big play button / player if still paused.
    const playButton = page.locator("button.ytp-large-play-button, .ytp-play-button").first();
    try {
      if (await playButton.isVisible({ timeout: 1000 })) {
        await playButton.click({ timeout: 2000 }).catch(() => undefined);
      }
    } catch {
      // ignore
    }

    // Also click the movie player surface.
    await page.locator("#movie_player, .html5-video-player").first().click({ timeout: 2000 }).catch(() => undefined);

    await video.evaluate(async (el) => {
      const v = el as HTMLVideoElement;
      v.muted = true;
      try {
        await v.play();
      } catch {
        // Gesture may still be required; caller waits on currentTime.
      }
    }).catch(() => undefined);

    // Wait until media time advances or readyState looks live.
    const deadline = Date.now() + 25_000;
    while (Date.now() < deadline) {
      await this.dismissOverlays(page);
      const state = await video
        .evaluate((el) => {
          const v = el as HTMLVideoElement;
          return {
            paused: v.paused,
            currentTime: v.currentTime,
            readyState: v.readyState,
            videoWidth: v.videoWidth,
          };
        })
        .catch(() => null);

      if (state && state.videoWidth > 0 && (state.currentTime > 0.2 || !state.paused)) {
        if (state.paused) {
          await video.evaluate((el) => (el as HTMLVideoElement).play().catch(() => undefined));
        }
        return;
      }
      await page.waitForTimeout(400);
    }

    console.warn(
      "[youtube] Playback may not have started cleanly; continuing with capture anyway.",
    );
  }
}
