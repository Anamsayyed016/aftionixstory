#!/usr/bin/env python3
"""Temporarily break upstream to prove sitemap returns XML, not HTML."""
from pathlib import Path
import subprocess
import urllib.request

site = Path("/etc/nginx/sites-available/aftionix.tech")
original = site.read_text()
broken = original.replace(
    "set $storyverse_upstream 127.0.0.1:3001;",
    "set $storyverse_upstream 127.0.0.1:3999;",
).replace(
    "set $storyverse_upstream 127.0.0.1:3000;",
    "set $storyverse_upstream 127.0.0.1:3999;",
)
site.write_text(broken)
subprocess.check_call(["nginx", "-t"])
subprocess.check_call(["systemctl", "reload", "nginx"])

try:
    req = urllib.request.Request(
        "https://aftionix.tech/sitemap.xml?fallback=1",
        headers={"Cache-Control": "no-cache"},
    )
    # Disable cert verify for local probe simplicity — use curl instead via subprocess
    out = subprocess.check_output(
        [
            "curl", "-sS", "-D", "-", "-o", "/tmp/sm-fallback.xml",
            "--max-time", "15",
            "https://aftionix.tech/sitemap.xml?fallback=1",
        ],
        text=True,
    )
    print(out.split("\r\n\r\n")[0] if "\r\n\r\n" in out else out[:500])
    body = Path("/tmp/sm-fallback.xml").read_text()
    print("BODY:", body[:300])
    assert "<?xml" in body
    assert "<html" not in body.lower()
    # Nginx fallback has no <lastmod>; dynamic app sitemap always includes it.
    if "<lastmod>" in body:
        raise SystemExit("FAIL: still got dynamic app sitemap; nginx fallback did not engage")
    assert "aftionix.tech/directory" in body
    print("FALLBACK_OK")
finally:
    site.write_text(original)
    subprocess.check_call(["nginx", "-t"])
    subprocess.check_call(["systemctl", "reload", "nginx"])
    print("restored upstream")
