include build/.env
export $(shell sed 's/=.*//' build/.env)

COMPOSE_DIR=./build
DB_DIR=${COMPOSE_DIR}/database
TERMINAL=/usr/bin/gnome-terminal
SHELL=zsh
SHELLRC=~/.zshrc

SANS := "DNS:$(HOSTNAME),DNS:$(COMPUTERNAME),DNS:localhost"

all: up

up: ${DB_DIR}
	@docker compose -f $(COMPOSE_DIR)/docker-compose.yml up -d

down:
	@docker compose -f $(COMPOSE_DIR)/docker-compose.yml down

build: ${DB_DIR} $(CERT_DIR)/$(CERT_KEY_FILE) $(CERT_DIR)/$(CERT_FILE)
	@docker compose -f $(COMPOSE_DIR)/docker-compose.yml build

${DB_DIR}:
	mkdir -p ${DB_DIR}

$(CERT_DIR):
	mkdir -p $(CERT_DIR)

$(CERT_DIR)/$(CERT_KEY_FILE) $(CERT_DIR)/$(CERT_FILE): | $(CERT_DIR)
	@echo "\033[0;32mCertificate not found, generating self-signed HTTPS certificate...\033[0m"
	openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
		-keyout $(CERT_DIR)/$(CERT_KEY_FILE) \
		-out $(CERT_DIR)/$(CERT_FILE) \
		-subj "/C=DE/ST=Berlin/L=Berlin/O=42/OU=Transcendence/CN=$(HOSTNAME)" \
		-addext "subjectAltName=$(SANS)"

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
