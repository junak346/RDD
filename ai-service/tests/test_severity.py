"""Severity-estimation rules (documented heuristics, not engineering verdicts)."""

from app.models.base import RawDetection
from app.services.severity import SeverityEstimator, max_severity


def _det(x1, y1, x2, y2, confidence=0.8, class_name="pothole"):
    return RawDetection(
        class_id=0,
        class_name=class_name,
        confidence=confidence,
        x1=x1,
        y1=y1,
        x2=x2,
        y2=y2,
    )


def test_larger_damage_scores_higher():
    estimator = SeverityEstimator()
    small = estimator.estimate(_det(10, 10, 20, 20), 100, 100)
    large = estimator.estimate(_det(5, 5, 95, 95), 100, 100)
    assert large.score > small.score
    assert large.severity == "high"
    assert small.severity in ("low", "moderate")


def test_confidence_increases_score():
    estimator = SeverityEstimator()
    low = estimator.estimate(_det(10, 10, 40, 40, confidence=0.3), 100, 100)
    high = estimator.estimate(_det(10, 10, 40, 40, confidence=0.95), 100, 100)
    assert high.score > low.score


def test_class_weight_influences_severity():
    estimator = SeverityEstimator()
    pothole = estimator.estimate(_det(10, 10, 40, 40, class_name="pothole"), 100, 100)
    other = estimator.estimate(_det(10, 10, 40, 40, class_name="other"), 100, 100)
    assert pothole.score > other.score


def test_area_ratio_bounded():
    estimator = SeverityEstimator()
    result = estimator.estimate(_det(-50, -50, 500, 500), 100, 100)
    assert 0.0 <= result.area_ratio <= 1.0
    assert 0.0 <= result.score <= 1.0


def test_max_severity_ordering():
    assert max_severity([]) is None
    assert max_severity(["low"]) == "low"
    assert max_severity(["low", "high", "moderate"]) == "high"
