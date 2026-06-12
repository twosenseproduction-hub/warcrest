#!/usr/bin/env node
/**
 * Renders Sapphire Shores export PNGs + layout JSON into exports/sapphire-shores/
 * Starts a static server; the export page POSTs canvas blobs when ?auto=1
 */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'exports', 'sapphire-shores');
const PORT = 9876;

const pending = { full: false, schematic: false, json: false };

function serveStatic(root) {
  return createServer(async (req, res) => {
    if (req.method === 'POST' && req.url.startsWith('/export-save/')) {
      const name = req.url.replace('/export-save/', '').split('?')[0];
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', async () => {
        const buf = Buffer.concat(chunks);
        const allowed = {
          'sapphire-shores-full.png': 'full',
          'sapphire-shores-schematic.png': 'schematic',
          'sapphire-shores-layout.json': 'json',
        };
        if (!allowed[name]) {
          res.writeHead(400);
          res.end('bad name');
          return;
        }
        await writeFile(join(OUT, name), buf);
        pending[allowed[name]] = true;
        res.writeHead(200);
        res.end('ok');
        if (pending.full && pending.schematic && pending.json) {
          process.exit(0);
        }
      });
      return;
    }

    try {
      const path = req.url.split('?')[0] === '/' ? '/tools/sapphire-shores-export.html' : req.url.split('?')[0];
      const file = join(root, decodeURIComponent(path));
      const data = await readFile(file);
      const ext = file.split('.').pop();
      const types = { html: 'text/html', js: 'application/javascript', css: 'text/css', png: 'image/png', json: 'application/json' };
      res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const server = serveStatic(ROOT);
  server.listen(PORT, '127.0.0.1', () => {
    console.log('Open http://127.0.0.1:' + PORT + '/tools/sapphire-shores-export.html?auto=1');
    console.log('Waiting for export uploads…');
  });

  setTimeout(() => {
    console.error('Export timed out after 120s');
    process.exit(1);
  }, 120000);

  // Trigger headless fetch via node — use built-in fetch to load page won't run JS.
  // Spawn chrome to load auto page which POSTs back.
  const { spawn } = await import('node:child_process');
  const { existsSync } = await import('node:fs');
  const chrome = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ].find(existsSync);

  if (!chrome) {
    console.log('No Chrome found. Open the URL above in a browser manually.');
    return;
  }

  spawn(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--window-size=1200,800',
    '--virtual-time-budget=20000',
    'http://127.0.0.1:' + PORT + '/tools/sapphire-shores-export.html?auto=1',
  ], { stdio: 'ignore' });
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
