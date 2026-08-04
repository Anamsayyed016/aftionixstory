#!/usr/bin/env python3
from pathlib import Path
import re
import subprocess

site = Path("/etc/nginx/sites-available/aftionix.tech")
text = site.read_text()
old = """    location @sitemap_fallback {
        default_type application/xml;
        add_header Content-Type "application/xml; charset=utf-8" always;
        return 200 '<?xml version="1.0" encoding="UTF-8"?>\\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\\n<url><loc>https://aftionix.tech/</loc></url>\\n<url><loc>https://aftionix.tech/directory</loc></url>\\n<url><loc>https://aftionix.tech/studio</loc></url>\\n</urlset>\\n';
    }"""
new = """    location @sitemap_fallback {
        default_type application/xml;
        charset utf-8;
        return 200 '<?xml version="1.0" encoding="UTF-8"?>\\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\\n<url><loc>https://aftionix.tech/</loc></url>\\n<url><loc>https://aftionix.tech/directory</loc></url>\\n<url><loc>https://aftionix.tech/studio</loc></url>\\n</urlset>\\n';
    }"""
if old not in text:
    # tolerate already-fixed
    if "charset utf-8;" in text and "@sitemap_fallback" in text:
        print("fallback already clean")
    else:
        raise SystemExit("fallback block not found for patch")
else:
    site.write_text(text.replace(old, new, 1))
    print("patched fallback content-type")
subprocess.check_call(["nginx", "-t"])
subprocess.check_call(["systemctl", "reload", "nginx"])
print("reloaded")
