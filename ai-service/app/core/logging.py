"""Structured, single-line logging setup for the AI service."""

from __future__ import annotations

import logging

_LEVELS = {
    "critical": logging.CRITICAL,
    "error": logging.ERROR,
    "warning": logging.WARNING,
    "info": logging.INFO,
    "debug": logging.DEBUG,
    "trace": logging.DEBUG,
}

_FORMAT = "%(asctime)s | %(levelname)-7s | %(name)s | %(message)s"


def configure_logging(level_name: str = "info") -> None:
    """Configure root logging once at startup."""
    level = _LEVELS.get(level_name.lower(), logging.INFO)
    logging.basicConfig(level=level, format=_FORMAT, datefmt="%Y-%m-%dT%H:%M:%S%z")
    # Keep noisy third-party loggers at warning unless debugging.
    if level > logging.DEBUG:
        for name in ("uvicorn", "uvicorn.error", "uvicorn.access", "multipart"):
            logging.getLogger(name).setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
