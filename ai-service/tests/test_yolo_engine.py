"""Tests for the real YOLO engine code-path (mocked ultralytics — no weights needed)."""

import sys
import types

import numpy as np
import pytest

from app.models.yolo_engine import YoloEngine


class _FakeBoxes:
    def __init__(self, xyxy, conf, cls):
        self.xyxy = _FakeTensor(xyxy)
        self.conf = _FakeTensor(conf)
        self.cls = _FakeTensor(cls)


class _FakeTensor:
    def __init__(self, value):
        self._value = np.asarray(value)

    def cpu(self):
        return self

    def numpy(self):
        return self._value


class _FakeResult:
    def __init__(self, boxes):
        self.boxes = boxes


class _FakeYOLO:
    """Stand-in for ultralytics.YOLO that records how it is called."""

    names = {0: "pothole", 1: "crack"}
    last_call = None

    def __init__(self, path):
        self.path = path

    def predict(self, **kwargs):
        _FakeYOLO.last_call = kwargs
        return [
            _FakeResult(
                _FakeBoxes(
                    xyxy=[[10.0, 20.0, 60.0, 80.0], [5.0, 5.0, 15.0, 25.0]],
                    conf=[0.91, 0.55],
                    cls=[0, 1],
                )
            )
        ]


@pytest.fixture()
def fake_ultralytics(monkeypatch):
    module = types.ModuleType("ultralytics")
    module.YOLO = _FakeYOLO
    monkeypatch.setitem(sys.modules, "ultralytics", module)
    return _FakeYOLO


def _engine(tmp_path):
    weights = tmp_path / "weights.pt"
    weights.write_bytes(b"fake-weights")
    return YoloEngine(
        str(weights),
        confidence_threshold=0.4,
        iou_threshold=0.5,
        device="cpu",
        name="test-yolo",
        version="9.9.9",
    )


def test_yolo_engine_parses_detections(fake_ultralytics, tmp_path):
    engine = _engine(tmp_path)
    image = np.zeros((100, 100, 3), dtype=np.uint8)

    detections = engine.predict(image)

    assert len(detections) == 2
    assert detections[0].class_name == "pothole"
    assert detections[0].confidence == pytest.approx(0.91)
    assert detections[0].x2 == 60.0
    assert detections[1].class_name == "crack"

    info = engine.info()
    assert info.engine == "yolo"
    assert info.demo is False
    assert info.classes == ("pothole", "crack")

    # The engine must convert RGB → BGR and forward thresholds.
    call = fake_ultralytics.last_call
    assert call["conf"] == 0.4 and call["iou"] == 0.5
    assert call["source"].dtype == np.uint8


def test_yolo_engine_missing_weights_raises(fake_ultralytics, tmp_path):
    with pytest.raises(FileNotFoundError):
        YoloEngine(
            str(tmp_path / "missing.pt"),
            confidence_threshold=0.4,
            iou_threshold=0.5,
            device="cpu",
            name="x",
            version="1",
        )


def test_yolo_engine_missing_ml_stack_raises(tmp_path, monkeypatch):
    # Make `import ultralytics` fail even if it is installed.
    monkeypatch.setitem(sys.modules, "ultralytics", None)
    weights = tmp_path / "weights.pt"
    weights.write_bytes(b"fake")
    with pytest.raises((ImportError, RuntimeError)):
        YoloEngine(
            str(weights),
            confidence_threshold=0.4,
            iou_threshold=0.5,
            device="cpu",
            name="x",
            version="1",
        )
