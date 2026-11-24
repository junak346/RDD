"""Preprocessing / image-validation tests."""

import io

import numpy as np
import pytest
from PIL import Image

from app.core.errors import ImageTooLargeError, InvalidImageError
from app.services.preprocessing import decode_image


def _png_bytes(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def test_decode_valid_png():
    data = _png_bytes(Image.new("RGB", (64, 48), (10, 20, 30)))
    decoded = decode_image(data, max_bytes=1024 * 1024)
    assert decoded.width == 64 and decoded.height == 48
    assert decoded.array.shape == (48, 64, 3)
    assert decoded.format == "png"


def test_decode_empty_bytes_rejected():
    with pytest.raises(InvalidImageError):
        decode_image(b"", max_bytes=1024)


def test_decode_garbage_rejected():
    with pytest.raises(InvalidImageError):
        decode_image(b"not-an-image", max_bytes=1024)


def test_decode_truncated_png_rejected():
    data = _png_bytes(Image.new("RGB", (32, 32), (0, 0, 0)))
    with pytest.raises(InvalidImageError):
        decode_image(data[: len(data) // 2], max_bytes=1024 * 1024)


def test_decode_size_limit_enforced():
    data = _png_bytes(Image.new("RGB", (16, 16), (0, 0, 0)))
    with pytest.raises(ImageTooLargeError):
        decode_image(data, max_bytes=4)  # tiny budget


def test_decode_dimension_limit_enforced(monkeypatch):
    # Simulate a huge canvas without allocating it fully.
    import app.services.preprocessing as preprocessing

    monkeypatch.setattr(preprocessing, "MAX_IMAGE_DIMENSION", 8)
    data = _png_bytes(Image.new("RGB", (32, 32), (0, 0, 0)))
    with pytest.raises(ImageTooLargeError):
        decode_image(data, max_bytes=1024 * 1024)


def test_decode_applies_exif_orientation():
    image = Image.new("RGB", (20, 10), (100, 100, 100))
    buffer = io.BytesIO()
    exif = image.getexif()
    exif[0x0112] = 6  # rotate 270° CW on load
    image.save(buffer, format="JPEG", exif=exif)
    decoded = decode_image(buffer.getvalue(), max_bytes=1024 * 1024)
    # After EXIF transpose the width/height swap.
    assert decoded.width == 10 and decoded.height == 20
    assert isinstance(decoded.array, np.ndarray)
