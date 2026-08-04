#!/usr/bin/env python3
"""Normalize RAZORPAY_* lines in .env (strip spaces around =)."""
from pathlib import Path
import sys

path = Path(sys.argv[1] if len(sys.argv) > 1 else ".env")
text = path.read_text()
out = []
changed = 0
for line in text.splitlines(True):
    raw = line.rstrip("\r\n")
    if raw.startswith("RAZORPAY_") and "=" in raw:
        k, _, v = raw.partition("=")
        fixed = f"{k.strip()}={v.strip()}\n"
        if fixed != (raw + "\n") and fixed.rstrip("\n") != raw:
            changed += 1
        out.append(fixed)
    else:
        out.append(line if line.endswith("\n") else line + "\n")
path.write_text("".join(out))
print(f"normalized {changed} RAZORPAY line(s) in {path}")
