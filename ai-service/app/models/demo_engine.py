"""Clearly-labelled DEMO detection engine.

⚠️  THIS IS NOT A TRAINED MODEL AND NOT REAL AI INFERENCE. ⚠️

It applies simple, deterministic image heuristics (dark-region detection and
gradient analysis on a coarse grid) so the product can be demonstrated end to
end in environments where no trained road-damage weights are installed. Every
response produced by this engine carries `demo: true`, `model.engine = "demo"`,
and the UI shows a permanent DEMO MODE banner.

The heuristics are pure functions of the image: darker compact regions are
reported as "pothole", elongated high-gradient structures as "crack", and
highly textured regions as "surface_damage". Confidence values are heuristic
scores — they are NOT calibrated model confidences.

Replace this engine with real weights (docs/AI_MODEL.md) for production use.
"""

from __future__ import annotations

import numpy as np

from ..models.base import DetectionEngine, EngineInfo, RawDetection

# --- Tunable heuristic constants (documented, no magic numbers inline) -------
_GRID_ROWS = 6
_GRID_COLS = 8
_MAX_SIDE = 320  # analysis runs on a small copy for speed
_DARK_PERCENTILE = 40.0  # pixels below this luminance percentile count as "dark"
_SCORE_Z_THRESHOLD = 0.55  # a cell must be this many std above mean to qualify
_MIN_CONFIDENCE = 0.30
_MAX_CONFIDENCE = 0.87  # demo scores are deliberately capped below "authoritative"
_ELONGATION_THRESHOLD = 2.2  # aspect ratio that suggests a crack-like structure
_MERGE_NEIGHBORS = True

CLASS_POTHOLE = "pothole"
CLASS_CRACK = "crack"
CLASS_SURFACE = "surface_damage"
CLASS_OTHER = "other"

_DEMO_CLASSES = (CLASS_POTHOLE, CLASS_CRACK, CLASS_SURFACE, CLASS_OTHER)


def _resize_max(image: np.ndarray, max_side: int) -> tuple[np.ndarray, float]:
    """Downscale so the longest side equals `max_side` at most."""
    from PIL import Image

    height, width = image.shape[:2]
    scale = min(1.0, max_side / float(max(height, width)))
    if scale >= 1.0:
        return image, 1.0
    resized = Image.fromarray(image).resize(
        (max(1, int(width * scale)), max(1, int(height * scale))), Image.BILINEAR
    )
    return np.asarray(resized), scale


def _cell_features(gray: np.ndarray, grad: np.ndarray, dark_cutoff: float) -> list[dict]:
    """Compute per-cell darkness / edge / texture features on a coarse grid."""
    height, width = gray.shape
    cells: list[dict] = []
    for row in range(_GRID_ROWS):
        y1 = (row * height) // _GRID_ROWS
        y2 = ((row + 1) * height) // _GRID_ROWS
        for col in range(_GRID_COLS):
            x1 = (col * width) // _GRID_COLS
            x2 = ((col + 1) * width) // _GRID_COLS
            patch = gray[y1:y2, x1:x2]
            grad_patch = grad[y1:y2, x1:x2]
            cells.append(
                {
                    "row": row,
                    "col": col,
                    "x1": x1,
                    "y1": y1,
                    "x2": x2,
                    "y2": y2,
                    "dark_ratio": float(np.mean(patch < dark_cutoff)),
                    "edge": float(np.mean(grad_patch)),
                    "texture": float(np.std(patch)),
                }
            )
    return cells


def _combined_scores(cells: list[dict]) -> np.ndarray:
    """Standardise features and combine them into one score per cell."""

    def z(values: np.ndarray) -> np.ndarray:
        std = values.std()
        if std < 1e-6:
            return np.zeros_like(values)
        return (values - values.mean()) / std

    dark = z(np.array([c["dark_ratio"] for c in cells]))
    edge = z(np.array([c["edge"] for c in cells]))
    texture = z(np.array([c["texture"] for c in cells]))
    return 0.45 * dark + 0.35 * edge + 0.20 * texture


