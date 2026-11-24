"""Detection visualisation: draws boxes, labels and confidence chips."""

from __future__ import annotations

import base64
import io
import logging

import numpy as np
from PIL import Image, ImageDraw, ImageFont

logger = logging.getLogger(__name__)

_SEVERITY_COLORS = {
    "low": "#22c55e",
    "moderate": "#f59e0b",
    "high": "#ef4444",
}
_FALLBACK_CLASS_COLOR = "#38bdf8"
_BOX_WIDTH = 3
_FONT_CANDIDATES = (
    "DejaVuSans.ttf",
    "DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "Arial.ttf",
)


def _load_font(size: int) -> ImageFont.ImageFont:
    for candidate in _FONT_CANDIDATES:
        try:
            return ImageFont.truetype(candidate, size=size)
        except OSError:
            continue
    logger.debug("No TrueType font found — falling back to the default bitmap font")
    return ImageFont.load_default()


def _hex_to_rgb(color: str) -> tuple[int, int, int]:
    value = color.lstrip("#")
    if len(value) != 6:
        return (56, 189, 248)
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


class AnnotationSpec:
    """One box to draw."""

    __slots__ = ("x1", "y1", "x2", "y2", "label", "confidence", "severity", "color")

    def __init__(
        self,
        x1: float,
        y1: float,
        x2: float,
        y2: float,
        label: str,
        confidence: float,
        severity: str,
        color: str,
    ) -> None:
        self.x1, self.y1, self.x2, self.y2 = x1, y1, x2, y2
        self.label = label
        self.confidence = confidence
        self.severity = severity
        self.color = color


def annotate_image(image_rgb: np.ndarray, specs: list[AnnotationSpec]) -> Image.Image:
    """Return a new PIL image with detections drawn (input array untouched)."""
    base = Image.fromarray(image_rgb.copy())
    draw = ImageDraw.Draw(base)
    width, height = base.size

    font_size = max(12, min(width, height) // 40)
    font = _load_font(font_size)

    for spec in specs:
        x1 = max(0.0, min(float(width - 1), spec.x1))
        y1 = max(0.0, min(float(height - 1), spec.y1))
        x2 = max(0.0, min(float(width - 1), spec.x2))
        y2 = max(0.0, min(float(height - 1), spec.y2))
        if x2 <= x1 or y2 <= y1:
            continue

        box_color = _hex_to_rgb(spec.color)
        draw.rectangle([x1, y1, x2, y2], outline=box_color, width=_BOX_WIDTH)

        text = f"{spec.label} {spec.confidence * 100:.0f}% · {spec.severity}"
        text_bbox = draw.textbbox((0, 0), text, font=font)
        text_w = text_bbox[2] - text_bbox[0]
        text_h = text_bbox[3] - text_bbox[1]
        pad = max(2, font_size // 4)

        # Keep the chip inside the image.
        chip_x = max(0.0, min(x1, width - text_w - 2 * pad))
        chip_y = y1 - text_h - 2 * pad
        if chip_y < 0:
            chip_y = y1  # place inside the box when there is no room above

        draw.rectangle(
            [chip_x, chip_y, chip_x + text_w + 2 * pad, chip_y + text_h + 2 * pad],
            fill=box_color,
        )
        draw.text((chip_x + pad, chip_y + pad), text, fill=(255, 255, 255), font=font)

    return base


def encode_jpeg_base64(image: Image.Image, quality: int = 88) -> str:
    """Encode a PIL image as base64 JPEG (ASCII string)."""
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=quality)
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def class_color_map(class_config: dict) -> dict[str, str]:
    """Map class name → hex color from the configurable class catalogue."""
    colors: dict[str, str] = {}
    for entry in class_config.get("classes", []):
        name = entry.get("name")
        color = entry.get("color", _FALLBACK_CLASS_COLOR)
        if isinstance(name, str):
            colors[name] = color if isinstance(color, str) else _FALLBACK_CLASS_COLOR
    return colors
