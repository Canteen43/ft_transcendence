backend:
	docker build -f build/backend/Dockerfile -t backend-image .

.PHONY: backend
