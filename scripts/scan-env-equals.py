#!/usr/bin/env python3
"""Scan .env for space-around-= bugs. Prints key names only, never values."""
from pathlib import Path
import sys

path = Path(sys.argv[1] if len(sys.argv) > 1 else ".env")
lines = path.read_text().splitlines()
bad = []
checked = 0
for i, line in enumerate(lines, 1):
    s = line.strip()
    if not s or s.startswith("#"):
        continue
    checked += 1
    if "=" not in line:
        bad.append(f"line {i}: missing '=' (would be treated as a shell command)")
        continue
    # Detect KEY= value or KEY =value before any stripping
    before, eq, after = line.partition("=")
    if not eq:
        continue
    if before.rstrip() != before or after[:1] == " ":
        # Unquoted space after = is the fatal bash source bug
        key = before.strip()
        bad.append(f"line {i}: space around '=' on key={key}")

print(f"checked_assignment_lines={checked}")
print(f"bad_count={len(bad)}")
for b in bad:
    print(b)
if not bad:
    print("OK: no space-around-= issues found")
