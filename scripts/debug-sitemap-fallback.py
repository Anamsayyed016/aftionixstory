#!/usr/bin/env python3
from pathlib import Path
import subprocess
import time

site = Path("/etc/nginx/sites-available/aftionix.tech")
original = site.read_text()
print("ORIGINAL UPSTREAM LINE:")
for l in original.splitlines():
    if "storyverse_upstream" in l or "proxy_pass" in l:
        print(" ", l)

broken = original.replace("127.0.0.1:3001", "127.0.0.1:3999").replace(
    "127.0.0.1:3000", "127.0.0.1:3999"
)
site.write_text(broken)
subprocess.check_call(["nginx", "-t"])
subprocess.check_call(["systemctl", "reload", "nginx"])
time.sleep(1)

print("\nBROKEN CONFIG UPSTREAM:")
for l in site.read_text().splitlines():
    if "storyverse_upstream" in l or "proxy_pass" in l:
        print(" ", l)

print("\nDirect :3999:")
r = subprocess.run(["curl", "-sS", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", "3", "http://127.0.0.1:3999/sitemap.xml"], capture_output=True, text=True)
print(" code", r.stdout, "err", r.stderr.strip())

print("\nVia nginx Host=aftionix.tech resolve localhost:")
r = subprocess.run(
    [
        "curl", "-sk", "-D", "-", "-o", "/tmp/sm-local-fb.xml", "--max-time", "10",
        "--resolve", "aftionix.tech:443:127.0.0.1",
        "https://aftionix.tech/sitemap.xml?localfb=1",
    ],
    capture_output=True,
    text=True,
)
print(r.stdout[:500])
print("BODY:", Path("/tmp/sm-local-fb.xml").read_text()[:250])

print("\nRecent nginx errors:")
subprocess.run(["bash", "-lc", "tail -20 /var/log/nginx/error.log"], check=False)

site.write_text(original)
subprocess.check_call(["nginx", "-t"])
subprocess.check_call(["systemctl", "reload", "nginx"])
print("\nrestored")