def _merge_cells(cells: list[dict], selected: np.ndarray, scores: np.ndarray) -> list[dict]:
    """Merge selected grid cells that touch each other into bounding boxes."""
    grid = {(c["row"], c["col"]): i for i, c in enumerate(cells)}
    visited: set[tuple[int, int]] = set()
    proposals: list[dict] = []

    for cell in cells:
        key = (cell["row"], cell["col"])
        if key in visited or not selected[grid[key]]:
            continue
        # Breadth-first flood over touching selected cells.
        stack = [key]
        members: list[int] = []
        visited.add(key)
        while stack:
            row, col = stack.pop()
            members.append(grid[(row, col)])
            for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                neighbor = (row + dr, col + dc)
                if neighbor in grid and neighbor not in visited and selected[grid[neighbor]]:
                    visited.add(neighbor)
                    stack.append(neighbor)

        boxes = [cells[i] for i in members]
        best = max(members, key=lambda i: scores[i])
        proposals.append(
            {
                "x1": min(b["x1"] for b in boxes),
                "y1": min(b["y1"] for b in boxes),
                "x2": max(b["x2"] for b in boxes),
                "y2": max(b["y2"] for b in boxes),
                "score": float(scores[best]),
                "dark_ratio": float(np.mean([b["dark_ratio"] for b in boxes])),
                "edge": float(np.mean([b["edge"] for b in boxes])),
                "texture": float(np.mean([b["texture"] for b in boxes])),
            }
        )
    return proposals


def _classify(proposal: dict) -> str:
    """Heuristic class assignment — see module docstring for honesty notes."""
    width = proposal["x2"] - proposal["x1"]
    height = max(1.0, proposal["y2"] - proposal["y1"])
    aspect = max(width / height, height / width)

    if aspect >= _ELONGATION_THRESHOLD and proposal["edge"] >= proposal["dark_ratio"]:
        return CLASS_CRACK
    if proposal["dark_ratio"] >= 0.5:
        return CLASS_POTHOLE
    if proposal["texture"] >= 0.5:
        return CLASS_SURFACE
    return CLASS_OTHER


class DemoEngine(DetectionEngine):
    """Deterministic heuristic engine used only when explicitly labelled."""

    def info(self) -> EngineInfo:
        return EngineInfo(
            name="demo-engine",
            version="1.0.0-demo",
            engine="demo",
            device="cpu",
            demo=True,
            classes=_DEMO_CLASSES,
        )

    def predict(self, image_rgb: np.ndarray) -> list[RawDetection]:
        small, scale = _resize_max(image_rgb, _MAX_SIDE)
        gray = small.astype(np.float32).mean(axis=2)

        # Gradient magnitude via simple forward differences.
        gx = np.zeros_like(gray)
        gy = np.zeros_like(gray)
        gx[:, :-1] = np.abs(np.diff(gray, axis=1))
        gy[:-1, :] = np.abs(np.diff(gray, axis=0))
        grad = gx + gy

        dark_cutoff = float(np.percentile(gray, _DARK_PERCENTILE))
        cells = _cell_features(gray, grad, dark_cutoff)
        scores = _combined_scores(cells)
        selected = scores > _SCORE_Z_THRESHOLD
        if _MERGE_NEIGHBORS:
            proposals = _merge_cells(cells, selected, scores)
        else:
            proposals = [
                {
                    "x1": c["x1"],
                    "y1": c["y1"],
                    "x2": c["x2"],
                    "y2": c["y2"],
                    "score": float(scores[i]),
                    "dark_ratio": c["dark_ratio"],
                    "edge": c["edge"],
                    "texture": c["texture"],
                }
                for i, c in enumerate(cells)
                if selected[i]
            ]

        # Map back to original-resolution coordinates.
        detections: list[RawDetection] = []
        for proposal in proposals:
            score = proposal["score"]
            confidence = float(np.clip(0.35 + 0.18 * score, _MIN_CONFIDENCE, _MAX_CONFIDENCE))
            class_name = _classify(proposal)
            detections.append(
                RawDetection(
                    class_id=_DEMO_CLASSES.index(class_name),
                    class_name=class_name,
                    confidence=confidence,
                    x1=proposal["x1"] / scale,
                    y1=proposal["y1"] / scale,
                    x2=proposal["x2"] / scale,
                    y2=proposal["y2"] / scale,
                )
            )
        return detections
