#!/usr/bin/env python3
from pathlib import Path
import subprocess

site = Path("/etc/nginx/sites-available/aftionix.tech")
text = site.read_text()
# Point to green on 3001
text2 = text.replace(
    "set $storyverse_upstream 127.0.0.1:3000;",
    "set $storyverse_upstream 127.0.0.1:3001;",
)
if text2 == text:
    # already 3001?
    if "set $storyverse_upstream 127.0.0.1:3001;" not in text:
        raise SystemExit("could not find upstream set line")
    print("already on 3001")
else:
    site.write_text(text2)
    print("switched to 3001")
subprocess.check_call(["nginx", "-t"])
subprocess.check_call(["systemctl", "reload", "nginx"])
print("nginx reloaded")
