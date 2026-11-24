"""Engine selection: decides between the real YOLO model and the demo engine.

Selection policy (`AI_MODE`):

* ``auto`` — use the real model when weights + ML stack are available,
  otherwise fall back to the clearly-labelled demo engine (with a warning).
* ``real`` — real model only. When unavailable the service starts in a
  degraded state and ``/predict`` answers 503 (graceful failure), it never
  silently swaps in demo behaviour.
* ``demo`` — force the demo engine.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path

from ..core.config import Settings
from ..core.errors import ModelUnavailableError
from ..models.base import DetectionEngine
from ..models.demo_engine import DemoEngine
from ..models.yolo_engine import YoloEngine

logger = logging.getLogger(__name__)


@dataclass
class EngineState:
    """Container for the process-wide engine instance."""

    engine: DetectionEngine | None = None
    active_mode: str = "demo"
    warnings: list[str] = field(default_factory=list)

    @property
    def demo(self) -> bool:
        return self.engine is None or self.engine.info().demo

    def require_engine(self) -> DetectionEngine:
        if self.engine is None:
            raise ModelUnavailableError()
        return self.engine


def load_class_config(classes_path: Path) -> dict:
    """Load the configurable damage-class catalogue (labels, colors, priors)."""
    try:
        with classes_path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
        if not isinstance(data.get("classes"), list):
            raise ValueError("classes.json must contain a 'classes' list")
        return data
    except FileNotFoundError:
        logger.warning("Class config not found at %s — using built-in defaults", classes_path)
        return {"classes": []}
    except (ValueError, json.JSONDecodeError) as exc:
        logger.error("Ignoring invalid class config %s: %s", classes_path, exc)
        return {"classes": []}


def _try_load_yolo(settings: Settings) -> tuple[DetectionEngine | None, str | None]:
    """Attempt to construct the real YOLO engine; return (engine, error_message)."""
    try:
        engine = YoloEngine(
            settings.model_path,
            confidence_threshold=settings.confidence_threshold,
            iou_threshold=settings.iou_threshold,
            device=settings.device,
            name=settings.model_name,
            version=settings.model_version,
        )
        engine.warmup()
        return engine, None
    except (ImportError, RuntimeError, FileNotFoundError, OSError) as exc:
        logger.warning("Real YOLO engine unavailable: %s", exc)
        return None, str(exc)


def create_engine_state(settings: Settings) -> EngineState:
    """Apply the selection policy and return the engine state for this process."""
    state = EngineState()

    if settings.mode == "demo":
        state.engine = DemoEngine()
        state.active_mode = "demo"
        state.warnings.append(
            "AI_MODE=demo — detections come from the labelled demo engine, not a trained model."
        )
        logger.info("Engine: demo engine (forced by AI_MODE=demo)")
        return state

    engine, error = _try_load_yolo(settings)
    if engine is not None:
        state.engine = engine
        state.active_mode = "real"
        logger.info("Engine: real YOLO model (%s)", settings.model_path)
        return state

    if settings.mode == "real":
        state.engine = None
        state.active_mode = "real"
        state.warnings.append(
            f"AI_MODE=real but the model is unavailable: {error}. "
            "/predict will fail gracefully with 503 until weights are installed."
        )
        logger.error("Engine: real mode requested but model unavailable — %s", error)
        return state

    # auto → fall back to demo, loudly labelled.
    state.engine = DemoEngine()
    state.active_mode = "demo"
    state.warnings.append(
        "AI_MODE=auto: no trained model available — falling back to the labelled demo engine. "
        f"Reason: {error}"
    )
    logger.info("Engine: demo engine (auto fallback, real model unavailable)")
    return state
