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
        return e.code, json.loads(e.read().decode())


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


# Orders work? (one-time) — ₹1 paise test is bad; use 100 paise = ₹1 for dry check then cancel isn't needed for order
code, order = post("orders", {"amount": 100, "currency": "INR", "receipt": "debug_order_1"})
print("orders", code, json.dumps(order)[:300])

# subscriptions list
code, subs = get("subscriptions?count=1")
print("list_subscriptions", code, json.dumps(subs)[:400])

# addons / registration?
code, reg = post("subscription_registration/auth_payments", {
    "method": "card",
    "card": {
        "number": "4111111111111111",
        "expiry_month": "12",
        "expiry_year": "30",
        "cvv": "123",
        "name": "Test",
    },
    "amount": 0,
    "currency": "INR",
})
print("auth_payments", code, json.dumps(reg)[:400])
