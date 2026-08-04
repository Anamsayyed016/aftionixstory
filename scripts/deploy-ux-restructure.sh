#!/usr/bin/env bash
set -euo pipefail
ROOT=/var/www/storyverse-ai
SRC=/tmp/ux-restructure
cd "$ROOT"

copy() {
  local rel="$1"
  mkdir -p "$(dirname "$ROOT/$rel")"
  cp "$SRC/$rel" "$ROOT/$rel"
  echo "copied $rel"
}

# Flatten: files uploaded as mirror under SRC preserving paths via tarball better
# Expect SRC to contain full relative paths already mirrored.
find "$SRC" -type f | while read -r f; do
  rel="${f#$SRC/}"
  mkdir -p "$(dirname "$ROOT/$rel")"
  cp "$f" "$ROOT/$rel"
  echo "copied $rel"
done

sed -i 's/\r$//' scripts/deploy-zero-downtime.sh
./scripts/deploy-zero-downtime.sh
