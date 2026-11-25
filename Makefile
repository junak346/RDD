# RoadVision — common developer commands. See README.md and docs/DEPLOYMENT.md.
SHELL := /bin/bash

.PHONY: help install dev dev-backend dev-frontend dev-ai test lint typecheck build validate smoke compose-config provision-official up down down-volumes

help:
	@echo "RoadVision — make targets:"
	@echo "  install            Install all dependencies (frontend, backend, ai-service)"
	@echo "  dev                Run backend + AI service + frontend (three processes)"
	@echo "  test               Run backend, frontend and AI-service test suites"
	@echo "  lint               Run all linters"
	@echo "  typecheck          Run backend and frontend TypeScript checks"
	@echo "  build              Production builds (frontend + backend)"
	@echo "  validate           Lint + typecheck + test + build (all services)"
	@echo "  smoke              End-to-end HTTP smoke test against a running stack"
	@echo "  compose-config     Validate docker-compose.yml (requires .env)"
	@echo "  provision-official Controlled first official account (DATA_MODE=mongo)"
	@echo "  up / down          Start / stop the full stack with Docker Compose"

install:
	cd backend && npm ci --no-audit --no-fund
	cd frontend && npm ci --no-audit --no-fund
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
	cd backend && npm test -- --reporter=dot
	cd frontend && npm test
	cd ai-service && . .venv/bin/activate && python -m pytest -q

lint:
	cd backend && npm run lint
	cd frontend && npm run lint
	cd ai-service && . .venv/bin/activate && ruff check app tests

typecheck:
	cd backend && npx tsc -p tsconfig.build.json --noEmit
	cd frontend && npx tsc --noEmit

build:
	cd backend && npm run build
	cd frontend && npm run build

validate: lint typecheck test build

smoke:
	bash scripts/smoke.sh

compose-config:
	docker compose config

provision-official:
	cd backend && npm run provision:official

up:
	docker compose up --build -d

down:
	docker compose down

down-volumes:
	docker compose down -v
