#!/bin/sh
echo "=== [STARTUP] Extracting frontend build files ==="
# Extract the tarball to nginx html directory (overwrites any mounted volume content)
tar -xf /tmp/dist.tar -C /usr/share/nginx/html
echo "=== [STARTUP] Files extracted ==="
ls -la /usr/share/nginx/html/
echo "=== [STARTUP] Starting nginx ==="
exec nginx -g "daemon off;"