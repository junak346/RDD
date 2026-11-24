"""Shared fixtures for the AI service test-suite."""

from __future__ import annotations

import io

import numpy as np
import pytest
from PIL import Image

from app.core.config import Settings
from app.main import create_app


@pytest.fixture()
def demo_settings(tmp_path) -> Settings:
    """Settings pinned to the labelled demo engine (no ML stack required)."""
    return Settings(mode="demo", max_image_mb=2)


@pytest.fixture()
def client(demo_settings):
    from fastapi.testclient import TestClient

    app = create_app(demo_settings)
    with TestClient(app) as test_client:
        yield test_client


def _make_image(width: int = 320, height: int = 240, base: int = 150) -> Image.Image:
    """A textured 'road' canvas with a dark pothole blob and a bright crack line."""
    rng = np.random.default_rng(7)
    noise = rng.integers(-12, 12, size=(height, width, 3))
    canvas = np.full((height, width, 3), base, dtype=np.int16) + noise
    canvas = np.clip(canvas, 0, 255).astype(np.uint8)

    # Dark compact region → pothole-like
    canvas[height // 3 : height // 3 + 60, width // 4 : width // 4 + 70] = 35
    # Thin diagonal bright line → crack-like structure (high gradient)
    for i in range(80, 220):
        row = min(height - 2, 100 + (i - 80) // 2)
        canvas[row, i] = 235
        canvas[min(height - 1, row + 1), i] = 225

    return Image.fromarray(canvas)


@pytest.fixture()
def sample_image_bytes() -> bytes:
    buffer = io.BytesIO()
    _make_image().save(buffer, format="PNG")
    return buffer.getvalue()


@pytest.fixture()
def flat_image_bytes() -> bytes:
    """Uniform white image — should produce no (or very few) detections."""
    buffer = io.BytesIO()
    Image.new("RGB", (200, 150), (245, 245, 245)).save(buffer, format="PNG")
    return buffer.getvalue()


@pytest.fixture()
def image_dims() -> tuple[int, int]:
    return 320, 240
