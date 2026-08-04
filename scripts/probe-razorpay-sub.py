#!/usr/bin/env bash
set -euo pipefail
cd /var/www/storyverse-ai
set -a
# shellcheck disable=SC1091
source ./.env
set +a

python3 - <<'PY'
import json, os, urllib.request, base64
key = os.environ["RAZORPAY_KEY_ID"].strip()
secret = os.environ["RAZORPAY_KEY_SECRET"].strip()
plan = os.environ["RAZORPAY_PLAN_WRITER_ID"].strip()
auth = base64.b64encode(f"{key}:{secret}".encode()).decode()

def post(path, body):
    req = urllib.request.Request(
        f"https://api.razorpay.com/v1/{path}",
        data=json.dumps(body).encode(),
        headers={
            "Authorization": f"Basic {auth}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw[:300]}

# 1) plan fetch
req = urllib.request.Request(
    f"https://api.razorpay.com/v1/plans/{plan}",
    headers={"Authorization": f"Basic {auth}"},
)
try:
    with urllib.request.urlopen(req) as r:
        p = json.loads(r.read().decode())
        print("plan_ok", p.get("id","")[:12], "period", p.get("period"), "item_amount", (p.get("item") or {}).get("amount"))
except urllib.error.HTTPError as e:
    print("plan_fetch_failed", e.code, e.read().decode()[:200])

# 2) subscription with customer_notify int 1 (current)
code, body = post("subscriptions", {
    "plan_id": plan,
    "total_count": 120,
    "quantity": 1,
    "customer_notify": 1,
    "notes": {"userId": "debug", "plan": "WRITER"},
})
print("notify_int_1", code, json.dumps(body)[:400])

# 3) subscription with customer_notify bool true
code, body = post("subscriptions", {
    "plan_id": plan,
    "total_count": 120,
    "quantity": 1,
    "customer_notify": True,
    "notes": {"userId": "debug", "plan": "WRITER"},
})
print("notify_bool", code, json.dumps(body)[:400])

# 4) minimal
code, body = post("subscriptions", {
    "plan_id": plan,
    "total_count": 12,
})
print("minimal", code, json.dumps(body)[:400])
PY
