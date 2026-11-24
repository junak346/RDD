"""Typed application errors mapped to HTTP responses.

Clients always receive a structured body:

    {"success": false, "error": {"code": "...", "message": "..."}}

Internal details (stack traces, paths) are logged server-side only.
"""

from __future__ import annotations


class AIServiceError(Exception):
    """Base class for expected, client-safe errors."""

    status_code: int = 500
    code: str = "INTERNAL_ERROR"
    message: str = "An unexpected error occurred."

    def __init__(self, message: str | None = None, *, code: str | None = None) -> None:
        super().__init__(message or self.message)
        self.message = message or self.message
        if code:
            self.code = code


class InvalidImageError(AIServiceError):
    status_code = 400
    code = "INVALID_IMAGE"
    message = "The uploaded file is not a valid image."


class ImageTooLargeError(AIServiceError):
    status_code = 413
    code = "IMAGE_TOO_LARGE"
    message = "The uploaded image exceeds the allowed size."


class ModelUnavailableError(AIServiceError):
    status_code = 503
    code = "MODEL_UNAVAILABLE"
    message = "The detection model is not available. See docs/AI_MODEL.md for installation."


class MissingFileError(AIServiceError):
    status_code = 422
    code = "MISSING_FILE"
    message = "No image was provided. Upload a file in the 'file' field or send image_base64."
