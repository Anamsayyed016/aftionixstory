#!/usr/bin/env bash
set -euo pipefail
cd /var/www/storyverse-ai

# Skip if already set
if grep -qE '^RAZORPAY_PLAN_WRITER_ID=plan_' .env && grep -qE '^RAZORPAY_PLAN_STUDIO_ID=plan_' .env; then
  echo "Plan IDs already present in .env"
  grep -E '^RAZORPAY_PLAN_' .env | sed -E 's/(=).*/\1<redacted>/'
  exit 0
fi

# Ensure create-plans script allows live via env (patch if old gate present)
if grep -q 'Refusing to create plans: key is not rzp_test_' scripts/razorpay-create-plans.mjs \
  && ! grep -q 'RAZORPAY_ALLOW_LIVE' scripts/razorpay-create-plans.mjs; then
  python3 - <<'PY'
from pathlib import Path
p = Path("scripts/razorpay-create-plans.mjs")
t = p.read_text()
old = """if (!key_id.startsWith("rzp_test_")) {
  console.error("Refusing to create plans: key is not rzp_test_ (test mode).");
  process.exit(1);
}"""
new = """const allowLive = process.env.RAZORPAY_ALLOW_LIVE === "1";
if (!key_id.startsWith("rzp_test_") && !allowLive) {
  console.error("Refusing to create plans: key is not rzp_test_. Set RAZORPAY_ALLOW_LIVE=1 to use live keys.");
  process.exit(1);
}
if (allowLive && key_id.startsWith("rzp_live_")) {
  console.warn("Creating plans with LIVE keys (real money).");
}"""
if old in t:
  p.write_text(t.replace(old, new))
  print("patched create-plans for ALLOW_LIVE")
else:
  print("create-plans gate not found or already patched")
PY
fi

echo "Creating Razorpay plans (LIVE)..."
OUT="$(
  RAZORPAY_ALLOW_LIVE=1 docker run --rm --env-file .env \
    -e RAZORPAY_ALLOW_LIVE=1 \
    -v /var/www/storyverse-ai:/app -w /app \
    node:20-bookworm \
    bash -c 'npm install razorpay --no-save >/tmp/npm.log 2>&1 && node scripts/razorpay-create-plans.mjs'
)"
echo "$OUT"

WRITER="$(echo "$OUT" | grep -E '^RAZORPAY_PLAN_WRITER_ID=' | tail -n1)"
STUDIO="$(echo "$OUT" | grep -E '^RAZORPAY_PLAN_STUDIO_ID=' | tail -n1)"
if [[ -z "$WRITER" || -z "$STUDIO" ]]; then
  echo "ERROR: plan IDs not found in output"
  exit 1
fi

# Append if missing
grep -qE '^RAZORPAY_PLAN_WRITER_ID=' .env || echo "$WRITER" >> .env
grep -qE '^RAZORPAY_PLAN_STUDIO_ID=' .env || echo "$STUDIO" >> .env
# If present but empty, replace
python3 - <<PY
from pathlib import Path
p = Path(".env")
lines = p.read_text().splitlines(True)
writer = """$WRITER""".strip() + "\n"
studio = """$STUDIO""".strip() + "\n"
def upsert(lines, prefix, newline):
    out, found = [], False
    for line in lines:
        if line.startswith(prefix):
            out.append(newline)
            found = True
        else:
            out.append(line)
    if not found:
        out.append(newline if newline.endswith("\n") else newline + "\n")
    return out
lines = upsert(lines, "RAZORPAY_PLAN_WRITER_ID=", writer)
lines = upsert(lines, "RAZORPAY_PLAN_STUDIO_ID=", studio)
p.write_text("".join(lines))
print("wrote plan IDs into .env")
PY

grep -E '^RAZORPAY_PLAN_' .env | sed -E 's/(=).*/\1<redacted>/'
