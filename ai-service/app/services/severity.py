"""Severity estimation layer.

⚠️  IMPORTANT LIMITATION ⚠️
Severity is an ESTIMATE derived from detection characteristics (apparent
damage size relative to the image, detector confidence and class priors). It
is NOT a professional civil-engineering assessment and must not be treated as
an official diagnosis or a safety guarantee. See docs/AI_MODEL.md.

The engine is intentionally modular: swap `SeverityEstimator` for a validated
ruleset or a learned model without touching the API.
"""

from __future__ import annotations

from dataclasses import dataclass

from ..models.base import RawDetection

SEVERITY_LOW = "low"
SEVERITY_MODERATE = "moderate"
SEVERITY_HIGH = "high"
SEVERITIES = (SEVERITY_LOW, SEVERITY_MODERATE, SEVERITY_HIGH)

# Weighting of the three observable signals (must sum to 1.0).
_WEIGHT_AREA = 0.5
_WEIGHT_CONFIDENCE = 0.3
_WEIGHT_CLASS = 0.2

# Score → label thresholds.
_THRESHOLD_MODERATE = 0.35
_THRESHOLD_HIGH = 0.60

# Class priors: how serious a damage type is considered per se (0..1).
DEFAULT_CLASS_WEIGHTS = {
    "pothole": 1.0,
    "crack": 0.7,
    "surface_damage": 0.55,
    "other": 0.4,
}


@dataclass(frozen=True)
class SeverityResult:
    severity: str
    score: float
    area_ratio: float


class SeverityEstimator:
    """Configurable, documented severity rules."""

    def __init__(self, class_weights: dict[str, float] | None = None) -> None:
        self._class_weights = dict(DEFAULT_CLASS_WEIGHTS)
        if class_weights:
            self._class_weights.update(class_weights)

    def estimate(
        self, detection: RawDetection, image_width: int, image_height: int
    ) -> SeverityResult:
        image_area = max(1.0, float(image_width * image_height))
        bbox_area = max(0.0, (detection.x2 - detection.x1)) * max(
            0.0, (detection.y2 - detection.y1)
        )
        area_ratio = min(1.0, bbox_area / image_area)

        # Size signal saturates: covering ~25% of the frame is already "very large".
        area_signal = min(1.0, area_ratio / 0.25)
        confidence_signal = max(0.0, min(1.0, detection.confidence))
        class_signal = self._class_weights.get(
            detection.class_name, self._class_weights.get("other", 0.4)
        )

        score = (
            _WEIGHT_AREA * area_signal
            + _WEIGHT_CONFIDENCE * confidence_signal
            + _WEIGHT_CLASS * class_signal
        )
        score = max(0.0, min(1.0, score))

        if score >= _THRESHOLD_HIGH:
            severity = SEVERITY_HIGH
        elif score >= _THRESHOLD_MODERATE:
            severity = SEVERITY_MODERATE
        else:
            severity = SEVERITY_LOW

        return SeverityResult(severity=severity, score=round(score, 4), area_ratio=round(area_ratio, 6))


def max_severity(severities: list[str]) -> str | None:
    """Return the most severe label of a list, or None for an empty list."""
    for label in (SEVERITY_HIGH, SEVERITY_MODERATE, SEVERITY_LOW):
        if label in severities:
            return label
    return None
