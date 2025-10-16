#!/bin/sh

while [ ! -f /shared/tunnel.log ] || ! grep -E 'https://[^ |]+\.trycloudflare\.com.*\|' /shared/tunnel.log; do \
	echo "Waiting for tunnel..."; \
	sleep 1; \
done

export TUNNEL_URL=$(grep -oE 'https://[^ |]+\.trycloudflare\.com' /shared/tunnel.log | tail -1 | sed 's|https://||')
echo "URL is: $TUNNEL_URL"

envsubst < /usr/share/nginx/html/config.json > /usr/share/nginx/html/config.json.tmp
mv /usr/share/nginx/html/config.json.tmp /usr/share/nginx/html/config.json

exec nginx -g 'daemon off;'
