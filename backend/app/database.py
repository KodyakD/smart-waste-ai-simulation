from __future__ import annotations

import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .config import BASE_DIR, SETTINGS

ALERT_THRESHOLDS = (
    (SETTINGS.fill_almost_full_threshold, 'medium', 'almost full'),
    (SETTINGS.fill_full_threshold, 'high', 'full'),
)
DB_PATH = Path(os.getenv("DATABASE_PATH", str(BASE_DIR / "data" / "smart_waste.db")))
if not DB_PATH.is_absolute():
    DB_PATH = (BASE_DIR / DB_PATH).resolve()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_db() -> None:
    with connect() as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS bins (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                location TEXT NOT NULL,
                capacity_cm REAL NOT NULL DEFAULT 100,
                fill_percentage REAL NOT NULL DEFAULT 0,
                distance_cm REAL NOT NULL DEFAULT 100,
                status TEXT NOT NULL DEFAULT 'normal',
                is_running INTEGER NOT NULL DEFAULT 0,
                last_updated TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sensor_readings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bin_id TEXT NOT NULL REFERENCES bins(id) ON DELETE CASCADE,
                fill_percentage REAL NOT NULL,
                distance_cm REAL NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bin_id TEXT REFERENCES bins(id) ON DELETE SET NULL,
                severity TEXT NOT NULL,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                is_read INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS detections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL,
                original_filename TEXT NOT NULL,
                class_name TEXT NOT NULL,
                confidence REAL NOT NULL,
                risk_level TEXT NOT NULL,
                status TEXT NOT NULL,
                bbox_json TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL
            );
            """
        )

        columns = {row["name"] for row in db.execute("PRAGMA table_info(bins)").fetchall()}
        if "capacity_cm" not in columns:
            db.execute("ALTER TABLE bins ADD COLUMN capacity_cm REAL NOT NULL DEFAULT 100")

        existing = db.execute("SELECT COUNT(*) AS count FROM bins").fetchone()["count"]
        if existing == 0:
            initial_bins = [
                ("BIN-001", "Central Square", "Zone A", 34.0),
                ("BIN-002", "University Gate", "Zone B", 68.0),
                ("BIN-003", "Market Street", "Zone C", 88.0),
            ]
            now = utc_now()
            for bin_id, name, location, fill in initial_bins:
                capacity_cm = 100.0
                distance = distance_for_fill(fill, capacity_cm)
                status = status_for_fill(fill)
                db.execute(
                    """INSERT INTO bins
                       (id, name, location, capacity_cm, fill_percentage, distance_cm, status, is_running, last_updated)
                       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)""",
                    (bin_id, name, location, capacity_cm, fill, distance, status, now),
                )
                db.execute(
                    """INSERT INTO sensor_readings
                       (bin_id, fill_percentage, distance_cm, status, created_at)
                       VALUES (?, ?, ?, ?, ?)""",
                    (bin_id, fill, distance, status, now),
                )
        db.commit()


def distance_for_fill(fill: float, capacity_cm: float) -> float:
    distance = capacity_cm - (fill / 100.0) * (capacity_cm - SETTINGS.sensor_full_distance_cm)
    return round(distance, 1)


def status_for_fill(fill: float) -> str:
    if fill >= SETTINGS.fill_full_threshold:
        return "full"
    if fill >= SETTINGS.fill_almost_full_threshold:
        return "almost_full"
    return "normal"


def _bin_dict(row: sqlite3.Row) -> dict[str, Any]:
    result = dict(row)
    result["is_running"] = bool(result["is_running"])
    return result


def list_bins() -> list[dict[str, Any]]:
    with connect() as db:
        rows = db.execute("SELECT * FROM bins ORDER BY id").fetchall()
    return [_bin_dict(row) for row in rows]


def get_bin(bin_id: str) -> dict[str, Any] | None:
    with connect() as db:
        row = db.execute("SELECT * FROM bins WHERE id = ?", (bin_id,)).fetchone()
    return _bin_dict(row) if row else None


def set_bin_running(bin_id: str, running: bool) -> dict[str, Any] | None:
    with connect() as db:
        db.execute(
            "UPDATE bins SET is_running = ? WHERE id = ?",
            (1 if running else 0, bin_id),
        )
        db.commit()
    return get_bin(bin_id)


def record_reading(bin_id: str, fill: float) -> dict[str, Any] | None:
    fill = max(0.0, min(100.0, float(fill)))
    status = status_for_fill(fill)
    now = utc_now()
    with connect() as db:
        current = db.execute(
            "SELECT fill_percentage, name, capacity_cm FROM bins WHERE id = ?", (bin_id,)
        ).fetchone()
        if current is None:
            return None
        previous_fill = float(current["fill_percentage"])
        distance = distance_for_fill(fill, float(current["capacity_cm"]))
        db.execute(
            """UPDATE bins SET fill_percentage = ?, distance_cm = ?, status = ?, last_updated = ?
               WHERE id = ?""",
            (fill, distance, status, now, bin_id),
        )
        db.execute(
            """INSERT INTO sensor_readings
               (bin_id, fill_percentage, distance_cm, status, created_at)
               VALUES (?, ?, ?, ?, ?)""",
            (bin_id, fill, distance, status, now),
        )
        for threshold, severity, label in ALERT_THRESHOLDS:
            if previous_fill < threshold <= fill:
                db.execute(
                    """INSERT INTO alerts (bin_id, severity, title, message, created_at)
                       VALUES (?, ?, ?, ?, ?)""",
                    (
                        bin_id,
                        severity,
                        f"{current['name']} is {label}",
                        f"{current['name']} crossed the {threshold:g}% fill threshold. Collection is recommended.",
                        now,
                    ),
                )
        db.commit()
    return get_bin(bin_id)


def get_readings(bin_id: str, limit: int = 60) -> list[dict[str, Any]]:
    with connect() as db:
        rows = db.execute(
            """SELECT id, bin_id, fill_percentage, distance_cm, status, created_at
               FROM sensor_readings WHERE bin_id = ? ORDER BY id DESC LIMIT ?""",
            (bin_id, max(1, min(limit, 500))),
        ).fetchall()
    return [dict(row) for row in reversed(rows)]


def list_alerts(limit: int = 30) -> list[dict[str, Any]]:
    with connect() as db:
        rows = db.execute(
            """SELECT alerts.*, bins.name AS bin_name
               FROM alerts LEFT JOIN bins ON bins.id = alerts.bin_id
               ORDER BY alerts.id DESC LIMIT ?""",
            (max(1, min(limit, 200)),),
        ).fetchall()
    result = []
    for row in rows:
        item = dict(row)
        item["is_read"] = bool(item["is_read"])
        result.append(item)
    return result


def mark_alert_read(alert_id: int) -> bool:
    with connect() as db:
        cursor = db.execute("UPDATE alerts SET is_read = 1 WHERE id = ?", (alert_id,))
        db.commit()
        return cursor.rowcount > 0


def create_detection(
    filename: str,
    original_filename: str,
    class_name: str,
    confidence: float,
    risk_level: str,
    status: str,
    bbox_json: str,
) -> dict[str, Any]:
    now = utc_now()
    with connect() as db:
        cursor = db.execute(
            """INSERT INTO detections
               (filename, original_filename, class_name, confidence, risk_level, status, bbox_json, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (filename, original_filename, class_name, confidence, risk_level, status, bbox_json, now),
        )
        detection_id = cursor.lastrowid
        if risk_level in ("potential_hazard", "high_concern"):
            severity = "critical" if risk_level == "high_concern" else "medium"
            db.execute(
                """INSERT INTO alerts (bin_id, severity, title, message, created_at)
                   VALUES (NULL, ?, ?, ?, ?)""",
                (
                    severity,
                    "Potentially hazardous waste detected",
                    f"AI identified {class_name.replace('_', ' ')}. Review the item and follow local disposal guidance.",
                    now,
                ),
            )
        db.commit()
        row = db.execute("SELECT * FROM detections WHERE id = ?", (detection_id,)).fetchone()
    return dict(row)


