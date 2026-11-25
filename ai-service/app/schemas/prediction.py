"""Typed request/response schemas for the AI service (OpenAPI-visible)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Severity = Literal["low", "moderate", "high"]


class BBox(BaseModel):
    """Axis-aligned bounding box in original-image pixel coordinates."""

    x1: float = Field(..., description="Left edge (px)")
    y1: float = Field(..., description="Top edge (px)")
    x2: float = Field(..., description="Right edge (px)")
    y2: float = Field(..., description="Bottom edge (px)")


class Detection(BaseModel):
    class_id: int
    class_name: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    bbox: BBox
    severity: Severity
    severity_score: float = Field(..., ge=0.0, le=1.0)
    area_ratio: float = Field(..., ge=0.0, le=1.0, description="bbox area / image area")
    segmentation: list[list[float]] | None = Field(
        default=None,
        description="Optional polygon points [x, y] from a segmentation-capable model",
    )


class ModelInfo(BaseModel):
    name: str
    version: str
    engine: str = Field(..., description="yolo | demo")
    device: str
    demo: bool = Field(..., description="True when detections are NOT from a trained model")
    classes: list[str]
    confidence_threshold: float
    iou_threshold: float


class ImageInfo(BaseModel):
    width: int
    height: int
    format: str


class DetectionSummary(BaseModel):
    detection_count: int
    counts_by_class: dict[str, int]
    counts_by_severity: dict[str, int]
    max_severity: Severity | None = None


class PredictionResponse(BaseModel):
    success: bool = True
    demo: bool = Field(..., description="True when produced by the labelled demo engine")
    model: ModelInfo
    image: ImageInfo
    detections: list[Detection]
    summary: DetectionSummary
    processing_time_ms: float
    annotated_image_base64: str = Field(..., description="JPEG (base64) with boxes and labels drawn")
    warnings: list[str] = Field(default_factory=list)


class HealthResponse(BaseModel):
    status: str
    mode: str
    engine: str | None = None
    model_loaded: bool
    demo: bool
    version: str


class ErrorResponse(BaseModel):
    success: bool = False
    error: dict[str, str]
