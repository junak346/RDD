"""MODEL_CONFIDENCE_THRESHOLD is applied by the prediction service, not scattered."""

from __future__ import annotations

import numpy as np

from app.core.config import Settings
from app.models.base import DetectionEngine, EngineInfo, RawDetection
from app.models.registry import EngineState
from app.services.prediction import PredictionService


class FakeEngine(DetectionEngine):
    """One fixed detection, optionally with a segmentation polygon."""

    def __init__(self, confidence: float, segmentation: list[list[float]] | None = None) -> None:
        self._confidence = confidence
        self._segmentation = segmentation

    def info(self) -> EngineInfo:
        return EngineInfo(
            name="test-engine",
            version="1.0.0",
            engine="yolo",
            device="cpu",
            demo=False,
            classes=("pothole",),
        )

    def predict(self, image_rgb: np.ndarray) -> list[RawDetection]:
        del image_rgb
        return [
            RawDetection(
                class_id=0,
                class_name="pothole",
                confidence=self._confidence,
                x1=10,
                y1=10,
                x2=80,
                y2=80,
                segmentation=self._segmentation,
            )
        ]


def _run(confidence: float, threshold: float, segmentation: list[list[float]] | None, image: bytes):
    settings = Settings(mode="demo", max_image_mb=2, confidence_threshold=threshold)
    state = EngineState(engine=FakeEngine(confidence, segmentation), active_mode="real", warnings=[])
    service = PredictionService(state, settings, {"classes": [{"name": "pothole", "severity_weight": 1.0}]})
    return service.run(image)


def test_low_confidence_detection_is_gated_by_configured_threshold(sample_image_bytes):
    response = _run(confidence=0.42, threshold=0.9, segmentation=None, image=sample_image_bytes)

    assert response.model.confidence_threshold == 0.9
    assert response.summary.detection_count == 0
    assert "No road damage detected." in response.warnings


def test_optional_segmentation_is_preserved_when_present(sample_image_bytes):
    polygon = [[10.0, 10.0], [80.0, 10.0], [80.0, 80.0], [10.0, 80.0]]
    response = _run(confidence=0.95, threshold=0.35, segmentation=polygon, image=sample_image_bytes)

    assert response.summary.detection_count == 1
    assert response.detections[0].segmentation == polygon
