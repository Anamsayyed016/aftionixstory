#!/bin/bash
set -euo pipefail
echo "==== non-200 sitemap responses ===="
(zgrep -h sitemap /var/log/nginx/access.log* 2>/dev/null || true) | grep sitemap | grep -v ' 200 ' | tail -50 || true
echo
echo "==== googlebot sitemap hits ===="
(zgrep -h sitemap /var/log/nginx/access.log* 2>/dev/null || true) | grep -i google | tail -40 || true
echo
echo "==== upstream connection refused ===="
(zgrep -h 'Connection refused\|sitemap' /var/log/nginx/error.log* 2>/dev/null || true) | tail -40 || true
echo
echo "==== AAAA / curl -4 vs -6 ===="
getent ahosts aftionix.tech | head -20 || true
curl -4 -sS -o /tmp/sm4.xml -w 'ipv4=%{http_code} ctype=%{content_type}\n' --max-time 10 https://aftionix.tech/sitemap.xml || true
curl -6 -sS -o /tmp/sm6.xml -w 'ipv6=%{http_code} ctype=%{content_type}\n' --max-time 10 https://aftionix.tech/sitemap.xml 2>&1 || true
head -c 60 /tmp/sm4.xml; echo
