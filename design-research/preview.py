"""Local static preview with existing Vercel page rewrites; no credentials or paid calls."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
import json
import os

os.chdir(Path(__file__).resolve().parent.parent)

class Preview(SimpleHTTPRequestHandler):
    def do_GET(self):
        route = urlsplit(self.path).path
        rewrites = {"/about": "/about.html", "/contact": "/contact.html", "/privacy-policy": "/privacy-policy.html"}
        self.path = rewrites.get(route, self.path)
        super().do_GET()

    def do_POST(self):
        body = json.dumps({"error": "Live translation is unavailable in the local design preview."}).encode()
        self.send_response(503)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

ThreadingHTTPServer(("127.0.0.1", 48731), Preview).serve_forever()
