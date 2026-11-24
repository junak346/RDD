"""Real YOLO inference backend (Ultralytics).

This module contains the *production* inference path. It lazy-imports the
optional ML stack (`requirements-ml.txt`) so the service still boots in
environments where torch/ultralytics are not installed — in that case a
`ModelUnavailableError` explains exactly what to install.

Model weights are NOT shipped with the repository (see docs/AI_MODEL.md).
Point `MODEL_PATH` at trained road-damage weights to enable real inference.
"""

from __future__ import annotations

import logging
from pathlib import Path

import numpy as np

from ..models.base import DetectionEngine, EngineInfo, RawDetection

logger = logging.getLogger(__name__)


class YoloEngine(DetectionEngine):
    """Ultralytics YOLO backend with a configurable class map."""

    def __init__(
        self,
        model_path: str,
        *,
        confidence_threshold: float,
        iou_threshold: float,
        device: str,
        name: str,
        version: str,
    ) -> None:
        self._model_path = Path(model_path)
        self._confidence = confidence_threshold
        self._iou = iou_threshold
        self._device = device
        self._name = name
        self._version = version
        self._model = None
        self._class_names: tuple[str, ...] = ()
        self._device_resolved = device
        self._load()

    # -- loading ------------------------------------------------------------

    def _load(self) -> None:
        try:
            from ultralytics import YOLO  # noqa: PLC0415 — optional heavy dependency
        except ImportError as exc:
            raise RuntimeError(
                "The ML stack is not installed. Install it with: "
                "pip install -r requirements.txt -r requirements-ml.txt"
            ) from exc

        if not self._model_path.is_file():
            raise FileNotFoundError(
                f"Model weights not found at '{self._model_path}'. "
                "See docs/AI_MODEL.md for how to supply trained weights."
            )

        logger.info("Loading YOLO weights from %s", self._model_path)
        self._model = YOLO(str(self._model_path))
        names = getattr(self._model, "names", None) or {}
        self._class_names = tuple(names[i] for i in sorted(names))
        self._device_resolved = self._resolve_device()
        logger.info(
            "YOLO model loaded (%d classes, device=%s)", len(self._class_names), self._device_resolved
        )

    def _resolve_device(self) -> str:
        if self._device != "auto":
            return self._device
        try:
            import torch  # noqa: PLC0415

            return "cuda:0" if torch.cuda.is_available() else "cpu"
        except ImportError:
            return "cpu"

    # -- engine interface ---------------------------------------------------

    def info(self) -> EngineInfo:
        return EngineInfo(
            name=self._name,
            version=self._version,
            engine="yolo",
            device=self._device_resolved,
            demo=False,
            classes=self._class_names,
        )

    def warmup(self) -> None:
        """Run a tiny dummy inference so the first real request is faster."""
        if self._model is None:
            return
        dummy = np.zeros((64, 64, 3), dtype=np.uint8)
        self._run_inference(dummy)

    def predict(self, image_rgb: np.ndarray) -> list[RawDetection]:
        results = self._run_inference(image_rgb)
        detections: list[RawDetection] = []
        for result in results:
            boxes = getattr(result, "boxes", None)
            if boxes is None:
                continue
            xyxyn = boxes.xyxy.cpu().numpy()  # absolute pixel coordinates
            confs = boxes.conf.cpu().numpy()
            clss = boxes.cls.cpu().numpy().astype(int)
            for (x1, y1, x2, y2), confidence, class_id in zip(xyxyn, confs, clss, strict=True):
                class_name = (
                    self._class_names[class_id]
                    if 0 <= class_id < len(self._class_names)
                    else f"class_{class_id}"
                )
                detections.append(
                    RawDetection(
                        class_id=int(class_id),
                        class_name=str(class_name),
                        confidence=float(confidence),
                        x1=float(x1),
                        y1=float(y1),
                        x2=float(x2),
                        y2=float(y2),
                    )
                )
        return detections

    # -- internals ----------------------------------------------------------

    def _run_inference(self, image_rgb: np.ndarray):
        if self._model is None:
            raise RuntimeError("YOLO model is not loaded.")
        # Ultralytics interprets numpy input as OpenCV BGR — convert from RGB.
        image_bgr = np.ascontiguousarray(image_rgb[:, :, ::-1])
        return self._model.predict(
            source=image_bgr,
            conf=self._confidence,
            iou=self._iou,
            device=self._device_resolved,
            verbose=False,
        )
