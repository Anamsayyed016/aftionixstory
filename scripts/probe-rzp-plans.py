#!/usr/bin/env python3
from pathlib import Path
import json, base64, urllib.request, urllib.error

env = {}
for line in Path("/var/www/storyverse-ai/.env").read_text().splitlines():
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, _, v = line.partition("=")
    env[k.strip()] = v.strip()

key = env["RAZORPAY_KEY_ID"]
secret = env["RAZORPAY_KEY_SECRET"]
plan = env["RAZORPAY_PLAN_WRITER_ID"]
auth = base64.b64encode(f"{key}:{secret}".encode()).decode()


def get(path):
    req = urllib.request.Request(
        f"https://api.razorpay.com/v1/{path}",
        headers={"Authorization": f"Basic {auth}"},
    )
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())


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
        return e.code, json.loads(e.read().decode())


print("key_prefix", key[:8])
code, p = get(f"plans/{plan}")
print("plan_status", code)
# redact nothing sensitive — plan object is ok
print(json.dumps(p, indent=2)[:1200])

code, plans = get("plans?count=5")
print("list_plans", code, "count", (plans.get("count") if isinstance(plans, dict) else None))
if isinstance(plans, dict):
    for item in (plans.get("items") or [])[:5]:
        print(" -", item.get("id"), item.get("period"), (item.get("item") or {}).get("amount"), (item.get("item") or {}).get("currency"))

# Try creating a NEW plan then subscription in one flow
code, new_plan = post("plans", {
    "period": "monthly",
    "interval": 1,
    "item": {
        "name": "AFTIONIX Writer Debug",
        "amount": 19900,
        "currency": "INR",
        "description": "debug plan",
    },
})
print("create_plan", code, json.dumps(new_plan)[:400])
if code < 400 and new_plan.get("id"):
    code2, sub = post("subscriptions", {"plan_id": new_plan["id"], "total_count": 12})
    print("sub_with_new_plan", code2, json.dumps(sub)[:500])
