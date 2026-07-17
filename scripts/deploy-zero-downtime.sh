#!/usr/bin/env bash
# Zero-downtime blue/green deploy for StoryVerse standalone (Nginx + Docker).
# Active color serves traffic; inactive color is built/started first, then Nginx switches.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

STATE_FILE="$ROOT_DIR/.deploy-active"
UPSTREAM_FILE="/etc/nginx/snippets/storyverse-upstream.conf"
SITE_FILE="/etc/nginx/sites-available/aftionix.tech"

if [[ ! -f .env ]]; then
  echo "ERROR: $ROOT_DIR/.env is missing."
  exit 1
fi

if [[ ! -f "$UPSTREAM_FILE" ]]; then
  echo "==> Creating Nginx upstream snippet"
  mkdir -p /etc/nginx/snippets
  cat >"$UPSTREAM_FILE" <<'EOF'
upstream storyverse_backend {
    server 127.0.0.1:3000;
    keepalive 32;
}
EOF
fi

# Ensure site proxies via upstream (idempotent, HTTPS server only).
if grep -q 'proxy_pass http://127.0.0.1:3000;' "$SITE_FILE" 2>/dev/null; then
  echo "==> Pointing Nginx HTTPS site at storyverse_backend upstream"
  python3 - <<'PY'
from pathlib import Path
path = Path("/etc/nginx/sites-available/aftionix.tech")
text = path.read_text()
if "include /etc/nginx/snippets/storyverse-upstream.conf;" not in text:
    text = text.replace(
        "server_name aftionix.tech www.aftionix.tech;\n\n    location / {",
        "server_name aftionix.tech www.aftionix.tech;\n\n    include /etc/nginx/snippets/storyverse-upstream.conf;\n\n    location / {",
        1,
    )
text = text.replace(
    "proxy_pass http://127.0.0.1:3000;",
    "proxy_pass http://storyverse_backend;",
    1,
)
path.write_text(text)
print("nginx site updated")
PY
  nginx -t
  systemctl reload nginx
fi

ACTIVE="$(cat "$STATE_FILE" 2>/dev/null || true)"
LEGACY=0
if docker ps -a --format '{{.Names}}' | grep -qx 'storyverse-ai'; then
  LEGACY=1
fi

if [[ -z "$ACTIVE" ]]; then
  if [[ "$LEGACY" -eq 1 ]]; then
    # First zero-downtime cutover: bring green up on :3001 while legacy :3000 keeps serving.
    ACTIVE="legacy"
    NEXT="green"
    NEXT_PORT="3001"
  else
    ACTIVE="blue"
    NEXT="green"
    NEXT_PORT="3001"
  fi
elif [[ "$ACTIVE" == "blue" ]]; then
  NEXT="green"
  NEXT_PORT="3001"
elif [[ "$ACTIVE" == "green" ]]; then
  NEXT="blue"
  NEXT_PORT="3000"
else
  echo "ERROR: unknown active slot '$ACTIVE' in $STATE_FILE"
  exit 1
fi

echo "==> Active slot: ${ACTIVE} | Deploying slot: ${NEXT} (127.0.0.1:${NEXT_PORT})"

echo "==> Ensuring Postgres is up"
docker compose up -d db
for _ in $(seq 1 40); do
  if docker compose exec -T db pg_isready -U storyverse >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "==> Building standalone image"
docker compose build "web_${NEXT}"

echo "==> Applying Prisma migrations (old app still serving)"
set -a
# shellcheck disable=SC1091
source ./.env
set +a
docker run --rm \
  --network storyverse-ai_default \
  -v "$ROOT_DIR/prisma:/prisma" \
  -e DATABASE_URL \
  -w /tmp \
  node:22-alpine \
  sh -lc "npm install prisma@6.19.3 && npx prisma migrate deploy --schema=/prisma/schema.prisma"

echo "==> Starting ${NEXT} without stopping current traffic"
docker compose up -d --no-deps --force-recreate "web_${NEXT}"

echo "==> Health-checking http://127.0.0.1:${NEXT_PORT}/"
ok=0
for _ in $(seq 1 36); do
  if curl -fsS -o /dev/null "http://127.0.0.1:${NEXT_PORT}/"; then
    ok=1
    break
  fi
  sleep 2
done
if [[ "$ok" -ne 1 ]]; then
  echo "ERROR: new slot ${NEXT} failed health check on :${NEXT_PORT}"
  docker compose logs --tail=100 "web_${NEXT}" || true
  exit 1
fi

echo "==> Switching Nginx traffic to :${NEXT_PORT}"
cat >"$UPSTREAM_FILE" <<EOF
upstream storyverse_backend {
    server 127.0.0.1:${NEXT_PORT};
    keepalive 32;
}
EOF
nginx -t
systemctl reload nginx

echo "==> Stopping previous slot"
if [[ "$ACTIVE" == "legacy" ]]; then
  docker rm -f storyverse-ai >/dev/null 2>&1 || true
elif [[ "$ACTIVE" == "blue" || "$ACTIVE" == "green" ]]; then
  docker compose stop "web_${ACTIVE}" || true
  docker compose rm -f "web_${ACTIVE}" || true
fi

echo "$NEXT" >"$STATE_FILE"
echo "==> Zero-downtime deploy complete: slot=${NEXT} commit=$(git rev-parse --short HEAD)"
