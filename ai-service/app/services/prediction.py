"""Prediction orchestration: preprocess → infer → severity → visualise → format.

Kept free of FastAPI concerns so the pipeline can be unit-tested directly.
"""

from __future__ import annotations

import logging
import time

from ..core.config import Settings
from ..models.registry import EngineState
from ..schemas.prediction import (
    BBox,
    Detection,
    DetectionSummary,
    ImageInfo,
    ModelInfo,
    PredictionResponse,
)
from ..services.preprocessing import decode_image
from ..services.severity import SeverityEstimator, max_severity
from ..services.visualization import (
    AnnotationSpec,
    annotate_image,
    class_color_map,
    encode_jpeg_base64,
)

logger = logging.getLogger(__name__)

# Multiplier converting a severity weight (classes.json) into a colour-friendly prior.
_CLASS_WEIGHT_SCALE = 1.0


class PredictionService:
    """Coordinates a full prediction run."""

    def __init__(self, state: EngineState, settings: Settings, class_config: dict) -> None:
        self._state = state
        self._settings = settings
        self._class_config = class_config
        self._class_colors = class_color_map(class_config)

        weights = {
            entry["name"]: float(entry.get("severity_weight", 0.4)) * _CLASS_WEIGHT_SCALE
            for entry in class_config.get("classes", [])
            if isinstance(entry.get("name"), str)
        }
        self._severity = SeverityEstimator(weights or None)

    def run(self, image_bytes: bytes) -> PredictionResponse:
        started = time.perf_counter()
        engine = self._state.require_engine()

        decoded = decode_image(image_bytes, max_bytes=self._settings.max_image_bytes)
        raw = engine.predict(decoded.array)
        raw = raw[: self._settings.max_detections]

        detections: list[Detection] = []
        severities: list[str] = []
        counts_by_class: dict[str, int] = {}
        counts_by_severity: dict[str, int] = {"low": 0, "moderate": 0, "high": 0}
        specs: list[AnnotationSpec] = []

        for item in raw:
            sev = self._severity.estimate(item, decoded.width, decoded.height)
            detections.append(
                Detection(
                    class_id=item.class_id,
                    class_name=item.class_name,
                    confidence=round(item.confidence, 4),
                    bbox=BBox(
                        x1=round(item.x1, 2),
                        y1=round(item.y1, 2),
                        x2=round(item.x2, 2),
                        y2=round(item.y2, 2),
                    ),
                    severity=sev.severity,  # type: ignore[arg-type]
                    severity_score=sev.score,
                    area_ratio=sev.area_ratio,
                )
            )
            severities.append(sev.severity)
            counts_by_class[item.class_name] = counts_by_class.get(item.class_name, 0) + 1
            counts_by_severity[sev.severity] += 1
            specs.append(
                AnnotationSpec(
                    x1=item.x1,
                    y1=item.y1,
                    x2=item.x2,
                    y2=item.y2,
                    label=item.class_name.replace("_", " ").title(),
                    confidence=item.confidence,
                    severity=sev.severity,
                    color=self._class_colors.get(item.class_name, "#38bdf8"),
                )
            )

        annotated = annotate_image(decoded.array, specs)
        annotated_b64 = encode_jpeg_base64(annotated)

        elapsed_ms = (time.perf_counter() - started) * 1000.0
        info = engine.info()
        demo = info.demo

        warnings = list(self._state.warnings) if demo else []
        if demo:
            warnings.append(
                "DEMO MODE: these detections are heuristic placeholders, not real model inference."
            )

        logger.info(
            "prediction_complete demo=%s detections=%d time_ms=%.1f",
            demo,
            len(detections),
            elapsed_ms,
        )

        return PredictionResponse(
            success=True,
            demo=demo,
            model=ModelInfo(
                name=info.name,
                version=info.version,
                engine=info.engine,
                device=info.device,
                demo=demo,
                classes=list(info.classes),
                confidence_threshold=self._settings.confidence_threshold,
                iou_threshold=self._settings.iou_threshold,
            ),
            image=ImageInfo(width=decoded.width, height=decoded.height, format=decoded.format),
            detections=detections,
            summary=DetectionSummary(
                detection_count=len(detections),
                counts_by_class=counts_by_class,
                counts_by_severity=counts_by_severity,
                max_severity=max_severity(severities),  # type: ignore[arg-type]
            ),
            processing_time_ms=round(elapsed_ms, 2),
            annotated_image_base64=annotated_b64,
            warnings=warnings,
        )
