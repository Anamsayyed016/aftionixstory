#!/bin/bash
set -euo pipefail
echo "==== containers ===="
docker ps --format '{{.Names}} {{.Status}} {{.Ports}}'
echo
echo "==== 25 rapid fetches via localhost nginx (HTTPS) ===="
ok=0
fail=0
for i in $(seq 1 25); do
  code=$(curl -sk -o /tmp/sm-stress.out -w '%{http_code}' --max-time 15 \
    -H 'Cache-Control: no-cache' \
    "https://127.0.0.1/sitemap.xml?stress=$i" \
    --resolve aftionix.tech:443:127.0.0.1 \
    -H 'Host: aftionix.tech')
  headc=$(head -c 40 /tmp/sm-stress.out | tr '\n' ' ')
  if [ "$code" = "200" ] && grep -q '<?xml' /tmp/sm-stress.out; then
    ok=$((ok+1))
    echo "OK $i $code $headc"
  else
    fail=$((fail+1))
    echo "FAIL $i $code $headc"
    echo "---- body ----"
    head -c 500 /tmp/sm-stress.out; echo
  fi
done
echo "summary ok=$ok fail=$fail"
echo
echo "==== Googlebot Accept:text/html ===="
curl -sk -D - -o /tmp/sm-bot.html --max-time 15 \
  -A 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' \
  -H 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' \
  --resolve aftionix.tech:443:127.0.0.1 \
  -H 'Host: aftionix.tech' \
  'https://aftionix.tech/sitemap.xml?bot=1' | head -20
head -c 80 /tmp/sm-bot.html; echo
echo
echo "==== HEAD request ===="
curl -sk -I --max-time 15 --resolve aftionix.tech:443:127.0.0.1 -H 'Host: aftionix.tech' 'https://aftionix.tech/sitemap.xml'
echo
echo "==== recent blue logs mentioning sitemap/error/prisma ===="
docker logs --tail 200 storyverse-ai-blue 2>&1 | grep -iE 'sitemap|error|prisma|ECONN|500|Unhandled' | tail -40 || true
echo
echo "==== nginx access log sitemap lines ===="
grep -E 'sitemap' /var/log/nginx/access.log 2>/dev/null | tail -30 || true
echo
echo "==== nginx error log recent ===="
tail -40 /var/log/nginx/error.log 2>/dev/null || true
