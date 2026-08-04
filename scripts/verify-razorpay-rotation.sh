#!/usr/bin/env bash
set -euo pipefail
cd /var/www/storyverse-ai

python3 /tmp/scan-env-equals.py .env

ENV_FP=$(python3 - <<'PY'
from pathlib import Path
for line in Path(".env").read_text().splitlines():
    if line.startswith("RAZORPAY_KEY_ID="):
        v = line.split("=", 1)[1].strip()
        print(f"{v[:8]}…{v[-4:]} len={len(v)}")
        break
PY
)
echo "env_key_fingerprint=${ENV_FP}"

bash /tmp/recreate-active-web.sh

ACTIVE="$(cat .deploy-active 2>/dev/null || echo blue)"
CTR="storyverse-ai-${ACTIVE}"
CTR_FP=$(docker exec "$CTR" printenv RAZORPAY_KEY_ID | python3 -c 'import sys; v=sys.stdin.read().strip(); print(f"{v[:8]}…{v[-4:]} len={len(v)}")')
echo "container_key_fingerprint=${CTR_FP}"

if [[ "$ENV_FP" != "$CTR_FP" ]]; then
  echo "MISMATCH: container key != .env key"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source ./.env
set +a

docker run --rm curlimages/curl:8.5.0 \
  -sS -u "${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}" \
  -w "\n%{http_code}" \
  "https://api.razorpay.com/v1/plans/${RAZORPAY_PLAN_WRITER_ID}" \
  > /tmp/rzp_plan_check.out

HTTP=$(tail -n1 /tmp/rzp_plan_check.out)
BODY=$(head -n -1 /tmp/rzp_plan_check.out)
echo "razorpay_plans_http=${HTTP}"
printf '%s' "$BODY" > /tmp/rzp_plan_body.json
printf '%s' "$HTTP" > /tmp/rzp_plan_http.txt

python3 - <<'PY'
import json
from pathlib import Path
http = int(Path("/tmp/rzp_plan_http.txt").read_text().strip())
body = Path("/tmp/rzp_plan_body.json").read_text()
print("http", http)
if http != 200:
    try:
        j = json.loads(body)
        err = j.get("error") or {}
        print("error_code", err.get("code"))
        print("error_description", str(err.get("description", ""))[:80])
    except Exception:
        print("non_json_error_len", len(body))
    raise SystemExit(1)
j = json.loads(body)
pid = j.get("id") or ""
print("plan_ok", pid[:8] + "…", "period", j.get("period"), "item_amount", (j.get("item") or {}).get("amount"))
print("RAZORPAY_KEYS_VERIFIED")
PY
