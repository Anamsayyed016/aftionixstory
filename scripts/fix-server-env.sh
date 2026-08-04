#!/usr/bin/env bash
set -euo pipefail
cd /var/www/storyverse-ai
cp -a .env ".env.bak.$(date +%Y%m%d%H%M%S)"
python3 /tmp/fix-razorpay-env.py .env
echo "--- RAZORPAY lines ---"
grep -nE '^RAZORPAY_' .env | sed -E 's/(=).*/\1<redacted>/'
python3 - <<'PY'
from pathlib import Path
for i, line in enumerate(Path(".env").read_text().splitlines(), 1):
    if line.startswith("RAZORPAY_"):
        print(f"line {i}: space_after_eq={'= ' in line} len={len(line)}")
PY
set -a
# shellcheck disable=SC1091
source ./.env
set +a
echo "SOURCE_OK prefix=${RAZORPAY_KEY_ID:0:8} secret_set=$([ -n "${RAZORPAY_KEY_SECRET:-}" ] && echo yes || echo no)"
