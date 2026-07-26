#!/bin/sh
# Ensure the shared uploads volume is writable by the nextjs user (uid 1001).
# Fresh Docker volumes are often root-owned, which causes EACCES on image upload/save.
set -eu
mkdir -p /app/public/uploads/images
chown -R nextjs:nodejs /app/public/uploads || true
chmod -R u+rwX,g+rwX /app/public/uploads || true
exec su-exec nextjs "$@"
