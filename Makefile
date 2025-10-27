COMPOSE_DIR=./build
TERMINAL=/usr/bin/gnome-terminal
SHELL=zsh
SHELLRC=~/.zshrc

all: up

up:
	@docker compose -f $(COMPOSE_DIR)/docker-compose.yml up -d

down:
	@docker compose -f $(COMPOSE_DIR)/docker-compose.yml down

build:
	@docker compose -f $(COMPOSE_DIR)/docker-compose.yml build

local:
	@echo "🚀 Starting app locally..."
	npm ci
	npx vite build --config frontend/vite.config.ts
	rm -rf build/app/frontend
	mv frontend/dist build/app/frontend
	cp build/frontend/config.json build/app/frontend
	npm run build:backend
	cp package.json build/app/
	cp package-lock.json build/app/
	cp build/backend/.env build/app/backend/
	rm -rf build/app/node_modules
	ln -s node_modules build/app/node_modules
	node --version
	$(TERMINAL) -e "$(SHELL) -c 'source $(SHELLRC) && cd build/app && node backend/app.js; exec $(SHELL)'" &
	$(TERMINAL) -e "$(SHELL) -c 'source $(SHELLRC) && npx serve build/app/frontend -p 8000; exec $(SHELL)'" &

.PHONY: all up down build
