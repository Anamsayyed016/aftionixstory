#!/usr/bin/env bash
# Zero-downtime blue/green deploy for StoryVerse standalone (Nginx + Docker).
# Active color serves traffic; inactive color is built/started first, then Nginx switches.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

STATE_FILE="$ROOT_DIR/.deploy-active"
SITE_FILE="/etc/nginx/sites-available/aftionix.tech"

if [[ ! -f .env ]]; then
  echo "ERROR: $ROOT_DIR/.env is missing."
  exit 1
fi

# Clean any invalid upstream snippet from earlier attempts.
rm -f /etc/nginx/snippets/storyverse-upstream.conf

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

BUILD_ID="$(git rev-parse HEAD 2>/dev/null || echo unknown)"
BUILT_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
export STORYVERSE_BUILD_ID="$BUILD_ID"
export STORYVERSE_BUILT_AT="$BUILT_AT"
echo "==> Building standalone image (commit ${BUILD_ID})"
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

echo "==> Health-checking http://127.0.0.1:${NEXT_PORT}/api/health"
ok=0
for i in $(seq 1 45); do
  if health_json="$(curl -fsS "http://127.0.0.1:${NEXT_PORT}/api/health")"; then
    echo "$health_json"
    if echo "$health_json" | grep -q "\"ok\":true"; then
      ok=1
      echo "healthy after ${i} attempt(s)"
      break
    fi
  fi
  sleep 2
done
if [[ "$ok" -ne 1 ]]; then
  echo "ERROR: new slot ${NEXT} failed health check on :${NEXT_PORT}"
  docker compose logs --tail=100 "web_${NEXT}" || true
  exit 1
fi

echo "==> Switching Nginx traffic to :${NEXT_PORT}"
python3 - <<PY
from pathlib import Path
import re
path = Path("${SITE_FILE}")
text = path.read_text()
next_port = "${NEXT_PORT}"
replaced = False
out = []
for line in text.splitlines(keepends=True):
    if (not replaced) and re.search(r"proxy_pass http://127\\.0\\.0\\.1:(3000|3001);", line):
        indent = re.match(r"^(\\s*)", line).group(1)
        out.append(f"{indent}proxy_pass http://127.0.0.1:{next_port};\n")
        replaced = True
    elif (not replaced) and "proxy_pass http://storyverse_backend;" in line:
        indent = re.match(r"^(\\s*)", line).group(1)
        out.append(f"{indent}proxy_pass http://127.0.0.1:{next_port};\n")
        replaced = True
    else:
        if "storyverse-upstream.conf" in line:
            continue
        out.append(line)
if not replaced:
    raise SystemExit("Could not find proxy_pass target to update in Nginx site config")
path.write_text("".join(out))
print(f"nginx proxy_pass -> 127.0.0.1:{next_port}")
PY
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
