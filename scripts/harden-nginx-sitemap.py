#!/usr/bin/env python3
"""Harden aftionix.tech Nginx: shared upstream + XML fallback for /sitemap.xml."""
from pathlib import Path
import re
import subprocess
import sys

SITE = Path("/etc/nginx/sites-available/aftionix.tech")
text = SITE.read_text()

# Detect current port from existing proxy_pass or variable.
m = re.search(r"set \$storyverse_upstream 127\.0\.0\.1:(3000|3001);", text)
if not m:
    m = re.search(r"proxy_pass http://127\.0\.0\.1:(3000|3001);", text)
if not m:
    print("ERROR: could not detect current upstream port", file=sys.stderr)
    sys.exit(1)
port = m.group(1)

HTTPS_BLOCK = f"""server {{
    server_name aftionix.tech www.aftionix.tech;

    # Blue/green deploy flips this single variable.
    set $storyverse_upstream 127.0.0.1:{port};

    # Sitemap must NEVER fall through to Nginx HTML 502 pages — Google treats
    # that as "Sitemap appears to be an HTML page."
    location = /sitemap.xml {{
        proxy_pass http://$storyverse_upstream;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;
        proxy_intercept_errors on;
        error_page 502 503 504 = @sitemap_fallback;
    }}

    location @sitemap_fallback {{
        default_type application/xml;
        add_header Content-Type "application/xml; charset=utf-8" always;
        return 200 '<?xml version="1.0" encoding="UTF-8"?>\\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\\n<url><loc>https://aftionix.tech/</loc></url>\\n<url><loc>https://aftionix.tech/directory</loc></url>\\n<url><loc>https://aftionix.tech/studio</loc></url>\\n</urlset>\\n';
    }}

    location / {{
        proxy_pass http://$storyverse_upstream;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/aftionix.tech/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/aftionix.tech/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot


}}
"""

# Replace the first server { ... } block that listens on 443 (preserve port 80 block).
pattern = re.compile(
    r"server\s*\{[^{}]*?listen 443 ssl;[^{}]*?\n\}",
    re.DOTALL,
)
# Nested braces aren't in the current config (flat), but our new block has nested
# location braces. Use a brace-counting parser instead.

def replace_https_server(src: str, replacement: str) -> str:
    i = 0
    while True:
        start = src.find("server {", i)
        if start < 0:
            raise SystemExit("no server block found")
        # walk braces
        depth = 0
        j = start
        while j < len(src):
            if src[j] == "{":
                depth += 1
            elif src[j] == "}":
                depth -= 1
                if depth == 0:
                    end = j + 1
                    block = src[start:end]
                    if "listen 443 ssl" in block:
                        return src[:start] + replacement.rstrip() + src[end:]
                    i = end
                    break
            j += 1
        else:
            raise SystemExit("unclosed server block")

new_text = replace_https_server(text, HTTPS_BLOCK)
backup = SITE.with_suffix(".tech.bak-sitemap")
backup.write_text(text)
SITE.write_text(new_text)
print(f"wrote {SITE} (backup {backup}), upstream port={port}")
r = subprocess.run(["nginx", "-t"], capture_output=True, text=True)
print(r.stdout)
print(r.stderr)
if r.returncode != 0:
    SITE.write_text(text)
    print("ERROR: nginx -t failed; restored previous config", file=sys.stderr)
    sys.exit(1)
subprocess.check_call(["systemctl", "reload", "nginx"])
print("nginx reloaded")
