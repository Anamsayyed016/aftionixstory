#!/usr/bin/env python3
"""Print full Razorpay subscription-create error. Loads /var/www/storyverse-ai/.env"""
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


def call(method, path, body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        f"https://api.razorpay.com/v1/{path}",
        data=data,
        headers={
            "Authorization": f"Basic {auth}",
            "Content-Type": "application/json",
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw}


for label, body in [
    ("minimal", {"plan_id": plan, "total_count": 12}),
    ("with_bool", {"plan_id": plan, "total_count": 12, "quantity": 1, "customer_notify": True}),
    ("with_notify_info", {
        "plan_id": plan,
        "total_count": 12,
        "quantity": 1,
        "customer_notify": True,
        "notify_info": {"notify_email": "billing-debug@aftionix.tech"},
    }),
]:
    code, resp = call("POST", "subscriptions", body)
    print("===", label, "http", code, "===")
    print(json.dumps(resp, indent=2)[:800])
