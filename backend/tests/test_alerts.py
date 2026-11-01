from fastapi.testclient import TestClient
import pytest

from app import database
from app.main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "alerts-test.db")
    database.init_db()
    database.create_bin("BIN-ALERT", "Alert bin", "Zone A", 100, 65)
    with TestClient(app) as test_client:
        yield test_client


def test_alerts_fire_once_per_upward_threshold_crossing(client):
    database.record_reading("BIN-ALERT", 70)
    database.record_reading("BIN-ALERT", 73)
    database.record_reading("BIN-ALERT", 90)
    database.record_reading("BIN-ALERT", 94)

    alerts = client.get("/api/v1/alerts").json()
    assert len(alerts) == 2
    assert [item["severity"] for item in reversed(alerts)] == ["medium", "high"]
    assert "almost full" in alerts[1]["title"].lower()
    assert "full" in alerts[0]["title"].lower()


def test_emptying_and_refilling_generates_one_new_alert_per_crossing(client):
    database.record_reading("BIN-ALERT", 70)
    database.record_reading("BIN-ALERT", 72)
    database.record_reading("BIN-ALERT", 0)
    database.record_reading("BIN-ALERT", 70)
    database.record_reading("BIN-ALERT", 73)

    alerts = client.get("/api/v1/alerts").json()
    assert len(alerts) == 2
    assert all(item["severity"] == "medium" for item in alerts)


def test_dashboard_unread_count_matches_alert_rows_and_read_is_idempotent(client):
    database.record_reading("BIN-ALERT", 70)
    alert = client.get("/api/v1/alerts").json()[0]

    first = client.post(f"/api/v1/alerts/{alert['id']}/read")
    second = client.post(f"/api/v1/alerts/{alert['id']}/read")
    assert first.status_code == 200
    assert second.status_code == 200
    assert client.get("/api/v1/alerts").json()[0]["is_read"] is True

    with database.connect() as db:
        expected = db.execute("SELECT COUNT(*) FROM alerts WHERE is_read = 0").fetchone()[0]
    assert client.get("/api/v1/dashboard").json()["unread_alerts"] == expected


def test_deleting_bin_keeps_alert_history_with_null_bin_id(client):
    database.record_reading("BIN-ALERT", 70)
    deleted = client.delete("/api/v1/bins/BIN-ALERT")
    assert deleted.status_code == 204

    alerts = client.get("/api/v1/alerts").json()
    assert len(alerts) == 1
    assert alerts[0]["bin_id"] is None
    assert alerts[0]["bin_name"] is None
