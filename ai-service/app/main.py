"""FastAPI application entry point for the AI inference service.

Run locally:
    uvicorn app.main:app --host 0.0.0.0 --port 8000

OpenAPI docs are served at /docs (see docs/API.md for the REST backend).
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api.routes_predict import router as predict_router
from .core.config import Settings, load_settings
from .core.errors import AIServiceError
from .core.logging import configure_logging, get_logger
from .models.registry import create_engine_state, load_class_config
from .services.prediction import PredictionService

SERVICE_NAME = "ai-road-damage-detection-inference"
SERVICE_VERSION = "1.0.0"

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings: Settings = app.state.settings
    configure_logging(settings.log_level)
    logger.info(
        "Starting %s v%s (mode=%s, model_path=%s)",
        SERVICE_NAME,
        SERVICE_VERSION,
        settings.mode,
        settings.model_path,
    )
    state = create_engine_state(settings)
    app.state.engine_state = state
    class_config = load_class_config(settings.resolved_classes_path)
    app.state.prediction_service = PredictionService(state, settings, class_config)
    for warning in state.warnings:
        logger.warning(warning)
    yield
    logger.info("Shutting down %s", SERVICE_NAME)


def create_app(settings: Settings | None = None) -> FastAPI:
    """Application factory (used by tests and by the uvicorn entry point)."""
    resolved = settings or load_settings()

    app = FastAPI(
        title="AI Road Damage Detection — Inference Service",
        version=SERVICE_VERSION,
        description=(
            "Computer-vision inference for road damage (potholes, cracks, surface damage). "
            "Responses carry a `demo` flag: when true, results come from the clearly-labelled "
            "demo engine and are NOT real model inference."
        ),
        lifespan=lifespan,
        docs_url="/docs",
        openapi_url="/openapi.json",
    )
    app.state.settings = resolved
    app.state.version = SERVICE_VERSION

    # The Node.js backend is the only intended caller, but CORS is open for
    # local API exploration with tools like the OpenAPI docs page.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )

    @app.exception_handler(AIServiceError)
    async def handle_service_error(_request: Request, exc: AIServiceError) -> JSONResponse:
        logger.info("Request rejected: %s (%s)", exc.code, exc.message)
        return JSONResponse(
            status_code=exc.status_code,
            content={"success": False, "error": {"code": exc.code, "message": exc.message}},
        )

    @app.exception_handler(Exception)
    async def handle_unexpected(_request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": {"code": "INTERNAL_ERROR", "message": "An unexpected error occurred."},
            },
        )

    app.include_router(predict_router, tags=["inference"])

    @app.get("/", include_in_schema=False)
    async def root() -> dict:
        return {
            "service": SERVICE_NAME,
            "version": SERVICE_VERSION,
            "docs": "/docs",
            "health": "/health",
        }

    return app


app = create_app()
