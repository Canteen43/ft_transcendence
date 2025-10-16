COMPOSE_DIR=./build

all: up

up:
	rm -f build/shared_volume/tunnel.log
	@docker compose -f $(COMPOSE_DIR)/docker-compose.yml up -d
	@while [ ! -f build/shared_volume/tunnel.log ] || ! grep -qE 'https://[^ |]+\.trycloudflare\.com.*\|' build/shared_volume/tunnel.log; do \
		echo "Waiting for tunnel..."; \
		sleep 1; \
	done
	@TUNNEL_URL=$$(grep -oE 'https://[^ |]+\.trycloudflare\.com' ./build/shared_volume/tunnel.log | tail -1 | sed 's|https://||'); \
	echo "\033[1;32m🌐 Tunnel URL:\033[0m https://$$TUNNEL_URL"

down:
	@docker compose -f $(COMPOSE_DIR)/docker-compose.yml down

build:
	@docker compose -f $(COMPOSE_DIR)/docker-compose.yml build

.PHONY: all up down build
