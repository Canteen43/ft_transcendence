COMPOSE_DIR=./build

all: up

up:
	@docker compose -f $(COMPOSE_DIR)/docker-compose.yml up -d

down:
	@docker compose -f $(COMPOSE_DIR)/docker-compose.yml down

build:
	@docker compose -f $(COMPOSE_DIR)/docker-compose.yml build

.PHONY: all up down build
