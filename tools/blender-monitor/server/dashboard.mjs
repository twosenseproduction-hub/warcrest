#!/usr/bin/env node
/**
 * Lightweight Blender monitor dashboard.
 *
 * Serves:
 *   GET /              → auto-refreshing UI
 *   GET /api/status    → status.json
 *   GET /api/manifest  → manifest.json
 *   GET /api/log       → job.log tail (?tail=N)
 *   GET /previews/*    → preview PNGs
 *
 * Usage:
 *   node server/dashboard.mjs --run-dir /path/to/run --port 7788
 */
import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, "public");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const RUN_DIR = path.resolve(arg("run-dir", process.env.BLENDER_MONITOR_DIR || ""));
const PORT = Number(arg("port", process.env.BLENDER_MONITOR_PORT || "7788"));

if (!RUN_DIR) {
  console.error("Usage: dashboard.mjs --run-dir <path> [--port 7788]");
  process.exit(1);
}

await fsp.mkdir(RUN_DIR, { recursive: true });
await fsp.mkdir(path.join(RUN_DIR, "previews"), { recursive: true });

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".log": "text/plain; charset=utf-8",
};

function send(res, code, body, type = "text/plain; charset=utf-8") {
  res.writeHead(code, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(body);
}

async function readJSONSafe(file, fallback) {
  try {
    const raw = await fsp.readFile(file, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function tailFile(file, lines = 120) {
  try {
    const raw = await fsp.readFile(file, "utf8");
    const parts = raw.split(/\r?\n/);
    return parts.slice(Math.max(0, parts.length - lines)).join("\n");
  } catch {
    return "";
  }
}

function safeJoin(root, rel) {
  const resolved = path.resolve(root, rel);
  if (!resolved.startsWith(path.resolve(root) + path.sep) && resolved !== path.resolve(root)) {
    return null;
  }
  return resolved;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const p = url.pathname;

    if (p === "/" || p === "/index.html") {
      const html = await fsp.readFile(path.join(PUBLIC, "index.html"));
      return send(res, 200, html, MIME[".html"]);
    }

    if (p === "/api/status") {
      const data = await readJSONSafe(path.join(RUN_DIR, "status.json"), {
        run_id: path.basename(RUN_DIR),
        job: null,
        status: "starting",
        stage: null,
        frame: 0,
        latest_preview: null,
        preview_count: 0,
        updated_at: null,
        message: "waiting for Blender job",
        run_dir: RUN_DIR,
        agent_hint:
          "Read status.json then open latest_preview PNG under run_dir.",
      });
      return send(res, 200, JSON.stringify(data, null, 2), MIME[".json"]);
    }

    if (p === "/api/manifest") {
      const data = await readJSONSafe(path.join(RUN_DIR, "manifest.json"), {
        previews: [],
      });
      return send(res, 200, JSON.stringify(data, null, 2), MIME[".json"]);
    }

    if (p === "/api/log") {
      const n = Number(url.searchParams.get("tail") || 120);
      const text = await tailFile(path.join(RUN_DIR, "job.log"), n);
      return send(res, 200, text || "(no log yet)\n", MIME[".txt"]);
    }

    if (p === "/api/health") {
      return send(
        res,
        200,
        JSON.stringify({ ok: true, run_dir: RUN_DIR, port: PORT }),
        MIME[".json"],
      );
    }

    // Static: previews + any other file under run dir
    if (p.startsWith("/previews/") || p.startsWith("/artifacts/")) {
      const rel = decodeURIComponent(p.replace(/^\//, ""));
      const file = safeJoin(RUN_DIR, rel);
      if (!file || !fs.existsSync(file)) return send(res, 404, "not found");
      const ext = path.extname(file).toLowerCase();
      const body = await fsp.readFile(file);
      return send(res, 200, body, MIME[ext] || "application/octet-stream");
    }

    // Also allow /status.json style direct files from run dir
    if (p === "/status.json" || p === "/manifest.json" || p === "/job.log") {
      const file = path.join(RUN_DIR, p.slice(1));
      if (!fs.existsSync(file)) return send(res, 404, "not found");
      const ext = path.extname(file).toLowerCase();
      const body = await fsp.readFile(file);
      return send(res, 200, body, MIME[ext] || "application/octet-stream");
    }

    // Public assets
    const pub = safeJoin(PUBLIC, p.replace(/^\//, ""));
    if (pub && fs.existsSync(pub) && fs.statSync(pub).isFile()) {
      const ext = path.extname(pub).toLowerCase();
      const body = await fsp.readFile(pub);
      return send(res, 200, body, MIME[ext] || "application/octet-stream");
    }

    send(res, 404, "not found");
  } catch (err) {
    console.error(err);
    send(res, 500, String(err));
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[blender-monitor] dashboard http://127.0.0.1:${PORT}/`);
  console.log(`[blender-monitor] run_dir ${RUN_DIR}`);
  console.log(`[blender-monitor] agent: GET /api/status → latest_preview PNG`);
});
