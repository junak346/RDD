"""Visualisation utilities."""

import base64

import numpy as np

from app.services.visualization import (
    AnnotationSpec,
    annotate_image,
    class_color_map,
    encode_jpeg_base64,
)


def test_annotate_returns_same_size_image():
    image = np.zeros((120, 160, 3), dtype=np.uint8)
    specs = [
        AnnotationSpec(10, 10, 60, 50, "Pothole", 0.9, "high", "#ef4444"),
        AnnotationSpec(-20, -20, 400, 400, "Crack", 0.5, "low", "#f59e0b"),  # clipped
    ]
    annotated = annotate_image(image, specs)
    assert annotated.size == (160, 120)


def test_encode_jpeg_base64_roundtrip():
    image = np.full((40, 40, 3), 128, dtype=np.uint8)
    encoded = encode_jpeg_base64(annotate_image(image, []))
    decoded = base64.b64decode(encoded)
    assert decoded[:2] == b"\xff\xd8"


def test_class_color_map_from_config():
    config = {
        "classes": [
            {"name": "pothole", "color": "#ff0000"},
            {"name": "crack"},  # missing color → fallback
        ]
    }
    colors = class_color_map(config)
    assert colors["pothole"] == "#ff0000"
    assert colors["crack"].startswith("#")
