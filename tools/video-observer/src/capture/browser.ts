import { chromium, type Browser, type Page } from "playwright";
import type { ObserverConfig } from "../types.js";
import type { VideoSource } from "../sources/types.js";

export interface BrowserSession {
  browser: Browser;
  page: Page;
}

export async function openObservationBrowser(
  config: ObserverConfig,
): Promise<BrowserSession> {
  const browser = await chromium.launch({
    headless: config.headless,
    args: [
      "--autoplay-policy=no-user-gesture-required",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  const context = await browser.newContext({
    viewport: {
      width: config.viewport.width,
      height: config.viewport.height,
    },
    // A normal UA reduces some interstitial friction.
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "en-US",
  });

  const page = await context.newPage();
  return { browser, page };
}

export async function prepareSource(
  page: Page,
  source: VideoSource,
  startupWaitSeconds: number,
): Promise<void> {
  await source.prepare(page);
  if (startupWaitSeconds > 0) {
    await page.waitForTimeout(startupWaitSeconds * 1000);
  }
}
