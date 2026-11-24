"""End-to-end /predict tests against the demo engine (honest, labelled output)."""

import base64

from app.schemas.prediction import PredictionResponse


def _upload(client, data: bytes, filename: str = "road.png", content_type: str = "image/png"):
    return client.post(
        "/predict",
        files={"file": (filename, data, content_type)},
    )


def test_predict_returns_valid_schema(client, sample_image_bytes):
    response = _upload(client, sample_image_bytes)
    assert response.status_code == 200
    body = PredictionResponse.model_validate(response.json())

    assert body.success is True
    assert body.demo is True, "demo engine output must be flagged demo=true"
    assert body.model.demo is True
    assert body.model.engine == "demo"
    assert body.image.width == 320 and body.image.height == 240
    assert body.processing_time_ms > 0
    assert body.summary.detection_count == len(body.detections)
    assert any("DEMO MODE" in w for w in body.warnings)

    # Annotated image must decode as JPEG.
    annotated = base64.b64decode(body.annotated_image_base64)
    assert annotated[:2] == b"\xff\xd8"  # JPEG SOI marker

    for detection in body.detections:
        assert 0.0 <= detection.confidence <= 1.0
        assert detection.severity in ("low", "moderate", "high")
        bbox = detection.bbox
        assert 0 <= bbox.x1 < bbox.x2 <= 320
        assert 0 <= bbox.y1 < bbox.y2 <= 240


def test_predict_detects_damage_on_roadlike_image(client, sample_image_bytes):
    response = _upload(client, sample_image_bytes)
    body = PredictionResponse.model_validate(response.json())
    assert body.summary.detection_count >= 1
    assert body.summary.max_severity in ("low", "moderate", "high")


def test_predict_clean_image_reports_no_damage(client, flat_image_bytes):
    response = _upload(client, flat_image_bytes)
    assert response.status_code == 200
    body = PredictionResponse.model_validate(response.json())
    assert body.summary.detection_count == 0
    assert body.summary.max_severity is None


def test_predict_rejects_non_image(client):
    response = _upload(client, b"this is definitely not an image", filename="evil.txt",
                       content_type="text/plain")
    assert response.status_code == 400
    error = response.json()["error"]
    assert error["code"] == "INVALID_IMAGE"


def test_predict_rejects_missing_file(client):
    response = client.post("/predict")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "MISSING_FILE"


def test_predict_rejects_oversized_image(client, sample_image_bytes):
    # Demo settings cap uploads at 2 MB — exceed it.
    oversized = sample_image_bytes + b"\x00" * (2 * 1024 * 1024)
    response = _upload(client, oversized)
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "IMAGE_TOO_LARGE"


def test_predict_accepts_json_base64(client, sample_image_bytes):
    payload = {"image_base64": base64.b64encode(sample_image_bytes).decode("ascii")}
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    body = PredictionResponse.model_validate(response.json())
    assert body.demo is True


def test_predict_rejects_bad_base64(client):
    response = client.post("/predict", json={"image_base64": "!!not-base64!!"})
    assert response.status_code == 422
