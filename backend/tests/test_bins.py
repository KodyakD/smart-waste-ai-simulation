from fastapi.testclient import TestClient
import pytest

from app import database
from app.main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "smart-waste-test.db")
    database.init_db()
    with TestClient(app) as test_client:
        yield test_client


def test_create_bin_and_reject_duplicate_id(client):
    payload = {
        "id": "BIN-NEW",
        "name": "Library",
        "location": "Zone D",
        "capacity_cm": 145,
        "fill_percentage": 25,
    }
    created = client.post("/api/v1/bins", json=payload)
    assert created.status_code == 201
    assert created.json()["capacity_cm"] == 145
    assert created.json()["distance_cm"] > 0

    duplicate = client.post("/api/v1/bins", json=payload)
    assert duplicate.status_code == 409


@pytest.mark.parametrize("payload", [
    {"id": "bad id", "name": "Bin", "location": "Zone", "capacity_cm": 100},
    {"id": "BIN-BAD", "name": " ", "location": "Zone", "capacity_cm": 100},
    {"id": "BIN-BAD", "name": "Bin", "location": "Zone", "capacity_cm": 10},
    {"id": "BIN-BAD", "name": "Bin", "location": "Zone", "capacity_cm": 100, "fill_percentage": 101},
])
def test_create_bin_rejects_invalid_payloads(client, payload):
    assert client.post("/api/v1/bins", json=payload).status_code == 422


def test_patch_bin_updates_only_supplied_fields(client):
    created = client.post("/api/v1/bins", json={
        "id": "BIN-EDIT", "name": "Old name", "location": "Zone E", "capacity_cm": 120,
    })
    assert created.status_code == 201

    updated = client.patch("/api/v1/bins/BIN-EDIT", json={"name": "New name"})
    assert updated.status_code == 200
    assert updated.json()["name"] == "New name"
    assert updated.json()["location"] == "Zone E"
    assert updated.json()["capacity_cm"] == 120


def test_delete_bin_cascades_readings_and_preserves_alert_history(client):
    created = client.post("/api/v1/bins", json={
        "id": "BIN-DEL", "name": "Delete me", "location": "Zone F", "capacity_cm": 130,
    })
    assert created.status_code == 201
    database.record_reading("BIN-DEL", 91)
    with database.connect() as db:
        db.execute(
            "INSERT INTO alerts (bin_id, severity, title, message, created_at) VALUES (?, ?, ?, ?, ?)",
            ("BIN-DEL", "high", "Test alert", "Preserve this history", database.utc_now()),
        )
        db.commit()

    deleted = client.delete("/api/v1/bins/BIN-DEL")
    assert deleted.status_code == 204
    assert client.get("/api/v1/bins/BIN-DEL/readings").status_code == 404
    with database.connect() as db:
        assert db.execute("SELECT COUNT(*) FROM sensor_readings WHERE bin_id = 'BIN-DEL'").fetchone()[0] == 0
        alert = db.execute("SELECT bin_id, title FROM alerts WHERE title = 'Test alert'").fetchone()
    assert alert["bin_id"] is None
    assert alert["title"] == "Test alert"


def test_patch_and_delete_unknown_bin_return_404(client):
    assert client.patch("/api/v1/bins/MISSING", json={"name": "Unknown"}).status_code == 404
    assert client.delete("/api/v1/bins/MISSING").status_code == 404
