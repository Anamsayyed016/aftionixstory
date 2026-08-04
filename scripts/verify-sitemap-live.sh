#!/bin/bash
set -euo pipefail
sed -i 's/\r$//' /tmp/test-sitemap-fallback.py
python3 /tmp/test-sitemap-fallback.py

echo "==== 5x Googlebot ===="
for i in 1 2 3 4 5; do
  curl -sS -D "/tmp/h-$i.txt" -o "/tmp/b-$i.xml" \
    -A 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' \
    -H 'Cache-Control: no-cache' --max-time 15 \
    "https://aftionix.tech/sitemap.xml?v=$i"
  ct=$(grep -i '^Content-Type' "/tmp/h-$i.txt" | tr -d '\r')
  code=$(grep '^HTTP' "/tmp/h-$i.txt" | head -1 | tr -d '\r')
  start=$(head -c 38 "/tmp/b-$i.xml")
  echo "$i $code | $ct | $start"
  grep -q '<?xml' "/tmp/b-$i.xml"
  ! grep -qi '<html' "/tmp/b-$i.xml"
done

echo "==== 5x plain curl ===="
for i in 1 2 3 4 5; do
  code=$(curl -sS -o "/tmp/p-$i.xml" -w '%{http_code}' --max-time 15 \
    -H 'Cache-Control: no-cache' "https://aftionix.tech/sitemap.xml?p=$i")
  ctype=$(curl -sS -D - -o /dev/null --max-time 15 \
    -H 'Cache-Control: no-cache' "https://aftionix.tech/sitemap.xml?pc=$i" \
    | awk 'BEGIN{IGNORECASE=1} /^Content-Type:/{print $2}' | tr -d '\r')
  start=$(head -c 38 "/tmp/p-$i.xml")
  echo "$i code=$code ctype=$ctype start=$start"
  test "$code" = "200"
  grep -q '<?xml' "/tmp/p-$i.xml"
done

echo "==== business urls present ===="
grep '/b/' /tmp/p-1.xml
echo "==== nginx upstream ===="
grep storyverse_upstream /etc/nginx/sites-available/aftionix.tech | head -3
echo "==== active slot ===="
cat /var/www/storyverse-ai/.deploy-active
docker ps --format '{{.Names}} {{.Ports}} {{.Status}}'
echo ALL_OK
