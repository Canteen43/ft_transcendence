all: up

up: build-frontend run-frontend build-backend run-backend
	
build-frontend:
	docker build -f build/frontend/Dockerfile -t frontend-image .

run-frontend:
	docker run -d --env-file build/frontend/prod.env -p 8000:80 --name frontend-container frontend-image
	
build-backend:
	docker build -f build/backend/Dockerfile -t backend-image .

run-backend:
	docker run -d --env-file build/backend/prod.env -p 8080:8080 --name backend-container backend-image

.PHONY: all up run-backend build-backend
