# Headless rendering notes

The refine loop needs real WebGL2 in a headless browser, then `page.screenshot()`.

## This repo's cloud Linux environment (primary, verified)
`scripts/render_turntable.py` launches Chromium with:
```
--no-sandbox --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist
```
swiftshader's software WebGL works on Linux x86_64 and is what renders the whole game
headlessly in this repo. No GPU required. It starts a tiny `http.server` rooted at
`scripts/` (so the UMD `vendor/` + `lib/` load by relative path) and screenshots N
camera angles, optionally exporting `.glb`.

## Apple Silicon Mac
swiftshader's WebGL is **disabled on ARM** — you get `Failed to create context` / blank
frames. Force hardware GL via Metal/ANGLE instead (Chromium m112+):
```js
puppeteer.launch({ headless: 'new', args: ['--enable-gpu','--use-angle=metal','--no-sandbox'] });
```
Puppeteer ships native arm64 Chromium (no Rosetta/Xcode). Capture via
`page.screenshot({ path })`, or create the renderer with `preserveDrawingBuffer:true`
and read `renderer.domElement.toDataURL('image/png')` through `page.evaluate`.

Playwright drives the same Chromium (same flags). Since v1.49 it uses a separate
`chromium-headless-shell` — use `channel:'chromium'` + `npx playwright install --no-shell`
for true GPU WebGL. WebKit/Firefox have no headless GPU accel; Chromium only.

## Fallback: headless-gl (`gl` npm)
Native arm64 prebuilds exist for Node LTS 20/22/24 but install is fragile (ANGLE
code-signing, macOS build breakage, Node-ABI mismatches) and it's mostly WebGL1
(WebGL2 experimental; missing `texImage3D` breaks some Three paths). Use only if Chrome
is unavailable. Readback is bottom-up — flip rows before PNG-encoding with `pngjs`.

## Turntable + critique
Render front + side ortho (silhouette read), a ring of 8 angles, and a weapon close-up
(bloom check) into `renders/turn_XXX.png`. Load them all, compare to the reference,
emit a prioritized diff mapped to named params, adjust, re-render. The structured diff
is what makes the loop converge instead of wander.

## Export
In-page `GLTFExporter` (binary) is cleanest — `render_turntable.py --export path.glb`
base64s the buffer out of the page. In pure Node, `GLTFExporter` needs a `FileReader`/
`Blob` shim (the `vblob` package) per Don McCurdy's Node-export gist.
