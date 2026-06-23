#!/usr/bin/env python3
"""Spritely API helper — uses system Python (SSL works). Writes JSON + raw PNG."""
from __future__ import annotations

import base64
import json
import sys
import urllib.request
from pathlib import Path

API = "https://spritely.studio"


def api_key() -> str:
    data = json.loads(Path.home().joinpath(".cursor/mcp.json").read_text())
    return data["mcpServers"]["spritely"]["env"]["SPRITE_GEN_API_KEY"]


def post(path: str, body: dict) -> dict:
    req = urllib.request.Request(
        API + path,
        data=json.dumps(body).encode(),
        method="POST",
        headers={
            "Authorization": "Bearer " + api_key(),
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=300) as resp:
        return json.loads(resp.read().decode())


def main() -> None:
    prompt, count, ref_path, out_png, out_meta = sys.argv[1:6]
    ref_b64 = base64.b64encode(Path(ref_path).read_bytes()).decode()
    body = json.loads(sys.argv[6]) if len(sys.argv) > 6 else {}
    payload = {
        "prompt": prompt,
        "spriteCount": int(count),
        "layout": "horizontal",
        "artStyle": "heavy chibi high-detail pixel art RTS hero, Valdris style",
        "removeBackground": True,
        "similarity": 88,
        "referenceImage": {"base64": ref_b64, "mimeType": "image/png"},
        **body,
    }
    result = post("/api/mcp/generate", payload)
    with urllib.request.urlopen(result["storageUrl"], timeout=120) as resp:
        Path(out_png).write_bytes(resp.read())
    Path(out_meta).write_text(json.dumps(result, indent=2))
    print(json.dumps({"ok": True, "out_png": out_png, "usage": result.get("usage")}))


if __name__ == "__main__":
    main()
