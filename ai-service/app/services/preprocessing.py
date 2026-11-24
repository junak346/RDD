"""Image decoding and validation.

Protects the service from corrupted files, decompression bombs and absurd
dimensions. Uploaded bytes are never trusted beyond what Pillow can decode.
"""

from __future__ import annotations

import io
from dataclasses import dataclass

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

from ..core.config import MAX_IMAGE_DIMENSION, MAX_IMAGE_PIXELS
from ..core.errors import ImageTooLargeError, InvalidImageError

# Refuse decompression bombs outright instead of warning.
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS


@dataclass(frozen=True)
class DecodedImage:
    """A validated image as an RGB array plus metadata."""

    array: np.ndarray  # uint8 (H, W, 3), RGB
    width: int
    height: int
    format: str


def decode_image(data: bytes, *, max_bytes: int) -> DecodedImage:
    """Decode and validate raw image bytes into an RGB numpy array.

    Raises:
        InvalidImageError: bytes are not a decodable image of a supported type.
        ImageTooLargeError: bytes exceed `max_bytes` or the image is absurdly large.
    """
    if not data:
        raise InvalidImageError("The uploaded image is empty.")
    if len(data) > max_bytes:
        raise ImageTooLargeError(
            f"Image is {len(data) / (1024 * 1024):.1f} MB which exceeds the "
            f"{max_bytes / (1024 * 1024):.0f} MB limit."
        )

    try:
        image = Image.open(io.BytesIO(data))
        image.load()  # force full decode now so truncated files fail here
    except UnidentifiedImageError as exc:
        raise InvalidImageError("The file could not be identified as an image.") from exc
    except Image.DecompressionBombError as exc:
        raise ImageTooLargeError("Image resolution is unreasonably large.") from exc
    except OSError as exc:
        raise InvalidImageError(f"The image appears to be corrupted ({exc}).") from exc

    image_format = (image.format or "unknown").lower()
    if image_format not in ("jpeg", "png", "webp", "bmp", "gif", "tiff"):
        raise InvalidImageError(f"Unsupported image format '{image_format}'.")

    # Apply EXIF orientation so phone photos are upright.
    image = ImageOps.exif_transpose(image)
    image = image.convert("RGB")

    width, height = image.size
    if width > MAX_IMAGE_DIMENSION or height > MAX_IMAGE_DIMENSION:
        raise ImageTooLargeError(
            f"Image dimensions {width}x{height} exceed the "
            f"{MAX_IMAGE_DIMENSION}px limit per side."
        )
    if width * height > MAX_IMAGE_PIXELS:
        raise ImageTooLargeError("Image resolution is unreasonably large.")

    array = np.asarray(image, dtype=np.uint8)
    return DecodedImage(array=array, width=width, height=height, format=image_format)
