#!/usr/bin/env bash
set -euo pipefail
cd /var/www/storyverse-ai
set -a
# shellcheck disable=SC1091
source ./.env
set +a
python3 - <<'PY'
import json, os, urllib.request, base64, urllib.error
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

req = urllib.request.Request(
    f"https://api.razorpay.com/v1/plans/{plan}",
    headers={"Authorization": f"Basic {auth}"},
)
try:
    with urllib.request.urlopen(req) as r:
        p = json.loads(r.read().decode())
        print("plan_ok", p.get("id", "")[:12], "period", p.get("period"),
              "item_amount", (p.get("item") or {}).get("amount"))
except urllib.error.HTTPError as e:
    print("plan_fetch_failed", e.code, e.read().decode()[:200])

for label, body in [
    ("notify_int_1", {"plan_id": plan, "total_count": 120, "quantity": 1, "customer_notify": 1, "notes": {"userId": "debug", "plan": "WRITER"}}),
    ("notify_bool", {"plan_id": plan, "total_count": 120, "quantity": 1, "customer_notify": True, "notes": {"userId": "debug", "plan": "WRITER"}}),
    ("minimal", {"plan_id": plan, "total_count": 12}),
]:
    code, resp = post("subscriptions", body)
    err = (resp.get("error") or {}) if isinstance(resp, dict) else {}
    print(label, "http", code, "desc", err.get("description"), "field", err.get("field"),
          "id", (resp.get("id") or "")[:12] if code < 400 else "")
    # cancel accidental live creates
    if code < 400 and resp.get("id"):
        cid = resp["id"]
        creq = urllib.request.Request(
            f"https://api.razorpay.com/v1/subscriptions/{cid}/cancel",
            data=json.dumps({"cancel_at_cycle_end": 0}).encode(),
            headers={"Authorization": f"Basic {auth}", "Content-Type": "application/json"},
            method="POST",
        )
        try:
            urllib.request.urlopen(creq).read()
            print("cancelled", cid[:12])
        except Exception as ex:
            print("cancel_failed", type(ex).__name__)
PY
