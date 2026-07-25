# Video Observer (local AI perception loop)

Local prototype so an **AI agent can visually observe a playing video** by capturing screenshots/frames, storing them with metadata, and preparing a multimodal analysis payload.

This is **not** a user-facing YouTube player. The browser window is an observation surface for a computer-use style perception loop.

## Architecture

1. **Config** (`config/default.json`) — YouTube URL/ID, interval, output dir, max frames, capture region (`video` | `window`).
2. **Video source adapter** (`src/sources/`) — `youtube` opens `youtube.com/watch`; `generic` opens any URL with a `<video>` (swap later for other hosts).
3. **Observation browser** — Playwright Chromium launches a controlled window (headed by default) and starts muted playback.
4. **Capture loop** — Screenshots at a fixed interval as PNG; prefers the video element bounding box, falls back to full window.
5. **Manifest** — `manifest.json` lists each frame filename, media timestamp, wall-clock time, source URL, and capture region.
6. **Prepare payload** — Builds a provider-agnostic multimodal request structure from selected frames.
7. **`analyze_frames` stub** — Dry-run hook where you later plug Claude / OpenAI / Gemini vision APIs.
8. **Modular boundary** — Only the source adapter knows about YouTube; capture + analyze stay source-agnostic.

## Constraints (read before running)

- **YouTube embeds vs watch page**: iframe embeds are fragile (origin restrictions, player chrome). This prototype navigates to the normal watch URL in Chromium instead.
- **Screenshot restrictions**: Some DRM / protected media paths can blank video pixels. Playwright usually captures compositor output for normal YouTube HTML5 playback; if a capture is black, set `"captureRegion": "window"` or try headed mode.
- **Consent / ads / autoplay**: Regional cookie banners and ads can delay playback. The YouTube adapter dismisses common overlays and forces muted `play()`.
- **Bot / automation signals**: YouTube may show interstitials. Headed mode (`headless: false`) is more reliable for a local prototype.
- **Not for transcripts**: No caption scraping; perception is visual frames only.
- **ToS**: Use only for personal/local experimentation with content you are allowed to access.

## Setup

From this directory:

```bash
cd tools/video-observer
npm install
npx playwright install chromium
```

Requires Node.js 18+.

## Config

Edit `config/default.json`:

```json
{
  "source": "youtube",
  "url": "https://www.youtube.com/watch?v=jNQXAC9IVRw",
  "intervalSeconds": 2,
  "outputDir": "./output/captures",
  "maxFrames": 5,
  "captureRegion": "video",
  "headless": false,
  "viewport": { "width": 1280, "height": 720 },
  "startupWaitSeconds": 3,
  "playTimeoutSeconds": 30
}
```

| Field | Meaning |
| --- | --- |
| `url` | Full YouTube URL or bare video ID |
| `intervalSeconds` | Seconds between PNG captures |
| `outputDir` | Where frames + `manifest.json` are written |
| `maxFrames` | Stop after N frames |
| `captureRegion` | `video` = player region; `window` = full viewport |
| `headless` | `false` shows the observation browser |
| `source` | `youtube` or `generic` |

## Usage

### 1. Capture frames from a test video

Me at the zoo (short public test clip):

```bash
cd tools/video-observer
npm run capture -- --url jNQXAC9IVRw --max-frames 5 --interval 2 --headless true --region video
```

Or with the default config file:

```bash
npm run capture
```

Output:

```
output/captures/
  frame_0000.png
  frame_0001.png
  ...
  manifest.json
```

### 2. Prepare a multimodal payload

```bash
npm run prepare-payload -- --manifest output/captures/manifest.json --prompt "What is happening on screen?"
```

Writes `output/captures/payload.json`. Add `--embed-base64` to inline PNG bytes for APIs that need base64.

### 3. Run the analysis stub

```bash
npm run analyze -- --manifest output/captures/manifest.json
```

Returns a dry-run JSON summary. Implement a real provider inside `src/analyze/analyze_frames.ts`.

## Sample manifest entry

```json
{
  "index": 0,
  "filename": "frame_0000.png",
  "timestamp": 1.42,
  "wallClock": "2026-07-21T15:30:00.000Z",
  "sourceUrl": "https://www.youtube.com/watch?v=jNQXAC9IVRw",
  "captureRegion": { "x": 0, "y": 56, "width": 1280, "height": 720 }
}
```

## Replacing YouTube later

1. Add a new class under `src/sources/` implementing `VideoSource`.
2. Register it in `src/sources/index.ts` and extend `VideoSourceKind` in `src/types.ts`.
3. Point config `"source"` at the new kind and set `"url"` to the watch page or local player URL.

Capture, manifest, payload, and `analyze_frames` do not need YouTube-specific changes.

## Project layout

```
tools/video-observer/
  config/default.json
  src/
    cli.ts
    config.ts
    types.ts
    sources/          # youtube | generic adapters
    capture/          # browser + loop + manifest
    analyze/          # prepare_payload + analyze_frames stub
  output/             # gitignored captures
  README.md
```

## Programmatic use

```ts
import {
  loadConfig,
  createVideoSource,
  openObservationBrowser,
  prepareSource,
  runCaptureLoop,
} from "./src/index.ts";

const config = loadConfig();
const source = createVideoSource(config.source, config.url);
const { browser, page } = await openObservationBrowser(config);
await prepareSource(page, source, config.startupWaitSeconds);
await runCaptureLoop(page, source, config);
await browser.close();
```
