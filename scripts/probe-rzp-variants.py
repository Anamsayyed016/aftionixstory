#!/usr/bin/env python3
from pathlib import Path
import json, base64, urllib.request, urllib.error

env = {}
for line in Path("/var/www/storyverse-ai/.env").read_text().splitlines():
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, _, v = line.partition("=")
    env[k.strip()] = v.strip()

key, secret, plan = env["RAZORPAY_KEY_ID"], env["RAZORPAY_KEY_SECRET"], env["RAZORPAY_PLAN_WRITER_ID"]
auth = base64.b64encode(f"{key}:{secret}".encode()).decode()


def post(path, body):
    req = urllib.request.Request(
        f"https://api.razorpay.com/v1/{path}",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Basic {auth}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())


variants = [
    ("str_total", {"plan_id": plan, "total_count": "12"}),
    ("str_both", {"plan_id": plan, "total_count": "12", "quantity": "1"}),
    ("end_at", {"plan_id": plan, "end_at": 1817380000}),
    ("link", {"plan_id": plan, "total_count": 12, "customer_notify": True, "quantity": 1}),
]

for label, body in variants:
    if label == "link":
        code, resp = post("subscription_links", body)
    else:
        code, resp = post("subscriptions", body)
    err = resp.get("error") or {}
    print(label, code, err.get("description") or resp.get("id", "")[:20], err.get("field"), json.dumps(resp)[:180])
