# AI Road Damage Detection — common developer commands
# Each service can also be run directly; see README.md.

.PHONY: help install dev dev-backend dev-frontend dev-ai test lint build smoke up down

help:
	@echo "AI Road Damage Detection — make targets:"
	@echo "  install       Install all dependencies (frontend, backend, ai-service)"
	@echo "  dev           Run backend + AI service + frontend (three processes)"
	@echo "  test          Run all test suites"
	@echo "  lint          Run all linters"
	@echo "  build         Production builds (frontend + backend)"
	@echo "  smoke         End-to-end HTTP smoke test against a running stack"
	@echo "  up / down     Start / stop the full stack with Docker Compose"

install:
	cd backend && npm install
	cd frontend && npm install
	cd ai-service && python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt -r requirements-dev.txt

dev:
	@echo "Starting backend (:5000), AI service (:8000) and frontend (:5173)..."
	@$(MAKE) -j3 dev-backend dev-ai dev-frontend

dev-backend:
	cd backend && npm run dev

dev-frontend:
	cd frontend && npm run dev

dev-ai:
	cd ai-service && . .venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

test:
	cd backend && npm test
	cd frontend && npm test
	cd ai-service && . .venv/bin/activate && python -m pytest

lint:
	cd backend && npm run lint
	cd frontend && npm run lint
	cd ai-service && . .venv/bin/activate && ruff check app tests

build:
	cd backend && npm run build
	cd frontend && npm run build

smoke:
	bash scripts/smoke.sh

up:
	docker compose up --build

down:
	docker compose down -v
