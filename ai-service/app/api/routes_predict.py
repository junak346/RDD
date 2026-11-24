"""HTTP routes for prediction and model introspection."""

from __future__ import annotations

import base64
import logging

from fastapi import APIRouter, File, Request, UploadFile

from ..core.errors import ImageTooLargeError, MissingFileError
from ..schemas.prediction import HealthResponse, ModelInfo, PredictionResponse

logger = logging.getLogger(__name__)

router = APIRouter()


def _settings_of(request: Request):
    return request.app.state.settings


def _service_of(request: Request):
    return request.app.state.prediction_service


@router.post(
    "/predict",
    response_model=PredictionResponse,
    responses={
        400: {"description": "Invalid image"},
        413: {"description": "Image too large"},
        422: {"description": "Missing image"},
        503: {"description": "Model unavailable"},
    },
    summary="Analyse a road image for damage",
)
async def predict(
    request: Request,
    file: UploadFile | None = File(default=None),  # noqa: B008 — idiomatic FastAPI default
) -> PredictionResponse:
    """Accepts a multipart upload (field ``file``).

    The response always states whether real inference or the labelled demo
    engine produced it (``demo: true`` means NOT a trained model).
    """
    settings = _settings_of(request)
    service = _service_of(request)

    raw: bytes
    if file is not None:
        raw = await file.read()
    else:
        # Allow a JSON body {"image_base64": "..."} for quick API testing.
        body = await _safe_json(request)
        payload = body.get("image_base64") if isinstance(body, dict) else None
        if not isinstance(payload, str) or not payload:
            raise MissingFileError()
        try:
            raw = base64.b64decode(payload, validate=True)
        except ValueError as exc:  # binascii.Error is a ValueError subclass
            raise MissingFileError("image_base64 is not valid base64 data.") from exc

    if len(raw) > settings.max_image_bytes:
        raise ImageTooLargeError()

    return service.run(raw)


async def _safe_json(request: Request) -> dict | None:
    try:
        return await request.json()
    except Exception:  # noqa: BLE001 — any malformed body is treated as "no JSON"
        return None


@router.get(
    "/model/info",
    response_model=ModelInfo,
    summary="Describe the active detection engine",
)
async def model_info(request: Request) -> ModelInfo:
    settings = _settings_of(request)
    state = request.app.state.engine_state
    engine = state.engine
    if engine is None:
        return ModelInfo(
            name=settings.model_name,
            version=settings.model_version,
            engine="unavailable",
            device=settings.device,
            demo=False,
            classes=[],
            confidence_threshold=settings.confidence_threshold,
            iou_threshold=settings.iou_threshold,
        )
    info = engine.info()
    return ModelInfo(
        name=info.name,
        version=info.version,
        engine=info.engine,
        device=info.device,
        demo=info.demo,
        classes=list(info.classes),
        confidence_threshold=settings.confidence_threshold,
        iou_threshold=settings.iou_threshold,
    )


@router.get("/health", response_model=HealthResponse, summary="Service health")
async def health(request: Request) -> HealthResponse:
    state = request.app.state.engine_state
    settings = _settings_of(request)
    if state.engine is None:
        return HealthResponse(
            status="degraded",
            mode=settings.mode,
            engine=None,
            model_loaded=False,
            demo=False,
            version=request.app.state.version,
        )
    info = state.engine.info()
    return HealthResponse(
        status="ok",
        mode=state.active_mode,
        engine=info.engine,
        model_loaded=True,
        demo=info.demo,
        version=request.app.state.version,
    )
