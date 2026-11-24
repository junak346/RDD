"""Health and model-info endpoint tests."""


def test_health_reports_demo_engine(client):
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["model_loaded"] is True
    assert body["demo"] is True
    assert body["engine"] == "demo"


def test_model_info_lists_damage_classes(client):
    response = client.get("/model/info")
    assert response.status_code == 200
    body = response.json()
    assert body["demo"] is True
    assert body["engine"] == "demo"
    assert "pothole" in body["classes"]
    assert 0 < body["confidence_threshold"] < 1


def test_root_indexes_service(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["service"]
