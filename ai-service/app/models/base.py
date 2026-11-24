"""Detection engine abstraction.

The rest of the application never talks to Ultralytics/PyTorch directly — it
depends on the `DetectionEngine` interface below. This makes the model
replaceable (YOLO variants, future segmentation models, TensorRT exports …)
without touching the API or service layers.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field

import numpy as np


@dataclass(frozen=True)
class RawDetection:
    """One detection as produced by an engine, before severity estimation."""

    class_id: int
    class_name: str
    confidence: float
    x1: float
    y1: float
    x2: float
    y2: float


@dataclass(frozen=True)
class EngineInfo:
    """Static description of the active engine."""

    name: str
    version: str
    engine: str  # "yolo" | "demo"
    device: str
    demo: bool
    classes: tuple[str, ...] = field(default_factory=tuple)


class DetectionEngine(ABC):
    """Interface every inference backend must implement."""

    @abstractmethod
    def info(self) -> EngineInfo:
        """Describe the engine (name, version, classes, demo flag …)."""

    @abstractmethod
    def predict(self, image_rgb: np.ndarray) -> list[RawDetection]:
        """Run inference on an RGB uint8 image (H, W, 3) and return detections
        with bounding boxes in original pixel coordinates."""

    def warmup(self) -> None:  # noqa: B027 — intentionally optional hook
        """Optional: preload weights / run a dummy inference at startup."""
