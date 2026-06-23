#!/usr/bin/env python3
"""Dev static server that disables caching.

Plain `python3 -m http.server` lets browsers cache JS aggressively, which makes
edits appear to do nothing (stale render.js, white screens after a deploy). This
server sends `Cache-Control: no-store` on every response so a normal reload
always fetches the latest files.
"""
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    httpd = HTTPServer(("0.0.0.0", port), NoCacheHandler)
    print(f"dev-server (no-store) on http://localhost:{port}")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