def list_detections(limit: int = 30) -> list[dict[str, Any]]:
    with connect() as db:
        rows = db.execute(
            "SELECT * FROM detections ORDER BY id DESC LIMIT ?",
            (max(1, min(limit, 200)),),
        ).fetchall()
    return [dict(row) for row in rows]


def dashboard_summary() -> dict[str, Any]:
    with connect() as db:
        bins = db.execute(
            "SELECT COUNT(*) AS total, AVG(fill_percentage) AS average FROM bins"
        ).fetchone()
        full_bins = db.execute(
            "SELECT COUNT(*) AS total FROM bins WHERE fill_percentage >= ?",
            (SETTINGS.fill_full_threshold,),
        ).fetchone()["total"]
        active = db.execute(
            "SELECT COUNT(*) AS total FROM bins WHERE is_running = 1"
        ).fetchone()["total"]
        unread_alerts = db.execute(
            "SELECT COUNT(*) AS total FROM alerts WHERE is_read = 0"
        ).fetchone()["total"]
        detections = db.execute("SELECT COUNT(*) AS total FROM detections").fetchone()["total"]
        readings = db.execute("SELECT COUNT(*) AS total FROM sensor_readings").fetchone()["total"]
    return {
        "total_bins": bins["total"],
        "average_fill": round(float(bins["average"] or 0), 1),
        "full_bins": full_bins,
        "active_simulations": active,
        "unread_alerts": unread_alerts,
        "total_detections": detections,
        "total_readings": readings,
    }


