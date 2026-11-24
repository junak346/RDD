"""Application configuration loaded from environment variables.

No secret material lives here. Every value can be overridden via the
environment — see .env.example at the repository root.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

VALID_MODES = ("auto", "real", "demo")
VALID_DEVICES = ("auto", "cpu", "cuda")

# Hard limits that protect the service from malicious or broken uploads.
MAX_IMAGE_DIMENSION = 8000
MAX_IMAGE_PIXELS = 40_000_000  # 40 megapixels
DEFAULT_MAX_DETECTIONS = 100


@dataclass(frozen=True)
class Settings:
    """Runtime settings for the AI service."""

    host: str = "0.0.0.0"
    port: int = 8000
    # "auto"  — use the real model when available, otherwise the labelled demo engine
    # "real"  — only the trained model; predict fails cleanly when it is unavailable
    # "demo"  — force the clearly-labelled demo engine
    mode: str = "auto"
    model_path: str = "models/road_damage_yolo.pt"
    classes_path: str = ""
    confidence_threshold: float = 0.35
    iou_threshold: float = 0.45
    device: str = "auto"
    max_image_mb: int = 16
    max_detections: int = DEFAULT_MAX_DETECTIONS
    log_level: str = "info"
    model_name: str = "road-damage-yolo"
    model_version: str = "unversioned"

    @property
    def max_image_bytes(self) -> int:
        return self.max_image_mb * 1024 * 1024

    @property
    def resolved_classes_path(self) -> Path:
        if self.classes_path:
            return Path(self.classes_path)
        return Path(__file__).resolve().parent.parent / "classes.json"


def _env_str(name: str, default: str) -> str:
    value = os.environ.get(name, "").strip()
    return value if value else default


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError as exc:
        raise ValueError(f"Environment variable {name} must be a number, got {raw!r}") from exc


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError as exc:
        raise ValueError(f"Environment variable {name} must be an integer, got {raw!r}") from exc


def load_settings() -> Settings:
    """Build settings from the environment, validating constrained values."""
    mode = _env_str("AI_MODE", "auto").lower()
    if mode not in VALID_MODES:
        raise ValueError(f"AI_MODE must be one of {VALID_MODES}, got {mode!r}")

    device = _env_str("MODEL_DEVICE", "auto").lower()
    if device not in VALID_DEVICES:
        raise ValueError(f"MODEL_DEVICE must be one of {VALID_DEVICES}, got {device!r}")

    confidence = _env_float("MODEL_CONFIDENCE_THRESHOLD", 0.35)
    if not 0.0 < confidence < 1.0:
        raise ValueError("MODEL_CONFIDENCE_THRESHOLD must be between 0 and 1")

    iou = _env_float("MODEL_IOU_THRESHOLD", 0.45)
    if not 0.0 < iou < 1.0:
        raise ValueError("MODEL_IOU_THRESHOLD must be between 0 and 1")

    return Settings(
        host=_env_str("AI_HOST", "0.0.0.0"),
        port=_env_int("AI_PORT", 8000),
        mode=mode,
        model_path=_env_str("MODEL_PATH", "models/road_damage_yolo.pt"),
        classes_path=_env_str("AI_CLASSES_PATH", ""),
        confidence_threshold=confidence,
        iou_threshold=iou,
        device=device,
        max_image_mb=_env_int("AI_MAX_IMAGE_MB", 16),
        max_detections=_env_int("AI_MAX_DETECTIONS", DEFAULT_MAX_DETECTIONS),
        log_level=_env_str("LOG_LEVEL", "info").lower(),
        model_name=_env_str("MODEL_NAME", "road-damage-yolo"),
        model_version=_env_str("MODEL_VERSION", "unversioned"),
    )
