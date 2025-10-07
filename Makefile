all: up

up: build-backend run-backend

run-backend:
	docker run --env-file build/backend/prod.env -p 8080:8080 backend-image

build-backend:
	docker build -f build/backend/Dockerfile -t backend-image .

.PHONY: all up run-backend build-backend