def create_bin(bin_id: str, name: str, location: str, capacity_cm: float, fill: float = 0) -> dict[str, Any]:
    now = utc_now()
    status = status_for_fill(fill)
    distance = distance_for_fill(fill, capacity_cm)
    with connect() as db:
        db.execute(
            """INSERT INTO bins
               (id, name, location, capacity_cm, fill_percentage, distance_cm, status, is_running, last_updated)
               VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)""",
            (bin_id, name, location, capacity_cm, fill, distance, status, now),
        )
        db.execute(
            """INSERT INTO sensor_readings
               (bin_id, fill_percentage, distance_cm, status, created_at)
               VALUES (?, ?, ?, ?, ?)""",
            (bin_id, fill, distance, status, now),
        )
        db.commit()
    item = get_bin(bin_id)
    if item is None:
        raise RuntimeError("Created bin could not be read back")
    return item


def update_bin(bin_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
    allowed = {"name", "location", "capacity_cm"}
    values = {key: value for key, value in updates.items() if key in allowed}
    if not values:
        return get_bin(bin_id)
    with connect() as db:
        row = db.execute(
            "SELECT fill_percentage, capacity_cm FROM bins WHERE id = ?", (bin_id,)
        ).fetchone()
        if row is None:
            return None
        capacity = float(values.get("capacity_cm", row["capacity_cm"]))
        values["distance_cm"] = distance_for_fill(float(row["fill_percentage"]), capacity)
        assignments = ", ".join(f"{column} = ?" for column in values)
        db.execute(
            f"UPDATE bins SET {assignments} WHERE id = ?",
            (*values.values(), bin_id),
        )
        db.commit()
    return get_bin(bin_id)


def delete_bin(bin_id: str) -> bool:
    with connect() as db:
        existing = db.execute("SELECT id FROM bins WHERE id = ?", (bin_id,)).fetchone()
        if existing is None:
            return False
        db.execute("UPDATE bins SET is_running = 0 WHERE id = ?", (bin_id,))
        db.execute("DELETE FROM bins WHERE id = ?", (bin_id,))
        db.commit()
    return True
